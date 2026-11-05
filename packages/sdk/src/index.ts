/**
 * @module @zena/sdk
 *
 * Zena SDK — the shared TypeScript surface consumed by every app in the
 * monorepo. Planned exports:
 *
 *   - Domain types: Shipment, Handover, Event, Member, SettlementInstruction
 *   - Re-exported contract ABIs from @zena/contracts
 *   - Chain client helpers (read and sign events, verify handovers)
 *   - EPCIS 2.0 event mappers
 *   - Zod validation schemas for external inputs (webhooks, EDI, telematics)
 *
 * Any change to an exported type is a breaking change to the public interface
 * between packages. Update all affected packages in the same PR.
 */

export { placeholder as contractsPlaceholder } from '@zena/contracts'

/** Placeholder export. Replace with real SDK types in Phase 1. */
export const placeholder = 'zena-sdk' as const
