
const {default: Web3Helper} = require('./base/Web3Helper');

var settings = {
    web3ProviderURLs: {http: 'http://localhost:8545', websocket: 'ws://localhost:8545'},

    smartContractArtifactFilenames: {UoA: 'UoA', escrowPaymentSplitter: 'EscrowPaymentSplitter'},
    smartContractArtifactFolderRelativePath: '../build/contracts',

    debug: false,

    asyncReady: null,                       // TODO configure in initialize()
    paymentSplitterDefinitionExample: {}    // TODO configure in initialize()
}

module.exports = {
    initialize: function(){
        let scFilepaths = {}; 
        for(let scID in settings.smartContractArtifactFilenames){
            scFilepaths[scID] = __dirname+'/'+settings.smartContractArtifactFolderRelativePath+'/'+settings.smartContractArtifactFilenames[scID]+'.json';
        }
        Web3Helper.configure(settings.web3ProviderURLs, scFilepaths);

        /*
        Setup TODO: set up settings attributes asyncReady and paymentSplitterDefinitionExample as well as 3 methods
            1) getAccountIDs() - async function which shall return a Promise<Array<string>> which resolves to an array of strings with all account IDs
            2) getContractOwnerAddress() - async function which shall return the address which deployed/owns the UoA and EscrowPaymentSplitter smart-contracts
            3) getAccountAddress(id) - async function which accepts an account ID as parameter and returns the address

        Example below works for a Ganache setup (which provides 10 "unlocked" accounts unless configured otherwise)

        settings.ganacheAccountsIDs = ['supply_consolidator', 'customer1', 'customer2', 'supplier1', 'supplier2'];
        settings.getAccountAddress = async function(id){
            let accounts = await Web3Helper.web3.eth.getAccounts();
            for(let i = 0; i < settings.ganacheAccountsIDs.length; i++){
                if(settings.ganacheAccountsIDs[i] == id){
                    return accounts[i];
                }
            }
            throw Error('Account with ID '+id+' unknown');
        }

        // called by the listTokenBalances.js to get all involved account IDs
        settings.getAccountIDs = async function(){
            return Promise.resolve(settings.ganacheAccountsIDs);
        }

        // called by mintToken.js and openEscrowSlot.js to get the address of the contract owner, which is the only one to be allowed to call these methods
        settings.getContractOwnerAddress = async function(){
            return settings.getAccountAddress('supply_consolidator');
        }

        settings.asyncReady = new Promise((resolve) => {    
            Web3Helper.web3.eth.getAccounts().then((accounts) => {
                settings.paymentSplitterDefinitionExample = {recipients: [accounts[3], accounts[4]], amounts: [233, 38]};
                resolve();
            });
        });
        */

        return {settings, Web3Helper};
    }
};