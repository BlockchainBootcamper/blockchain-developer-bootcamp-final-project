const UoA = artifacts.require("UoA");
const EscrowPaymentSplitter = artifacts.require("EscrowPaymentSplitter");

module.exports = async function (deployer) {
    await deployer.deploy(UoA);
    let uoa = await UoA.deployed();
    await deployer.deploy(EscrowPaymentSplitter, uoa.address);
};  