var configuration = {
    web3ProviderURL: 'ws://localhost:8545', // <= settings for a local Ganache
    contracts: {
        uoa: {artifactFilename: 'UoA', address: '0x...'},
        escrowPaymentSplitter: {artifactFilename: 'EscrowPaymentSplitter', address: '0x...'}
    },
    contractArtifactsFolderRelativePath: '/../../build/contracts',
    currencyDecimals: 2                 // Note: not the token decimals, see rebaseToTokenDecimals()
}

module.exports = configuration;