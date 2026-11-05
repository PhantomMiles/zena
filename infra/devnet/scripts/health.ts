/**
 * Zena Devnet Health Check
 * Queries RPC for block height, peer count, validator count, and tests block progression.
 */

const RPC_URL = process.env.ZENA_RPC_URL || 'http://localhost:8545'

async function rpcCall(method: string, params: unknown[] = []): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const json = await res.json()
  if (json.error) {
    throw new Error(`RPC Error (${json.error.code}): ${json.error.message}`)
  }

  return json.result
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log(`\n==========================================================`)
  console.log(`             ZENA DEVNET HEALTH CHECK                     `)
  console.log(`==========================================================`)
  console.log(`Target RPC Gateway: ${RPC_URL}`)

  try {
    // 1. Initial snapshot
    const blockHex1 = await rpcCall('eth_blockNumber')
    const block1 = parseInt(blockHex1, 16)

    const peerCountHex = await rpcCall('net_peerCount')
    const peerCount = parseInt(peerCountHex, 16)

    let validators: string[] = []
    try {
      validators = await rpcCall('qbft_getValidatorsByBlockNumber', ['latest'])
    } catch {
      // Fallback if node is syncing
      validators = []
    }

    console.log(`\nInitial Snapshot:`)
    console.log(`  Current Block:     #${block1} (${blockHex1})`)
    console.log(`  Connected Peers:   ${peerCount}`)
    console.log(`  Active Validators: ${validators.length}`)
    if (validators.length > 0) {
      validators.forEach((v, idx) => console.log(`    - Validator ${idx + 1}: ${v}`))
    }

    // 2. Wait 3 seconds to measure block progression
    console.log(`\nSampling block progression over 3 seconds (expected block time: 2s)...`)
    await sleep(3000)

    const blockHex2 = await rpcCall('eth_blockNumber')
    const block2 = parseInt(blockHex2, 16)
    const blockDelta = block2 - block1

    console.log(`  Subsequent Block:  #${block2} (${blockHex2})`)
    console.log(`  Blocks Produced:   +${blockDelta}`)

    console.log(`\n----------------------------------------------------------`)
    if (blockDelta > 0) {
      console.log(`STATUS: HEALTHY - Block height is actively advancing!`)
    } else if (block1 > 0 && blockDelta === 0) {
      console.log(`STATUS: HALTED - Block height is static (consensus halted or paused).`)
    } else {
      console.log(`STATUS: WARNING - No blocks produced yet. Check container logs.`)
    }
    console.log(`==========================================================\n`)
  } catch (err: any) {
    console.error(`\nSTATUS: OFFLINE / UNREACHABLE`)
    console.error(`Error connecting to Besu RPC node: ${err.message}`)
    console.error(`Ensure devnet containers are running: pnpm devnet:up\n`)
    process.exit(1)
  }
}

main()
