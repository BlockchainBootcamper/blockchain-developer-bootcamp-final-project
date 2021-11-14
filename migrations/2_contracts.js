const UoA = artifacts.require("UoA");
const EscrowPaymentSplitter = artifacts.require("EscrowPaymentSplitter");

module.exports = function (deployer) {
    deployer.deploy(UoA);
    deployer.deploy(EscrowPaymentSplitter);
};  