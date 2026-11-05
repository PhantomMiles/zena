import { describe, it, expect } from 'vitest'
import { placeholder, contractsPlaceholder } from './index.js'

describe('@zena/sdk placeholder', () => {
  it('is defined', () => {
    expect(placeholder).toBeDefined()
  })

  it('has the correct value', () => {
    expect(placeholder).toBe('zena-sdk')
  })

  it('re-exports contracts placeholder', () => {
    expect(contractsPlaceholder).toBe('zena-contracts')
  })
})
