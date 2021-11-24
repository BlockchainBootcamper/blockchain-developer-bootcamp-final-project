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
        return new HDWalletProvider(env.MNEMONIC, "https://ropsten.infura.io/v3/"+env.INFURA_API_KEY);
      },
      network_id: 3,
      gas: 4000000          //make sure this gas allocation isn't over 4M, which is the max
    }
  },

  mocha: {},

  compilers: {
    solc: {
      version: "0.8.10"
    }
  }
};
