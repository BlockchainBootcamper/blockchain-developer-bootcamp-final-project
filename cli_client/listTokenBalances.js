const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();
    
(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    const uoa = await Web3Helper.getContract('UoA');
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    let accountIDs = await settings.getAccountIDs();
    for(let i = 0; i < accountIDs.length; i++){
        let addr = await settings.getAccountAddress(accountIDs[i]);
        console.log(accountIDs[i]+' ('+addr+'): '+(await uoa.contract.methods.balanceOf(addr).call()));
    }
    console.log('Escrow payment splitter contract: '+(await uoa.contract.methods.balanceOf(escrowPaymentSplitter.address).call()));
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});