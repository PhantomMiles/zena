/**
 * Zena Consortium Devnet Generator
 * Generates genesis.json, validator keys, static-nodes.json, and developer test accounts.
 *
 * For local development only. Never use these keys in production or with real funds.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SigningKey, computeAddress, parseEther } from 'ethers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEVNET_ROOT = path.resolve(__dirname, '..')

interface NodeInfo {
  name: string
  privateKey: string
  address: string
  enodePub: string
  p2pPort: number
  rpcPort?: number
}

interface DevAccount {
  name: string
  address: string
  privateKey: string
  balance: string
}

function generateNode(name: string, p2pPort: number, rpcPort?: number): NodeInfo {
  // Deterministic seed generation for repeatable devnet bootstrap
  // Seeded uniquely per node name
  const seedHex = '0x' + Buffer.from(`zena-devnet-seed-${name}`).toString('hex').padEnd(64, '0')
  const key = new SigningKey(seedHex)
  const address = computeAddress(key.publicKey)
  const privateKey = key.privateKey.replace(/^0x/, '')
  const enodePub = key.publicKey.slice(4) // 64 bytes (128 hex chars) without 0x04

  return {
    name,
    privateKey,
    address,
    enodePub,
    p2pPort,
    rpcPort,
  }
}

function generateDevAccount(index: number): DevAccount {
  const seedHex = '0x' + Buffer.from(`zena-dev-account-${index}`).toString('hex').padEnd(64, '0')
  const key = new SigningKey(seedHex)
  const address = computeAddress(key.publicKey)

  return {
    name: `Developer Account ${index}`,
    address,
    privateKey: key.privateKey,
    balance: '10000 ZENA',
  }
}

async function main() {
  console.log('Generating Zena Consortium Devnet configuration...')

  const keysDir = path.join(DEVNET_ROOT, 'keys')
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true })
  }

  // 1. Generate 4 Validators + 1 RPC node
  const validators: NodeInfo[] = [
    generateNode('validator1', 30303, 8541),
    generateNode('validator2', 30303, 8542),
    generateNode('validator3', 30303, 8543),
    generateNode('validator4', 30303, 8544),
  ]

  const rpcNode: NodeInfo = generateNode('rpc-node', 30303, 8545)
  const allNodes = [...validators, rpcNode]

  for (const node of allNodes) {
    const nodeKeyDir = path.join(keysDir, node.name)
    if (!fs.existsSync(nodeKeyDir)) {
      fs.mkdirSync(nodeKeyDir, { recursive: true })
    }
    // Write 64-char hex private key (without 0x)
    fs.writeFileSync(path.join(nodeKeyDir, 'key'), node.privateKey.trim(), 'utf8')
    console.log(`✓ ${node.name}: ${node.address}`)
  }

  // 2. Generate 5 Funded Developer Accounts
  const devAccounts: DevAccount[] = [1, 2, 3, 4, 5].map(generateDevAccount)

  // 10,000 ZENA in wei (hex format for genesis alloc)
  const balanceWeiHex = '0x' + parseEther('10000').toString(16)
  const alloc: Record<string, { balance: string }> = {}

  for (const dev of devAccounts) {
    alloc[dev.address.toLowerCase()] = { balance: balanceWeiHex }
    console.log(`✓ ${dev.name}: ${dev.address} (10,000 ZENA)`)
  }

  // Also prefund standard hardhat/local accounts for developer convenience
  const hardhatAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  alloc[hardhatAccount.toLowerCase()] = { balance: balanceWeiHex }

  // 3. Build QBFT genesis.json
  const genesis = {
    config: {
      chainId: 1337,
      homesteadBlock: 0,
      eip150Block: 0,
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      istanbulBlock: 0,
      qbft: {
        blockperiodseconds: 2,
        epochlength: 30000,
        requesttimeoutseconds: 4,
        validators: validators.map((v) => v.address),
      },
    },
    nonce: '0x0',
    timestamp: '0x0',
    extraData: '0x',
    gasLimit: '0x1fffffffffffff',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    alloc,
  }

  const genesisPath = path.join(DEVNET_ROOT, 'genesis.json')
  fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2), 'utf8')
  console.log(`✓ Saved genesis.json (QBFT, block period: 2s, chainId: 1337)`)

  // 4. Build static-nodes.json for internal container networking
  const staticNodes = allNodes.map((node) => `enode://${node.enodePub}@${node.name}:30303`)

  const staticNodesPath = path.join(DEVNET_ROOT, 'static-nodes.json')
  fs.writeFileSync(staticNodesPath, JSON.stringify(staticNodes, null, 2), 'utf8')
  console.log(`✓ Saved static-nodes.json (${staticNodes.length} nodes)`)

  // 5. Save developer-accounts.json
  const devAccountsPath = path.join(DEVNET_ROOT, 'developer-accounts.json')
  fs.writeFileSync(devAccountsPath, JSON.stringify(devAccounts, null, 2), 'utf8')
  console.log(`✓ Saved developer-accounts.json`)

  // 6. Save metadata summary
  const meta = {
    chainId: 1337,
    blockPeriodSeconds: 2,
    validators: validators.map((v) => ({ name: v.name, address: v.address, rpcPort: v.rpcPort })),
    rpcNode: { name: rpcNode.name, address: rpcNode.address, httpPort: 8545, wsPort: 8546 },
    developerAccounts: devAccounts,
  }
  fs.writeFileSync(path.join(keysDir, 'info.json'), JSON.stringify(meta, null, 2), 'utf8')
  console.log('✨ Devnet genesis and keys successfully generated!')
}

main().catch((err) => {
  console.error('Failed to generate devnet:', err)
  process.exit(1)
})
