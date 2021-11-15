const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    if(typeof(process.argv[2]) == 'undefined'){
        throw Error('Please provide the escrow slot ID as second parameter');
    }
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    console.log('Checking fill status for escrow slot with ID '+process.argv[2]);
    console.log('Slot status:', (await escrowPaymentSplitter.contract.methods.isEscrowSlotFilled(process.argv[2]).call() ? 'is filled' : 'is not filled'));
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});