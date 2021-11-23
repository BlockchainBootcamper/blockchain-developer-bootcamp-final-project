var express = require('express');
var router = express.Router();
const {VariableSharepoint} = require('../utilities');

var database = VariableSharepoint.get('database');
var blockchainClient = VariableSharepoint.get('blockchainClient');

router.get('/contractDetails', function(req, res, next) {
    let details = blockchainClient.getContractEssentials(req.query.name);
    res.send(details != null ? {success: true, abi: details.abi, address: details.address} : {success: false, errorMessage: 'contract '+req.query.name+' unknown'});
});

// *** Customer handling
router.post('/customer/register', async function(req, res, next) {
    database.createCustomer(req.body.address, req.body.name);
    res.send({success: true});
});

router.get('/customer', async function(req, res, next) {
    let customer = database.getCustomer(req.query.address);
    res.send(customer != null ? {success: true, customer} : {success: false, errorMessage: 'customer '+req.query.address+' unknown'});
});

router.get('/items', function(req, res, next) {
    res.send({success: true, items: database.getCustomerItems(req.query.address)});
});

router.get('/customer/orders', async function(req, res, next) {
    let orders = database.getCustomerOrders(req.query.address);
    for(let orderID in orders){orders[orderID].escrowAmount = blockchainClient.getContract('uoa').rebaseToTokenDecimals(orders[orderID].partsTotalPrice + orders[orderID].fees).toString()}
    res.send({success: true, orders: orders});
});

// *** Customer actions
router.post('/order', function(req, res, next) {
    let fees = 3.3;
    let partsTotalPrice = database.getItem(req.body.itemID).computeOrderPrice(req.body.amount);
    let orderID = database.createOrder(req.body.address, req.body.itemID, req.body.amount, partsTotalPrice, fees);
    res.send({success: true, order: {id: orderID, partsTotalPrice, fees, escrowAmount: blockchainClient.getContract('uoa').rebaseToTokenDecimals(partsTotalPrice + fees).toString()}});
});

router.post('/order/confirm', async function(req, res, next) {
    blockchainClient.handleEscrowSlotCreation(req.body.orderID);
    res.send({success: true});
});

router.post('/order/fundNext', async function(req, res, next) {
    blockchainClient.setNextOrderToFund(req.body.address, req.body.orderID);
    res.send({success: true});
});

router.post('/mint', async function(req, res, next) {
    blockchainClient.getContract('uoa').mint(req.body.address, req.body.amount);
    res.send({success: true});
});

// *** Supplier handling
router.post('/supplier/register', function(req, res, next) {
    res.send({success: true});
});

router.get('/supplier', function(req, res, next) {
    let supplier = database.getSupplierByAddress(req.query.address);
    res.send(supplier != null ? {success: true, supplier: supplier} : {success: false});
});

router.get('/parts', function(req, res, next) {
    res.send({success: true, parts: database.getSupplierParts(req.query.supplierID)});
});

router.get('/supplier/orders', async function(req, res, next) {
    res.send({success: true, orders: database.getSupplierOrders(req.query.supplierID)});
});

module.exports = router;