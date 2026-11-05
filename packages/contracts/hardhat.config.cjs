require('@nomicfoundation/hardhat-toolbox')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'shanghai',
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    devnet: {
      url: 'http://localhost:8545',
      chainId: 1337,
      accounts: [
        // Deterministic private key of Dev Account 1 funded in genesis.json
        // For devnet deployment only
        '0x7a656e612d6465762d6163636f756e742d310000000000000000000000000000',
      ],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}

