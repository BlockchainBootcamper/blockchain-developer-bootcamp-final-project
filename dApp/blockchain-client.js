const Web3 = require('web3');
const path = require('path');
const fs = require('fs');

const {VariableSharepoint} = require('./utilities');

class BlockchainClient {
    web3;
    contracts = {};
    contractABIs = {};
    account;

    constructor(configuration){
        this.web3 = new Web3(configuration.web3ProviderURL);

        for(let contractID in configuration.contracts){
            let contractArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, configuration.contractArtifactsFolderRelativePath, configuration.contracts[contractID].artifactFilename+'.json')).toString());
            this.contractABIs[contractID] = contractArtifact.abi;
            this.contracts[contractID] =  new this.web3.eth.Contract(contractArtifact.abi, configuration.contracts[contractID].address);
        }
        extendTokenContract(this.contracts['uoa'], configuration, this);
        initializeContractEventListeners(this.contracts['uoa'], this.contracts['escrowPaymentSplitter'])
        this.web3.eth.getAccounts().then(accounts => {
            this.account = accounts[0]
            this.contracts['uoa'].serviceAccount = this.account;
            this.contracts['escrowPaymentSplitter'].serviceAccount = this.account;
        });
    }

    getContractEssentials(contractID){
        return typeof(this.contractABIs[contractID]) != 'undefined' ? {abi: this.contractABIs[contractID], address: this.contracts[contractID]._address} : null;
    }

    getContract(contractID){
        if(typeof(this.contracts[contractID]) == 'undefined'){throw new Error('Contract '+contractID+' unknown');}
        return this.contracts[contractID];
    }

    handleEscrowSlotCreation(orderID){
        let database = VariableSharepoint.get('database');
        let order = database.getOrder(orderID);
        let amountsPerSuppliers = database.getItem(order.itemID).getSupplierAmounts();
        let paymentSplittingDefinition = {recipients: [], amounts: []};
        for(let supplierId in amountsPerSuppliers){
            paymentSplittingDefinition.recipients.push(database.getSupplierAddress(supplierId));
            paymentSplittingDefinition.amounts.push(this.contracts['uoa'].rebaseToTokenDecimals(amountsPerSuppliers[supplierId] * order.amount).toString());
        }
        paymentSplittingDefinition.recipients.push(this.account);
        paymentSplittingDefinition.amounts.push(this.contracts['uoa'].rebaseToTokenDecimals(order.fees).toString());
    
        return this.contracts['escrowPaymentSplitter'].methods.openEscrowSlot(orderID, paymentSplittingDefinition).send({from: this.account, gasLimit: 300000}).then((response) => {
            database.setOrderEscrowSlotID(orderID, response.events.EscrowSlotOpened.returnValues.slotId);
            database.updateOrderState(orderID, 'confirmed');
        });    
    }

    getContractOwnerAccount(){  // TODO
        //return new Promise((resolve) => {this.web3.eth.getAccounts().then(accounts => {this.account = accounts[0]; resolve(accounts[0]));});  
        return this.account;
    }

    static toBN(input){
        return Web3.utils.toBN(input);
    }

    static compareAddresses(addr1, addr2){return addr1.toLowerCase() == addr2.toLowerCase();}
}

function extendTokenContract(contract, configuration){
    contract.currencyDecimalsFactor = Math.pow(10, configuration.currencyDecimals);;
    contract.coinDecimalsAdjustedFactor;        // Note: differential between the currencyDecimalsFactor and the coin decimals, see rebaseToTokenDecimals()
    contract.ready = false;

    contract.methods.decimals().call().then(decimals => {
        contract.coinDecimalsAdjustedFactor = BlockchainClient.toBN(10).pow(BlockchainClient.toBN(decimals - configuration.currencyDecimals));
        contract.ready = true;
    }); 

    contract.rebaseToTokenDecimals = function(amount){
        if(!contract.ready){throw Error('Contract not ready');}
        // The split is necessary because BN.js doesn't support beeing created from numbers with decimals => first use currencyDecimalsFactor to bring the number to an integer + coinDecimalsAdjustedFactor to convert to the coinbase
        return BlockchainClient.toBN(parseInt(amount * this.currencyDecimalsFactor)).mul(this.coinDecimalsAdjustedFactor);
    }

    contract.mint = function(address, amount){
        return contract.methods.mint(address, this.rebaseToTokenDecimals(amount)).send({from: contract.serviceAccount});    // TODO default account
    }
}

function initializeContractEventListeners(tokenContract, escrowContract){
    let database = VariableSharepoint.get('database');

    tokenContract.events.Approval().on('data', event => {
        if(database.isCustomerAddress(event.returnValues.owner) && BlockchainClient.compareAddresses(event.returnValues.spender, escrowContract._address)){
            Promise.all([tokenContract.methods.allowance(event.returnValues.owner, escrowContract._address).call(), tokenContract.methods.balanceOf(event.returnValues.owner).call()]).then(([allowance, balance]) => {
                console.log('fill escrow? Approval event ', allowance, balance);
                // TODO escrowContract.methods.fillEscrowSlotFrom();
            });
        }
    });

    tokenContract.events.Transfer().on('data', event => {
        if(database.isCustomerAddress(event.returnValues.to)){
            Promise.all([tokenContract.methods.allowance(event.returnValues.to, escrowContract._address).call(), tokenContract.methods.balanceOf(event.returnValues.to).call(event.returnValues.from)]).then(([allowance, balance]) => {
                console.log('fill escrow? Transfer event ', allowance, balance);
                // TODO escrowContract.methods.fillEscrowSlotFrom();
            });
        }
        if(database.isCustomerAddress(event.returnValues.from)){
            // update balance in DB
        }
    });

    escrowContract.events.EscrowSlotFilled().on('data', event => {
        if(database.doesEscrowSlotExist(event.returnValues.slotId)){database.updateOrderStateByEscrowSlotId(event.returnValues.slotId, 'awaiting goods');}
    });

    escrowContract.events.EscrowSlotSettled().on('data', event => {
        if(database.doesEscrowSlotExist(event.returnValues.slotId)){database.updateOrderStateByEscrowSlotId(event.returnValues.slotId, 'concluded');}
    });
}

module.exports = BlockchainClient;