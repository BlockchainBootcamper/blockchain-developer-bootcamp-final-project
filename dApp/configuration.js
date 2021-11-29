var configuration = {
    network: 'ropsten',     // which of the networkSpecific sections below is loaded
    networkSpecific: {      // truffle inspired
        development: {      // f.ex. local Ganache instance - uses unlocked accounts directly from provider, no need to have a key provider() with HDWalletProvider like for public networks (see below)
            websocketProviderURL: 'ws://localhost:8545',
            contractAddresses: {uoa: '0xb080D33cb3C135D8361d0fC5795bD0d09d2Fa1a8', escrowPaymentSplitter: '0x4531bee0D852CE98ACEC05F0260E065Ebf15268d'}
        },
        ropsten: {
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
            contractAddresses: {uoa: '0xcaF4cf3BC2970563c157d369F70b42b7a6d3d00A', escrowPaymentSplitter: '0xba8865E97A0F2228B84c8a657E96868B8045C9F1'}
        }
    },
    contractArtifactsFolderRelativePath: '../build/contracts',
    contractArtifactFilenames: {uoa: 'UoA', escrowPaymentSplitter: 'EscrowPaymentSplitter'},
    currencyDecimals: 2,                 // Note: decimals in the UI, not the token contract
    gasMargin: 0.2                       // percent indication between 0 and 1 for the gasLimit margin - 0.2 means it uses a limit 20% above estimation
}

module.exports = configuration;