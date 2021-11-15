const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    await settings.asyncReady;      // waiting for settings.paymentSplitterDefinitionExample to be setup
    let contractOwnerAddress = await settings.getContractOwnerAddress();
    console.log('Opening escrow slot with payment splitter');
    console.log(settings.paymentSplitterDefinitionExample);
    let ret = await escrowPaymentSplitter.contract.methods.openEscrowSlot(settings.paymentSplitterDefinitionExample).send({from: contractOwnerAddress, gasLimit: 210000});
    console.log(ret);
    console.log('Ok');
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});