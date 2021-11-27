const HDWalletProvider = require('@truffle/hdwallet-provider');
const env = require('dotenv').config().parsed;

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider({   // for configuration options, see https://www.npmjs.com/package/@truffle/hdwallet-provider
          mnemonic: {phrase: env.MNEMONIC},
          providerOrUrl: env.ACCESS_PROVIDER_HTTPS_URL,
          addressIndex: 0
      });
      },
      network_id: 3,
      gas: 8000000          // Ropsten maximum, see https://ropsten.etherscan.io/blocks
    }
  },

  mocha: {},

  compilers: {
    solc: {
      version: "0.8.10"
    }
  }
};
