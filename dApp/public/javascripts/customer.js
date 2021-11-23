var contracts = {uoa: null, escrowPaymentSplitter: null};

var customer = {address: null, name: null, tokenBalance: null};
var items = {};
var orders = {};
var orderEscrowSlotIndex = {};
var token = {decimalsFactor: null, isMinting: false, symbol: null};

window.onload = function(){
    onLoadHandler(initializeSmartContract);
    setElementVisibility('initializationMessage', false);
    render();
}

const handleWeb3AccountsEvent = function(accounts){
    customer.address = Array.isArray(accounts) && accounts.length ? accounts[0] : null;
    if(customer.address != null){
        loadCustomerDetails();
    }
    else {
        render();
        clearActivityStream();
        notify('Activity stream cleared on wallet disconnection');
        setTimeout(() => location.reload(), 2000);
    }
}

const initializeSmartContract = function(id){
    if(id == 'uoa'){
        contracts[id].methods.decimals().call().then(decimals => {token.decimalsFactor = toBN(10).pow(toBN(decimals));});
        contracts[id].methods.symbol().call().then(symbol => {token.symbol = symbol;});
        contracts[id].events.Transfer().on('data', event => {
            if(customer.address != null && compareAddresses(event.returnValues.from, '0x0000000000000000000000000000000000000000') && compareAddresses(event.returnValues.to, customer.address)){token.isMinting = false;}
            if(customer.address != null && (compareAddresses(event.returnValues.from, customer.address) || compareAddresses(event.returnValues.to, customer.address))){
                //notify('Token contract: transfer event - '+labelTokenAmount(event.returnValues.value, true)+' from '+event.returnValues.from+' to '+event.returnValues.to);
                notify('Token contract: transfer event - '+labelTokenAmount(event.returnValues.value / token.decimalsFactor)+' from '+event.returnValues.from+' to '+event.returnValues.to);
                loadBalance();
                render('token');
            }
        });
    }
    if(id == 'escrowPaymentSplitter'){
        contracts[id].events.EscrowSlotOpened().on('data', event => {
            if(typeof(orders[event.returnValues.externalId]) != 'undefined'){
                notify('Escrow payment splitter contract: escrow slot opened event - order ID '+event.returnValues.externalId+' has slot ID '+event.returnValues.slotId);
                orders[event.returnValues.externalId].escrowSlotId = event.returnValues.slotId;
                orderEscrowSlotIndex[event.returnValues.slotId] = event.returnValues.externalId;
                handleOrderStateTransition(event.returnValues.externalId, 'awaiting funding');
            }
        });
        contracts[id].events.EscrowSlotFilled().on('data', event => {
            if(typeof(orderEscrowSlotIndex[event.returnValues.slotId]) != 'undefined'){
                notify('Escrow payment splitter contract: escrow slot filled event - slot ID '+event.returnValues.slotId+ ' (order ID '+orders[orderEscrowSlotIndex[event.returnValues.slotId]].id+') filled');
                handleOrderStateTransition(orders[orderEscrowSlotIndex[event.returnValues.slotId]].id, 'awaiting goods');
            }
        });
        contracts[id].events.EscrowSlotSettled().on('data', event => {
            if(typeof(orderEscrowSlotIndex[event.returnValues.slotId]) != 'undefined'){
                notify('Escrow payment splitter contract: escrow slot settled event - slot ID '+event.returnValues.slotId+ ' (order ID '+orders[orderEscrowSlotIndex[event.returnValues.slotId]].id+') settled');
                handleOrderStateTransition(orders[orderEscrowSlotIndex[event.returnValues.slotId]].id, 'concluded');
            }
        });
    }
}

const loadCustomerDetails = function(){
    let msgID = notify('API: loading customer details ...');
    callAPI('customer?address='+customer.address).then(response => {
        if(response.success){
            notify('OK', msgID);
            customer.name = response.customer.name;
            render('customerDetails');
            loadCustomerData();
        }
        else notify('address not recognized as customer, please register', msgID);
        render();
    }).catch((error) => notify('Failure: '+error, msgID, true));
}

const loadCustomerData = function(){
    loadBalance();
    loadItems().then(() => loadOrders());
}

const loadBalance = function(){
    let msgID = notify('Token contract: updating balance ...');
    contracts['uoa'].methods.balanceOf(customer.address).call().then(balance => {
        notify('OK', msgID);
        customer.tokenBalance = balance != null ? balance : 0;
        render('token');
        for(let orderID in orders){
            if(orders[orderID].state == 'unconfirmed' || orders[orderID].state == 'confirming' || orders[orderID].state == 'confirmed'){
                renderOrder(orderID, true);
            }
        }
    }).catch(error => notify('Failure '+error, msgID, true));
}

const loadItems = function(){
    let msgID = notify('API: loading items ...');
    return callAPI('items?address='+customer.address).then((response) => {
        if(response.success){
            notify('OK - '+Object.keys(response.items).length+' item(s) received', msgID);
            items = response.items;
            renderItems();
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => notify('Failure '+error, msgID, true));
}

const loadOrders = function(){
    let msgID = notify('API: loading orders ...');
    callAPI('customer/orders?address='+customer.address).then(response => {
        if(response.success){
            notify('OK - '+response.orders.length+' order(s) received', msgID);
            console.log(response.orders);
            for(let order of response.orders){
                orders[order.id] = order;
                if(order.state != 'concluded' && order.escrowSlotId != null){
                    orderEscrowSlotIndex[order.escrowSlotId] = order.id;
                }
            }
            renderOrders();
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => notify('Failure '+error, msgID, true));
}

const registerCustomer = function(){
    let msgID = notify('API: register address as customer ...');
    callAPI('customer/register', {method: 'POST', body: {address: customer.address, name: document.getElementById('customerNameInput').value}}).then(response => {
        if(response.success){
            notify('OK', msgID);
            customer.name = document.getElementById('customerNameInput').value;
            render('customerDetails');
            loadCustomerData();
        }
        else notify('Backend failure', msgID, true);
        render();
    }).catch(error => notify('Failure '+error, msgID, true));
}

const mint = function(){
    let msgID = notify('API: minting '+document.getElementById('amountOfUoA').value+' '+token.symbol+' ...');
    callAPI('mint', {method: 'POST', body: {address: customer.address, amount: document.getElementById('amountOfUoA').value}}).then(response => {
        if(response.success){
            notify('OK', msgID);
            clearInput('amountOfUoA');
            token.isMinting = true;
            render('token');
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => notify('Failure '+error, msgID, true));
}

const order = function(itemID){
    let orderSize = document.getElementById('itemAmount'+itemID).value;
    let msgID = notify('API: ordering '+orderSize+' x '+items[itemID].name+' ...');
    disableButton('orderButtonItem'+itemID);
    callAPI('order', {method: 'POST', body: {address: customer.address, itemID, amount: orderSize}}).then(response => {
        if(response.success){
            notify('OK', msgID);
            clearInput('itemAmount'+itemID);
            enableButton('orderButtonItem'+itemID);
            orders[response.order.id] = response.order;
            orders[response.order.id].itemID = itemID;
            orders[response.order.id].amount = orderSize;
            //orders[response.order.id].state = 'opening escrow slot';
            orders[response.order.id].state = 'unconfirmed';
            addOrderToUI(response.order.id);
        }
        else notify('Backend failure', msgID, true);
    }).catch(error => notify('Failure '+error, msgID, true));
}

const confirmOrder = function(orderID){
    //let msgID = notify('Blockchain: confirming order ID '+orderID+', allowing escrow smart contract to collect the involved amount ...');
    //let revert = handleOrderStateTransition(orderID, 'confirming', 'confirmOrder'+orderID);
    //contracts['uoa'].methods.approve(contracts['escrowPaymentSplitter']._address, orders[orderID].escrowAmount).send({from: customer.address}).then(response => {
        //notify('OK', msgID);
        let msgID = notify('API: confirming order '+orderID+' ...');
        callAPI('order/confirm', {method: 'POST', body: {orderID}}).then(notify('OK - will open escrow slot', msgID)).catch(error => notify('Failure - '+error.message, msgID, true));
        handleOrderStateTransition(orderID, 'opening escrow slot');
        //if(enoughFunds(orderID)){fillEscrowSlot(orderID);}
    //}).catch(error => {
        //notify('Failure - '+error.message, msgID, true);
        //revert();
    //});
}

const fund = function(orderID){
    let msgID = notify('Blockchain: allowing escrow smart contract to collect the involved amount for '+orderID+' ...');
    let revert = handleOrderStateTransition(orderID, 'funded', 'fundEscrowSlotOrder'+orderID);
    contracts['uoa'].methods.approve(contracts['escrowPaymentSplitter']._address, orders[orderID].escrowAmount).send({from: customer.address}).then(response => {
        notify('OK', msgID);
        //let msgID = notify('API: confirming order '+orderID+' ...');
        //callAPI('order/confirm', {method: 'POST', body: {orderID}}).then(notify('OK - will open escrow slot', msgID)).catch(error => notify('Failure - '+error.message, msgID, true));
        //handleOrderStateTransition(orderID, 'opening escrow slot');
        //if(enoughFunds(orderID)){fillEscrowSlot(orderID);}
    }).catch(error => {
        notify('Failure - '+error.message, msgID, true);
        revert();
    });
}

const fillEscrowSlot = function(orderID){
    let msgID = notify('Blockchain: escrowing funds for order ID '+orderID+' ...');
    let revert = handleOrderStateTransition(orderID, 'escrowing funds', 'escrowOrderFunds'+orderID);
    contracts['escrowPaymentSplitter'].methods.fillEscrowSlot(orders[orderID].escrowSlotId).send({from: customer.address}).then(() => {
        notify('OK', msgID);
        handleOrderStateTransition(orderID, 'awaiting goods');
    }).catch(error => {
        notify('Failure - '+error.message, msgID, true);
        revert();
    });
    
}

const settleEscrowSlot = async function(orderID){
    let msgID = notify('Blockchain: settling payments linked to escrow slot for order ID '+orderID+' ...');
    let revert = handleOrderStateTransition(orderID, 'settling escrow', 'settleEscrow'+orderID);
    contracts['escrowPaymentSplitter'].methods.settleEscrowSlot(orders[orderID].escrowSlotId).send({from: customer.address}).then(() => {
        notify('OK', msgID);
        handleOrderStateTransition(orderID, 'concluded');
    }).catch((error) => {
        notify('Failure - '+error.message, msgID, true);
        revert();
    });
}

// Rendering utils
const render = function(part = null){
    if(part == 'token'){
        if(customer.tokenBalance != null && token.decimalsFactor != null && token.symbol != null){setElementText('balance', labelTokenAmount(customer.tokenBalance / token.decimalsFactor));}
        setButtonStatus('mintingButton', !token.isMinting);
        setElementVisibility('mintingNotification', token.isMinting);
    }
    if(part == 'customerDetails'){
        setElementText('customerAddress', customer.address);
        if(customer.name != null){setElementText('customerName', customer.name);}
    }
    if(part == null){
        if(typeof(web3) == 'object'){
            enableButton('walletConnectionButton');
            if(customer.address != null){
                customer.name != null ? setElementsVisibility(['page', 'accountDetails'], ['walletInitialization', 'registration']) : setElementsVisibility('registration', ['page', 'accountDetails', 'walletInitialization']);
            }
            else setElementsVisibility('walletInitialization', ['page', 'accountDetails', 'registration']);
        }
        else {
            disableButton('walletConnectionButton');
            setElementsVisibility('walletInitialization', ['page', 'accountDetails', 'registration']);
        }
    }
}

const renderItems = function(){
    let table = document.createElement('table');
    table.appendChild(new TableRow(true).addRowspanCell('Name', 2).addColspanCell('Component', 4).addRowspanCell('Item price', 2).addRowspanCell('', 2).element);
    table.appendChild(new TableRow(true).addCells(['Name', 'Supplier', 'Unit price', 'Amount']).element);
    for(let itemID in items){
        let itemRows = renderItem(items[itemID]);
        for(i = 0; i < itemRows.length; i++){
            table.appendChild(itemRows[i].element);
        }
    }
    resetElement(document.getElementById('items'), table);
}

const renderItem = function(item){
    let itemPrice = 0;
    let trs = new Array();
    let nbComponents = item.composition.length
    let tr = new TableRow().addRowspanCell(item.name, nbComponents);
    for(let i = 0; i < item.composition.length; i++){
        if(i > 0){
            tr = new TableRow();
        }
        tr.addCells([item.composition[i].part.name, item.composition[i].part.supplierName, labelTokenAmount(item.composition[i].part.price), item.composition[i].amount]);
        trs.push(tr);
        itemPrice += item.composition[i].amount * item.composition[i].part.price;
    }
    trs[0].addRowspanCell(labelTokenAmount(itemPrice), nbComponents).addRowspanCell([createTag('input', {id: 'itemAmount'+item.id, size: 7, type: 'number', placeholder: 'amount'}), ' \xa0 ', createButton('order', {id: 'orderButtonItem'+item.id, onclick: 'order('+item.id+')'})], nbComponents);
    return trs;
}

const renderOrders = function(){
    let nbOrders = Object.keys(orders).length;
    if(nbOrders > 0){
        let table = createTag('table', {id: 'ordersTable'});
        table.appendChild(new TableRow(true).addCells(['Order ID', 'Item ID', 'Amount', 'Part value', 'Fees', 'Total', 'State', '']).element);
        for(let orderID in orders){
            table.appendChild(renderOrder(orderID).element);
        }
        resetElement(document.getElementById('orders'), table);
    }
    setElementVisibility('noOrderText', nbOrders == 0);
}

const renderOrder = function(orderID, refreshOwnRow = false){
    let order = orders[orderID];
    let state = [], buttons = [];
    //if(order.state != 'opening escrow slot' && order.state != 'concluded'){
    if(order.state != 'unconfirmed' && order.state != 'opening escrow slot' && order.state != 'concluded'){
        buttons.push(createButton('See payment splitting', {onclick: 'showPaymentSplittingDefinition('+order.id+')', style:'margin-right: 30px'}));
    }
    if(order.state == 'unconfirmed' || order.state == 'confirming'){
        //buttons.push(createButton(enoughFunds(orderID) ? 'Confirm & fund order' : 'Confirm order', {id: 'confirmOrder'+orderID, onclick: 'confirmOrder('+orderID+')'}, order.state == 'confirming'));
        buttons.push(createButton('Confirm order', {id: 'confirmOrder'+orderID, onclick: 'confirmOrder('+orderID+')'}, order.state == 'confirming'));
    }
    if(order.state == 'awaiting funding' || order.state == 'escrowing funds'){
        //let notEnoughFunds = !enoughFunds(orderID);
        //buttons.push(createButton('Escrow funds', {id: 'escrowOrderFunds'+orderID, onclick: 'fillEscrowSlot('+orderID+')'}, order.state == 'escrowing funds' || notEnoughFunds));
        //if(notEnoughFunds){buttons.push(' (not enough funds)')}
        buttons.push(createButton('Fund escrow slot', {id: 'fundEscrowSlotOrder'+orderID, onclick: 'fund('+orderID+')'}, order.state == 'escrowing funds'));
    }
    if(order.state == 'awaiting goods'|| order.state == 'settling escrow'){
        buttons.push(createButton('Confirm goods reception', {id: 'settleEscrow'+orderID, onclick: 'settleEscrowSlot('+orderID+')'}, order.state == 'settling escrow'));
    }
    if(order.state == 'opening escrow slot' || order.state == 'funding' || order.state == 'escrowing funds' || order.state == 'settling escrow'){
        state.push(createTag('img', {src: "images/loading.gif", width: 20, class: "spinner"}));
    }
    state.push(order.state);
    let row = new TableRow(false, {id: 'order'+orderID+'Row'}).addCells([order.id, items[order.itemID].name+' (ID '+order.itemID+')', order.amount, labelTokenAmount(order.partsTotalPrice), labelTokenAmount(order.fees), labelTokenAmount(order.partsTotalPrice + order.fees), state, buttons]);
    if(refreshOwnRow){document.getElementById('order'+orderID+'Row').replaceWith(row.element);}
    return row;
}

const addOrderToUI = function(orderID){
    if(Object.keys(orders).length == 1){renderOrders();}
    else document.getElementById('ordersTable').appendChild(renderOrder(orderID).element);
}

const handleOrderStateTransition = function(orderID, newState, buttonToDisable = null){
    let currentState = orders[orderID].state, revertor;
    if(buttonToDisable != null){disableButton(buttonToDisable);}
    // Thre's no need to re-eanble the button in the revert because the renderOrder switched back to the old state is going to render the button as active already
    revertor = function(){handleOrderStateTransition(orderID, currentState);};
    orders[orderID].state = newState;
    renderOrder(orderID, true);
    return revertor;
}

const showPaymentSplittingDefinition = function(orderID){
    let msgID = notify('Blockchain: reading payment splitting definition for order ID '+orderID+' ...');
    contracts['escrowPaymentSplitter'].methods.getPaymentSplittingDefition(orders[orderID].escrowSlotId).call().then((paymentSplittingDefinition) => {
        notify('OK', msgID);
        let table = createTag('table', {id: 'ordersTable'});
        table.appendChild(new TableRow(true).addCells(['Recipient', 'Amount']).element);
        for(let i = 0; i < paymentSplittingDefinition.recipients.length; i++){
            table.appendChild(new TableRow().addCells([paymentSplittingDefinition.recipients[i], labelTokenAmount(paymentSplittingDefinition.amounts[i] / token.decimalsFactor)]).element);
        }
        resetElement(document.getElementById('popupContent'), table);
        document.getElementById('modalLayer').style.display = 'block';
    }).catch(error => notify('Failure - '+error.message, msgID, true));
}

// Utils
const enoughFunds = function(orderID){
    // note: comparison for enough funds has to happen in BN because string compare doesn't work
    return toBN(customer.tokenBalance).gte(toBN(orders[orderID].escrowAmount));
}