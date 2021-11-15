const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    if(typeof(process.argv[2]) == 'undefined'){
        throw Error('Please provide the recipient\'s account ID as first parameter');
    }
    if(typeof(process.argv[3]) == 'undefined'){
        throw Error('Please provide the escrow slot ID as second parameter');
    }
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    let addr = await settings.getAccountAddress(process.argv[2]);
    console.log('Checking escrowed value in slot with ID '+process.argv[3]+' for account '+process.argv[2]+' (address '+addr+')');
    console.log('Escrowed value:', (await escrowPaymentSplitter.contract.methods.getEscrowedValue(process.argv[3]).call({from: addr})), 'UoA');
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});