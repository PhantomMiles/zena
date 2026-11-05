import { describe, it, expect } from 'vitest'
import { placeholder } from './index.js'

describe('@zena/hub placeholder', () => {
  it('is defined', () => {
    expect(placeholder).toBeDefined()
  })

  it('has the correct value', () => {
    expect(placeholder).toBe('zena-hub')
  })
})
