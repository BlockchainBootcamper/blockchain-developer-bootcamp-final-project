const {initialize} = require('./settings');
let {settings, Web3Helper} = initialize();

(async () => {
    await Web3Helper.checkConnection().catch(e => {throw Error('Web3 provider connection failed');});
    if(typeof(process.argv[2]) == 'undefined'){
        throw Error('Please provide a escrow slot ID as first parameter');
    }
    const escrowPaymentSplitter = await Web3Helper.getContract('escrowPaymentSplitter');
    let psd = await escrowPaymentSplitter.contract.methods.getPaymentSplittingDefition(process.argv[2]).call();
    let val = 0;
    for(let i = 0; i < psd.recipients.length; i++){
        console.log((i + 1)+': '+psd.recipients[i]+' - '+psd.amounts[i]+' UoA');
        val += parseInt(psd.amounts[i]);
    }
    console.log('Total escrow slot amount: '+val+' UoA');
    Web3Helper.cleanup();
})().catch(error => {
    settings.debug ? console.error(error) : console.log('Fatal error: '+error.message);
    Web3Helper.cleanup();
});