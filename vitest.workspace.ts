// Vitest workspace config – runs all package tests from the repo root.
// Each package can override settings via its own vitest.config.ts.
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/node',
  'apps/hub',
  'apps/field',
  'apps/settle',
  'packages/contracts',
  'packages/sdk',
  'packages/ui',
  'packages/connectors',
])
