
var configuration = {
    network: 'development',     // which of the networkSpecific configuration below is loaded
    networkSpecific: {
        development: {  // f.ex. local Ganache instance - uses unlocked accounts directly from provider, no need to have a key provider() with HDWalletProvider like for public networks (see below)
            websocketProviderURL: 'ws://localhost:8545',
            contractAddresses: {uoa: '0xf0d98Eef2F8A2F1B912481A94fAFd2FA2D84b7E9', escrowPaymentSplitter: '0xf05c88f49801A4b25994E8f7F1c393A48224Ad59'}
        },
        ropsten: {
            //HDWalletProvider,
            //env,

            loadRequirements: function(){
                this.HDWalletProvider = require('@truffle/hdwallet-provider');
                this.env = require('dotenv').config().parsed;
            },
            websocketProviderURL: function(){return this.env.ACCESS_PROVIDER_WEBSOCKET_URL;},
            provider: function(websocketProvider){
                // See https://ethereum.stackexchange.com/questions/103301/the-current-provider-doesnt-support-subscriptions-hdwalletprovider-on-polygon
                this.HDWalletProvider.prototype.on = websocketProvider.on.bind(websocketProvider);
                return new this.HDWalletProvider({   // for configuration options, see https://www.npmjs.com/package/@truffle/hdwallet-provider
                    mnemonic: {phrase: this.env.MNEMONIC},
                    providerOrUrl: websocketProvider,
                    addressIndex: 0
                });
            },
            contractAddresses: {uoa: '', escrowPaymentSplitter: ''}
        }
    },
    /*contracts: {
        uoa: {artifactFilename: 'UoA', address: '0x3f0a150C7D0Dd41b56960196F145903954CE77BF'},
        escrowPaymentSplitter: {artifactFilename: 'EscrowPaymentSplitter', address: '0xe2359A44Be1108A3F2AA1b2781b5838a069fa5a3'}
    },*/
    contractArtifactsFolderRelativePath: '../build/contracts',
    contractArtifactFilenames: {uoa: 'UoA', escrowPaymentSplitter: 'EscrowPaymentSplitter'},
    currencyDecimals: 2,                 // Note: not the token decimals, see rebaseToTokenDecimals()
    gasMargin: 0.2                       // 20% above estimation
}

module.exports = configuration;