const Web3 = require('web3');
const path = require('path');
const fs = require('fs');

const {VariableSharepoint} = require('./utilities');

class BlockchainClient {
    web3;
    gasEstimationMultiplicationFactor; 
    contracts = {};
    contractABIs = {};
    account;
    orderToFundPerCustomer = {};      // maps customer addresses to a order ID

    constructor(configuration){
        let networkCfg = configuration.networkSpecific[configuration.network];
        if(typeof(networkCfg.loadRequirements) == 'function'){networkCfg.loadRequirements();}
        this.web3 = new Web3(typeof(networkCfg.provider) == 'function' ? configuration.provider(new Web3.providers.WebsocketProvider(networkCfg.websocketProviderURL())) : networkCfg.websocketProviderURL);
        this.gasEstimationMultiplicationFactor = 1 + configuration.gasMargin;
        VariableSharepoint.share('blockchainClient', this);

        for(let contractID in configuration.contractArtifactFilenames){
            let contractArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, configuration.contractArtifactsFolderRelativePath, configuration.contractArtifactFilenames[contractID]+'.json')).toString());
            this.contractABIs[contractID] = contractArtifact.abi;
            this.contracts[contractID] =  new this.web3.eth.Contract(contractArtifact.abi, networkCfg.contractAddresses[contractID]);
        }
        extendTokenContract(this.contracts['uoa'], configuration, this);
        initializeContractEventListeners(this.contracts['uoa'], this.contracts['escrowPaymentSplitter'])
        this.web3.eth.getAccounts().then(accounts => {
            console.log('Accounts', accounts);
            this.account = accounts[0]
            this.contracts['uoa'].serviceAccount = this.account;
            this.contracts['escrowPaymentSplitter'].serviceAccount = this.account;
        });
    }

    getContractEssentials(contractID){
        return typeof(this.contractABIs[contractID]) != 'undefined' ? {abi: this.contractABIs[contractID], address: this.contracts[contractID]._address} : null;
    }

    getContract(contractID){
        return typeof(this.contracts[contractID]) == 'object' ? this.contracts[contractID] : null;
    }

    estimateGasAndSend(contractID, methodName, parameterArray, options){
        let contract = this.contracts[contractID];
        let gasEstimationMultiplicationFactor = this.gasEstimationMultiplicationFactor;
        return new Promise((resolve, reject) => {
            contract.methods[methodName](...parameterArray).estimateGas(options, function(error, gasEstimation){
                if(error != null){reject(error);}
                options.gasLimit = parseInt(gasEstimation * gasEstimationMultiplicationFactor);
                console.log('Preparing smart-contract transaction calling '+methodName+' with a gasLimit of '+options.gasLimit+' (estimation: '+gasEstimation+')');
                contract.methods[methodName](...parameterArray).send(options).then(response => resolve(response)).catch(error => reject(error));
            });
        });
    }

    eventHandling(contractID, eventName, eventCallback){
        this.contracts[contractID].events[eventName]().on("connected", function(subscriptionId){
            console.log(contractID+' event "'+eventName+'" listener has ID '+subscriptionId);
        })
        .on('data', function(event){
            console.log(event); // same results as the optional callback above
            eventCallback(event);
        })
        .on('changed', function(event){
            console.log('Event changed', event);
        })
        .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
            console.log(contractID+' event "'+eventName+'" listener triggered an error', error, receipt);
        });
    }

    handleEscrowSlotCreation(orderID){
        let database = VariableSharepoint.get('database');
        let order = database.getOrder(orderID);
        if(order == null){throw new Error('Attempt to call handleEscrowSlotCreation on unkown order');}
        let amountsPerSuppliers = database.getItem(order.itemID).getSupplierAmounts();
        let paymentSplittingDefinition = {recipients: [], amounts: []};
        for(let supplierID in amountsPerSuppliers){
            paymentSplittingDefinition.recipients.push(database.getSupplierAddress(supplierID));
            paymentSplittingDefinition.amounts.push(this.contracts['uoa'].rebaseToTokenDecimals(amountsPerSuppliers[supplierID] * order.amount).toString());
        }
        paymentSplittingDefinition.recipients.push(this.account);
        paymentSplittingDefinition.amounts.push(this.contracts['uoa'].rebaseToTokenDecimals(order.fees).toString());
        this.estimateGasAndSend('escrowPaymentSplitter', 'openEscrowSlot', [orderID, paymentSplittingDefinition], {from: this.account}).then(response => {
            database.setOrderEscrowSlotID(orderID, response.events.EscrowSlotOpened.returnValues.slotId);
            database.updateOrderState(orderID, 'awaiting funding allowance');
        }).catch(error => console.error(error));
    }

    setNextOrderToFund(customerAddress, orderID){
        let database = VariableSharepoint.get('database');
        if(!database.isValidOrderID(orderID)){throw new Error('Setting next order to fund to an unknown order ID');}
        let addr = customerAddress.toLowerCase();
        if(typeof(this.orderToFundPerCustomer[addr]) != 'undefined'){
            database.updateOrderState(this.orderToFundPerCustomer[addr], 'awaiting funding allowance');    
        }
        database.updateOrderState(orderID, 'awaiting funding');
        this.orderToFundPerCustomer[addr] = orderID;
    }

    handleOrderFunding(customerAddress){
        let database = VariableSharepoint.get('database');
        let addr = customerAddress.toLowerCase();
        if(typeof(this.orderToFundPerCustomer[addr]) == 'undefined'){return;}
        Promise.all([this.contracts['uoa'].methods.allowance(addr, this.contracts['escrowPaymentSplitter']._address).call(), this.contracts['uoa'].methods.balanceOf(addr).call()]).then(([allowance, balance]) => {
            let order = database.getOrder(this.orderToFundPerCustomer[addr]);
            let escrowAmount = this.contracts['uoa'].rebaseToTokenDecimals(order.partsTotalPrice + order.fees);
            if(BlockchainClient.toBN(allowance).gte(escrowAmount) && BlockchainClient.toBN(balance).gte(escrowAmount)){
                // TODO estimateGas
                //this.contracts['escrowPaymentSplitter'].methods.fundEscrowSlotFrom(order.escrowSlotId, addr).send({from: this.account, gasLimit: 300000}).then(() => {
                this.estimateGasAndSend('escrowPaymentSplitter', 'fundEscrowSlotFrom', [order.escrowSlotId, addr], {from: this.account}).then(() => {
                    delete(this.orderToFundPerCustomer[customerAddress]);
                    database.updateOrderState(order.id, 'awaiting goods');
                });
            }
        });
    }

    static toBN(input){return Web3.utils.toBN(input);}
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
        if(!contract.ready){throw Error('rebaseToTokenDecimals() called but contract is not ready');}
        // The split is necessary because BN.js doesn't support beeing created from numbers with decimals => first use currencyDecimalsFactor to bring the number to an integer + coinDecimalsAdjustedFactor to convert to the coinbase
        return BlockchainClient.toBN(parseInt(amount.toFixed(configuration.currencyDecimals) * this.currencyDecimalsFactor)).mul(this.coinDecimalsAdjustedFactor);
    }

    contract.mint = function(address, amount){
        if(!contract.ready){throw Error('mint() called but contract is not ready');}
        let blockchainClient = VariableSharepoint.get('blockchainClient');
        //return contract.methods.mint(address, this.rebaseToTokenDecimals(amount)).send({from: contract.serviceAccount});    // TODO default account
        return blockchainClient.estimateGasAndSend('uoa', 'mint', [address, this.rebaseToTokenDecimals(amount)], {from: contract.serviceAccount})
    }
}

function initializeContractEventListeners(tokenContract, escrowContract){
    let database = VariableSharepoint.get('database');
    let blockchainClient = VariableSharepoint.get('blockchainClient');

    blockchainClient.eventHandling('uoa', 'Approval', (event) => {
        if(database.isCustomerAddress(event.returnValues.owner) && BlockchainClient.compareAddresses(event.returnValues.spender, escrowContract._address)){
            blockchainClient.handleOrderFunding(event.returnValues.owner);
        }
    });

    blockchainClient.eventHandling('uoa', 'Transfer', (event) => {
        if(database.isCustomerAddress(event.returnValues.to)){
            blockchainClient.handleOrderFunding(event.returnValues.to);
        }
    });

    blockchainClient.eventHandling('escrowPaymentSplitter', 'EscrowSlotSettled', (event) => {
        let order = database.getOrderByEscrowSlotId(event.returnValues.slotId);
        if(order == null){return;}
        database.updateOrderState(order.id, 'concluded');
    });
}

module.exports = BlockchainClient;