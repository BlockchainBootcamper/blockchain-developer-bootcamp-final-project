var express = require('express');
var router = express.Router();
const configuration = require('../configuration');
const {suppliers} = require('../data');

router.get('/', function(req, res, next) {
  res.render('index', {title: 'Supply service consolidation'});
});

router.get('/customer', function(req, res, next) {
  res.render('customer', {title: 'Supplier consolidation service - Customer dApp', currencyDecimals: configuration.currencyDecimals});
});

router.get('/supplier', function(req, res, next) {
  res.render('supplier', {title: 'Supplier consolidation service - Supplier dApp', currencyDecimals: configuration.currencyDecimals, suppliers: JSON.stringify(suppliers)});
});

module.exports = router;
