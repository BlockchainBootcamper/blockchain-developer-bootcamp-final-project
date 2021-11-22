var express = require('express');
var router = express.Router();

var Web3 = require('web3');
var path = require('path');
const fs = require('fs');
const {suppliers, parts, items} = require('../data');
const configuration = require('../configuration');

// *** State
var contractArtifacts = {};
var contracts = {};
var customers = {};
// suppliers object, imported
var orders = {};
var currencyDecimalsFactor = Math.pow(10, configuration.currencyDecimals);
var coinDecimalsAdjustedFactor = 0;     // Note: differential between the currencyDecimalsFactor and the coin decimals, see rebaseToTokenDecimals()

// *** Database emulation artifacts
var nextOrderId = 1;
var customerOrderIndex = {};            // Maps address to array of order IDs
var orderEscrowSlotIndex = {};
var supplierAddressIndex = {};          // Maps address to supplier ID
var supplierOrderIndex = {};            // Maps supplier ID to array of order IDs
var supplierPartIndex = {};             // Maps supplier ID to array of parts

const rebaseToTokenDecimals = function(amount){
    // The split is necessary because BN.js doesn't support beeing created from numbers with decimals => first use currencyDecimalsFactor to bring the number to an integer + coinDecimalsAdjustedFactor to convert to the coinbase
    return web3.utils.toBN(parseInt(amount * currencyDecimalsFactor)).mul(coinDecimalsAdjustedFactor);
}

// Initialize
var web3 = new Web3(configuration.web3ProviderURL);
for(let contractID in configuration.contracts){
    contractArtifacts[contractID] = JSON.parse(fs.readFileSync(path.join(__dirname, configuration.contractArtifactsFolderRelativePath, configuration.contracts[contractID].artifactFilename+'.json')).toString());
    contracts[contractID] =  new web3.eth.Contract(contractArtifacts[contractID].abi, configuration.contracts[contractID].address);
}
contracts['uoa'].methods.decimals().call().then((decimals) => {coinDecimalsAdjustedFactor = web3.utils.toBN(10).pow(web3.utils.toBN(decimals - configuration.currencyDecimals));}); 

for(let itemID in items){
    for(let i = 0; i < items[itemID].composition.length; i++){
        items[itemID].composition[i].part.supplierName = suppliers[items[itemID].composition[i].part.supplierID].name;
    }
}

for(let supplierID in suppliers){
    supplierOrderIndex[supplierID] = [];
    supplierPartIndex[supplierID] = [];
}

for(let partID in parts){
    supplierPartIndex[parts[partID].supplierID].push(parts[partID]);
    parts[partID].items = {};
    for(let itemLinkIdx in parts[partID].itemLinks){
        parts[partID].items[parts[partID].itemLinks[itemLinkIdx].itemID] = {name: items[parts[partID].itemLinks[itemLinkIdx].itemID].name, amount: parts[partID].itemLinks[itemLinkIdx].amount};
    }
}

contracts['escrowPaymentSplitter'].events.EscrowSlotFilled().on('data', event => {
    if(typeof(orderEscrowSlotIndex[event.returnValues.slotId]) != 'undefined'){
        orders[orderEscrowSlotIndex[event.returnValues.slotId]].state = 'awaiting goods';
    }
});
contracts['escrowPaymentSplitter'].events.EscrowSlotSettled().on('data', event => {
    if(typeof(orderEscrowSlotIndex[event.returnValues.slotId]) != 'undefined'){
        orders[orderEscrowSlotIndex[event.returnValues.slotId]].state = 'concluded';
    }
});

router.get('/contractDetails', function(req, res, next) {
    if(typeof(req.query.name) == 'undefined' || typeof(contractArtifacts[req.query.name]) == 'undefined'){
        res.send({success: false});
    }
    else res.send({success: true, abi: contractArtifacts[req.query.name].abi, address: configuration.contracts[req.query.name].address});
});

router.post('/order', async function(req, res, next) {
    let {orderPositions, amountsPerSuppliers} = items[req.body.itemID].computeOrderDetails(req.body.amount);
    let fees = 3.3;
    let orderID = nextOrderId++;

    let paymentSplittingDefinition = {recipients: [], amounts: []};
    let partsTotalPrice = 0;
    for(supplierId in amountsPerSuppliers){
        paymentSplittingDefinition.recipients.push(suppliers[supplierId].address);
        paymentSplittingDefinition.amounts.push(rebaseToTokenDecimals(amountsPerSuppliers[supplierId]).toString());
        supplierOrderIndex[supplierId].push(orderID);
        partsTotalPrice += amountsPerSuppliers[supplierId];
    }
    let accounts = await web3.eth.getAccounts();        // TODO
    
    paymentSplittingDefinition.recipients.push(accounts[0]);
    paymentSplittingDefinition.amounts.push(rebaseToTokenDecimals(fees).toString());
    
    
    let escrowAmount = rebaseToTokenDecimals(partsTotalPrice + fees).toString();
    orders[orderID] = {id: orderID, customerAddress: req.body.address, itemID: req.body.itemID, amount: req.body.amount, positions: orderPositions, escrowSlotId: null, partsTotalPrice, fees, escrowAmount, state: 'opening escrow slot'};
    customerOrderIndex[req.body.address].push(orderID);
    
    contracts['escrowPaymentSplitter'].methods.openEscrowSlot(orderID, paymentSplittingDefinition).send({from: accounts[0], gasLimit: 300000}).then((response) => {
        orders[orderID].escrowSlotId = response.events.EscrowSlotOpened.returnValues.slotId;
        orderEscrowSlotIndex[orders[orderID].escrowSlotId] = orderID;
        orders[orderID].state = 'unconfirmed';
    });
    res.send({success: true, order: {id: orderID, positions: orderPositions, partsTotalPrice, fees, escrowAmount: escrowAmount}});
});

router.post('/orderConfirmed', function(req, res, next) {
    orders[req.body.orderID].state = 'confirmed';
});

router.post('/mint', async function(req, res, next) {
    let accounts = await web3.eth.getAccounts();        // TODO
    contracts['uoa'].methods.mint(req.body.address, rebaseToTokenDecimals(req.body.amount)).send({from: accounts[0]})
    res.send({success: true});
});

// *** Customer handling
router.post('/customer/register', async function(req, res, next) {
    customers[req.body.address] = {name: req.body.name};
    customerOrderIndex[req.body.address] = [];
    res.send({success: true});
});

router.get('/customer', async function(req, res, next) {
    res.send(typeof(customers[req.query.address]) != 'undefined' ? {success: true, customer: customers[req.query.address]} : {success: false});
});

router.get('/items', function(req, res, next) {
    res.send({success: true, items});
});

router.get('/customer/orders', async function(req, res, next) {
    let customerOrders = [];
    for(let orderID of customerOrderIndex[req.query.address]){
        customerOrders.push(orders[orderID]);
    }
    res.send({success: true, orders: customerOrders});
});

router.post('/supplier/register', function(req, res, next) {
    suppliers[req.body.supplierID].address = req.body.address;
    supplierOrderIndex[req.body.address] = [];
    supplierAddressIndex[req.body.address] = req.body.supplierID;
    res.send({success: true});
});

router.get('/supplier', function(req, res, next) {
    res.send(typeof(supplierAddressIndex[req.query.address]) != 'undefined' ? {success: true, supplier: suppliers[supplierAddressIndex[req.query.address]]} : {success: false});
});

router.get('/parts', function(req, res, next) {
    res.send({success: true, parts: supplierPartIndex[req.query.supplierID]});
});

router.get('/supplier/orders', async function(req, res, next) {
    let supplierOrders = [];
    for(let orderID of supplierOrderIndex[req.query.supplierID]){
        let order = orders[orderID];
        order.customerName = customers[order.customerAddress].name;
        supplierOrders.push(order);
    }
    res.send({success: true, orders: supplierOrders});
});

module.exports = router;