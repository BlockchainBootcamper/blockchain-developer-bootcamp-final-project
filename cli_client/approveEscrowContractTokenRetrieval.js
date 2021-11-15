const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    if(typeof(process.argv[2]) == 'undefined'){
        throw Error('Please provide a account ID as first parameter');
    }
    if(typeof(process.argv[3]) == 'undefined'){
        throw Error('Please provide an amount to mint as second parameter');
    }
    const uoa = await Web3Helper.getContract('UoA');
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    let addr = await settings.getAccountAddress(process.argv[2]);
    console.log('Account '+process.argv[2]+' (address '+addr+') allows EscrowPaymentSplitter contract to transfer '+process.argv[3]+' UoA');
    await uoa.contract.methods.approve(escrowPaymentSplitter.address, process.argv[3]).send({from: addr});
    console.log('Ok');
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});