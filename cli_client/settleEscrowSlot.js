const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    if(typeof(process.argv[2]) == 'undefined'){
        throw Error('Please provide the settler\'s account ID as first parameter');
    }
    if(typeof(process.argv[3]) == 'undefined'){
        throw Error('Please provide the escrow slot ID as second parameter');
    }
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    let addr = await settings.getAccountAddress(process.argv[2]);
    console.log('Settling escrow slot with ID '+process.argv[3]+' from account '+process.argv[2]+' (address '+addr+')');
    await escrowPaymentSplitter.contract.methods.settleEscrowSlot(process.argv[3]).send({from: addr, gasLimit: 200000});
    console.log('Ok');
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});