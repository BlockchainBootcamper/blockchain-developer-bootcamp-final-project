var supplier = {id: null, address: null, name: null, tokenBalance: null, withdrawalAllowance: null};
var parts = {};
var orders = {};
var token = {decimalsFactor: null, symbol: null};
var uiState = {web3Ok: false};
var withdrawing = false;

window.onload = function(){
    onLoadHandler(initializeSmartContract);
    setElementVisibility('initializationMessage', false);
    renderSupplierOptions();
    render();
};

const handleWeb3AccountsChange = function(accounts){
    let newAddr = Array.isArray(accounts) && accounts.length ? accounts[0] : null;
    if(newAddr == supplier.address){return;}
    supplier.address = newAddr;
    if(supplier.address != null){
        setElementText('supplierAddressInRegistration', supplier.address);
        loadSupplierDetails();
    }
    else {
        render();
        clearActivityStream();
        notify('Activity stream cleared on wallet disconnection. Page will reload in 2 seconds to clear all variables');
        setTimeout(() => location.reload(), 2000);
    }
};

const handleWeb3NetworkChange = function(networkID){
    notify('Blockchain: detected network change, new network ID is '+networkID);
    if(uiState.web3Ok && !chainIDs.ok){
        notify('Disconnection after network change');
        render();
    }
    if(!uiState.web3Ok && chainIDs.ok){
        notify('Refreshing UI after change to correct network')
        render();
    }
}

const initializeSmartContract = function(id){
    if(id == 'uoa'){
        contracts[id].methods.decimals().call().then(decimals => {token.decimalsFactor = toBN(10).pow(toBN(decimals));});
        contracts[id].methods.symbol().call().then(symbol => {token.symbol = symbol;});
        contracts[id].events.Transfer().on('data', event => {
            if(supplier.address != null && (compareAddresses(event.returnValues.from, supplier.address) || compareAddresses(event.returnValues.to, supplier.address))){
                notify('Token contract: transfer event - '+labelTokenAmount(event.returnValues.value / token.decimalsFactor)+' from '+event.returnValues.from+' to '+event.returnValues.to);
                loadBalance();
            }
        });
    }
    if(id == 'escrowPaymentSplitter'){
        contracts[id].events.WithdrawalAllowance().on('data', event => {
            if(supplier.address != null && compareAddresses(event.returnValues.recipient, supplier.address)){
                notify('Escrow payment splitter contract: withdrawal allowance event - '+labelTokenAmount(event.returnValues.balance / token.decimalsFactor));
                supplier.withdrawalAllowance = event.returnValues.balance;
                renderTokenBalances();
            }
        });
    }
};

const loadSupplierDetails = function(){
    let msgID = notify('API: loading supplier details for address '+supplier.address+' ... ');
    callAPI('supplier?address='+supplier.address).then(response => {
        if(response.success){
            notify('OK', msgID);
            handleSupplierSetup(response.supplier);
        }
        else notify('address not recognized as supplier, please register', msgID);
        render();
    }).catch((error) => notify('Failure: '+error, msgID, true));
};

const registerSupplier = function(){
    let supplierID = document.querySelector('input[name="supplierSelection"]:checked').value;
    let msgID = notify('API: register address as supplier '+suppliers[supplierID].name+' ... ');
    callAPI('supplier/register', {method: 'POST', body: {address: supplier.address, supplierID}}).then(response => {
        if(response.success){
            notify('OK', msgID);
            handleSupplierSetup({id: supplierID, name: suppliers[supplierID].name});
        }
        else notify('Backend failure', msgID, true);
        render();
    }).catch(error => notify('Failure '+error, msgID, true));
};

const handleSupplierSetup = function(data){
    supplier.id = data.id;
    supplier.name = data.name;
    renderSupplierDetails();
    loadSupplierData();
};

const loadSupplierData = function(){
    loadBalance();
    loadWithdrawalAllowance();
    loadParts();
    loadOrders();
    setInterval(function(){loadOrders();}, 30000);
};

const loadBalance = function(){
    let msgID = notify('Token contract: updating balance ...');
    contracts['uoa'].methods.balanceOf(supplier.address).call().then(balance => {
        notify('OK', msgID);
        supplier.tokenBalance = balance != null ? balance : 0;
        renderTokenBalances();
    }).catch(error => notify('Error: '+error.message, msgID, true));
};

const loadWithdrawalAllowance = function(){
    let msgID = notify('Escrow payment splitter contract: updating withdrawal balance ...');
    contracts['escrowPaymentSplitter'].methods.recipientFunds(supplier.address).call().then(contractBalance => {
        supplier.withdrawalAllowance = contractBalance;
        renderTokenBalances();
    }).catch(error => notify('Error: '+error.message, msgID, true));
};

const loadParts = function(){
    let msgID = notify('API: loading parts ...');
    callAPI('parts?supplierID='+supplier.id).then((response) => {
        if(response.success){
            notify('OK - '+response.parts.length+' part(s) received', msgID);
            for(let part of response.parts){
                parts[part.id] = part;
            }
            renderParts();
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => notify('Failure '+error, msgID, true));
};

const loadOrders = function(){
    let msgID = notify('API: loading orders ...');
    callAPI('supplier/orders?supplierID='+supplier.id).then(response => {
        if(response.success){
            notify('OK - '+response.orders.length+' order(s) received', msgID);
            for(let order of response.orders){
                order.amountEscrowed = null;
                order.suppliedValue = 0;
                for(let component of order.suppliedComponents){order.suppliedValue += Number(component.price);}
                orders[order.id] = order;
                if(order.state == 'awaiting funding allowance' || order.state == 'awaiting goods'){loadEscrowedAmount(order.id);}
            }
            renderOrders();
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => {notify('Failure '+error, msgID, true); console.log(error);});
};

const loadEscrowedAmount = function(orderID){
    let msgID = notify('Escrow payment splitter contract: reading escrowed value for order ID '+orderID+' ... ');
    contracts['escrowPaymentSplitter'].methods.getEscrowedValue(orders[orderID].escrowSlotId).call({from: supplier.address}).then(value => {
        notify('OK', msgID);
        orders[orderID].amountEscrowed = value / token.decimalsFactor;
        try{setElementText('amountEscrowed'+orderID, renderEscrowState(orderID));}
        catch(error){};
    }).catch(error => notify('Failure '+error, msgID, true));
};

const withdrawReceivedFunds = function(){
    withdrawing = true;
    renderTokenBalances();
    let msgID = notify('Blockchain: withdrawing received funds from escrow payment splitter contract ... ');
    contracts['escrowPaymentSplitter'].methods.withdrawReceivedFunds().send({from: supplier.address}).then(() => {
        notify('OK', msgID);
        withdrawing = false;
        renderTokenBalances();
    }).catch(error => {
        notify(error.message, msgID, true);
        withdrawing = false;
        renderTokenBalances();
    });
}

const render = function(){
    uiState.web3Ok = chainIDs.ok && supplier.address != null;
    if(uiState.web3Ok){
        supplier.name != null ? setElementsVisibility(['page', 'accountDetails'], ['walletInitialization', 'registration']) : setElementsVisibility('registration', ['page', 'accountDetails', 'walletInitialization']);
    }
    else {
        setButtonStatus('walletConnectionButton', typeof(web3) == 'object');
        setElementsVisibility('walletInitialization', ['page', 'accountDetails', 'registration']);
    }
};

const renderSupplierOptions = function(){
    let supplierList = document.getElementById('supplierNames');
    for(let i in suppliers){
        let option = createTag('input', {type: 'radio', id: 'supplierOption'+i, name: 'supplierSelection', value: suppliers[i].id});
        let label = createTag('label', {for: 'supplierOption'+i});
        setElementText(label, suppliers[i].name);
        supplierList.appendChild(option);
        supplierList.appendChild(label);
    }
};

const renderSupplierDetails = function(){
    setElementText('supplierAddress', supplier.address);
    setElementText('supplierName', supplier.name);
};

const renderTokenBalances = function(){
    if(supplier.tokenBalance != null){setElementText('balance', labelTokenAmount(supplier.tokenBalance / token.decimalsFactor));}
    if(supplier.withdrawalAllowance != null){setElementText('withdrawalAllowance', labelTokenAmount(supplier.withdrawalAllowance / token.decimalsFactor));}
    setButtonStatus('withdrawalButton', supplier.withdrawalAllowance > 0 && !withdrawing);
    setElementVisibility('withdrawalNotification', withdrawing);
};

const renderParts = function(){
    let table = document.createElement('table');
    table.appendChild(new TableRow(true).addRowspanCells(['Name', 'Unit price'], 2).addColspanCell('Linked item', 3).element);
    table.appendChild(new TableRow(true).addCells(['ID', 'Name', 'Amount']).element);
    for(let partID in parts){
        let part = parts[partID];
        let row = new TableRow().addRowspanCell(part.name, Object.keys(part.items).length).addRowspanCell(labelTokenAmount(part.price), Object.keys(part.items).length);
        let i = 0;
        for(let itemID in part.items){
            if(i != 0){row = new TableRow();}
            row.addCells([itemID, part.items[itemID].name, part.items[itemID].amount]);
            table.appendChild(row.element);
            i++;
        }
    }
    resetElement('parts', table);
};

const renderOrders = function(){
    let nbOrders = Object.keys(orders).length;
    if(nbOrders > 0){
        let table = createTag('table', {id: 'ordersTable'});
        table.appendChild(new TableRow(true).addRowspanCells(['ID', 'Customer'], 2).addColspanCell('Item', 2).addRowspanCell('Order size', 2).addColspanCell('Part', 5).addRowspanCells(['Order value', 'State', 'Amount escrowed ?'], 2).element);
        table.appendChild(new TableRow(true).addCells(['ID', 'Name', 'ID', 'Name', 'Unit price', 'Amount in item / order', 'Position value']).element);
        for(let orderID in orders){
            let order = orders[orderID];
            let row = new TableRow().addRowspanCells([orderID, order.customerName, order.itemID, parts[order.suppliedComponents[0].partID].items[order.itemID].name, order.amount], order.suppliedComponents.length);
            let i = 0; 
            for(let suppliedPart of order.suppliedComponents){
                if(i > 0){row = new TableRow();}
                row.addCells([suppliedPart.partID, parts[suppliedPart.partID].name, labelTokenAmount(parts[suppliedPart.partID].price), suppliedPart.amount+' / '+(suppliedPart.amount * order.amount), suppliedPart.price]);
                if(i == 0){
                    row.addRowspanCells([labelTokenAmount(order.suppliedValue), order.state], order.suppliedComponents.length);
                    row.addCell(renderEscrowState(orderID), cell => applyMultipleAttributes(cell, {id: 'amountEscrowed'+orderID, rowspan: order.suppliedComponents.length}));
                }
                table.appendChild(row.element);
                i++;
            }
        }
        resetElement('orders', table);
    }
    setElementVisibility('noOrderText', nbOrders == 0);
}

const renderEscrowState = function(orderID){
    if(orders[orderID].state == 'concluded'){return '-';}
    return orders[orderID].amountEscrowed != null ? (orders[orderID].amountEscrowed >= orders[orderID].suppliedValue ? 'Yes' : 'No')+' ('+orders[orderID].amountEscrowed+')' : '?';
}