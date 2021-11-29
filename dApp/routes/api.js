var express = require('express');
const configuration = require('../configuration');
var router = express.Router();
const {VariableSharepoint} = require('../utilities');

var database = VariableSharepoint.get('database');
var blockchainClient = VariableSharepoint.get('blockchainClient');

router.get('/chainID', function(req, res, next) {
    res.send({success: true, chainID: blockchainClient.getChainID()});
});

router.get('/contractDetails', function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['name']);
        let details = blockchainClient.getContractEssentials(req.query.name);
        res.send(details != null ? {success: true, abi: details.abi, address: details.address} : {success: false, errorMessage: 'contract '+req.query.name+' unknown'});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/addressLabels', function(req, res, next) {
    try {
        let labels = database.getSupplierAddressLabels();
        labels[blockchainClient.getAccount().toLowerCase()] = 'Supply consolidation service';
        console.log(labels);
        res.send(labels =! null ? {success: true, labels} : {success: false});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

// *** Customer handling
router.post('/customer/register', async function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'name']);
        database.createCustomer(req.body.address, req.body.name);
        res.send({success: true});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/customer', async function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['address']);
        if(!database.isCustomerAddress(req.query.address)){throw new Error('Customer unknown');}
        res.send({success: true, customer: database.getCustomer(req.query.address)});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/items', function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['address']);
        if(!database.isCustomerAddress(req.query.address)){throw new Error('Customer unknown');}
        res.send({success: true, items: database.getCustomerItems(req.query.address)});     // Test/Demo: no filtering implemented, can't fail
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/customer/orders', async function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['address']);
        let orders = database.getCustomerOrders(req.query.address);
        if(orders == null){throw new Error('Attempt to load orders of unknown customer '+req.query.address);}
        for(let orderID in orders){
            orders[orderID].escrowAmount = blockchainClient.getContract('uoa').rebaseToTokenDecimals(orders[orderID].partsTotalPrice + orders[orderID].fees).toString();
        }
        res.send({success: true, orders: orders});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

// *** Customer actions
router.post('/order', function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'itemID', 'amount']);
        if(!database.isCustomerAddress(req.body.address)){throw new Error('Customer unknown');}
        let fees = Number((Math.random() * 10).toFixed(configuration.currencyDecimals));
        let item = database.getItem(req.body.itemID);
        if(item == null){throw new Error('Attempt to order unknown item');}
        let partsTotalPrice = item.computeOrderPrice(Number(req.body.amount));
        let orderID = database.createOrder(req.body.address, req.body.itemID, Number(req.body.amount), partsTotalPrice, fees);
        res.send({success: true, order: {id: orderID, partsTotalPrice, fees, escrowAmount: blockchainClient.getContract('uoa').rebaseToTokenDecimals(partsTotalPrice + fees).toString()}});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.post('/order/confirm', async function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'orderID']);
        database.isCustomerOrder(req.body.address, req.body.orderID);
        blockchainClient.handleEscrowSlotCreation(req.body.orderID);
        res.send({success: true});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.post('/order/nextFunding', async function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'orderID']);
        database.isCustomerOrder(req.body.address, req.body.orderID);
        database.setNextOrderToFund(req.body.address, req.body.orderID);
        res.send({success: true});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.post('/order/cancelFunding', async function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'orderID']);
        database.isCustomerOrder(req.body.address, req.body.orderID);
        database.resetNextOrderToFund(req.body.address, req.body.orderID);
        res.send({success: true});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.post('/mint', async function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'amount']);
        blockchainClient.getContract('uoa').mint(req.body.address, Number(req.body.amount));
        res.send({success: true});
    }
    catch(error){console.log(error); res.send({success: false, errorMessage: error});}
});

// *** Supplier handling
router.post('/supplier/register', function(req, res, next) {
    try {
        validateParameterExistence(req.body, ['address', 'supplierID']);
        database.updateSupplierAddress(req.body.supplierID, req.body.address.toLowerCase());
        res.send({success: true});
    }
    catch(error){res.send({success: false, errorMessage: error}); console.log(error);}
});

router.get('/supplier', function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['address']);
        let supplier = database.getSupplierByAddress(req.query.address.toLowerCase());
        res.send(supplier != null ? {success: true, supplier} : {success: false, errorMessage: 'Unknown supplier'});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/parts', function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['supplierID']);
        let parts = database.getSupplierParts(req.query.supplierID);
        res.send(parts != null ? {success: true, parts} : {success:false, errorMessage: 'No parts found'});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

router.get('/supplier/orders', async function(req, res, next) {
    try {
        validateParameterExistence(req.query, ['supplierID']);
        let orders = database.getSupplierOrders(req.query.supplierID);
        res.send(orders != null ? {success: true, orders} : {success:false, errorMessage: 'Supplier unknown, no order applicable'});
    }
    catch(error){res.send({success: false, errorMessage: error});}
});

validateParameterExistence = function(variable, attributesToCheck, shouldThrow = true){
    for(let attribute of attributesToCheck){
        if(typeof(variable[attribute]) == 'undefined'){
            if(shouldThrow){throw Error('Attribute '+attribute+' missing');}
            else return false;
        }
    }
    return true;
}

module.exports = router;