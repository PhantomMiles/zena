require('@nomicfoundation/hardhat-toolbox')
const { subtask } = require('hardhat/config')
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names')

const SOLC_VERSION = '0.8.24'

// Hardhat normally downloads the native compiler from binaries.soliditylang.org. In locked-down
// networks set ZENA_SOLCJS=1 to use the `solc` npm package instead (slower, npm registry only).
if (process.env.ZENA_SOLCJS === '1') {
  subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
    if (args.solcVersion === SOLC_VERSION) {
      return {
        compilerPath: require.resolve('solc/soljson.js'),
        isSolcJs: true,
        version: SOLC_VERSION,
        longVersion: '0.8.24+commit.e11b9ed9',
      }
    }
    return runSuper()
  })
}

const deployerKey = process.env.ZENA_DEPLOYER_KEY

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'shanghai',
    },
  },
  networks: {
    hardhat: { chainId: 1337 },
    devnet: {
      url: process.env.ZENA_RPC_URL ?? 'http://127.0.0.1:8545',
      chainId: 1337,
      gasPrice: 0,
      // Never commit a key. Export ZENA_DEPLOYER_KEY (see .env.example) before deploying.
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}
