/**
 * @module @zena/settle
 *
 * Zena Settle — the payments service. Listens for verified proof-of-delivery
 * events from the consortium chain, checks contract terms, and issues payout
 * instructions to a licensed payment partner. Uses sandbox credentials only;
 * all payment instructions are recorded in an append-only ledger. Idempotency
 * keys are required on every instruction to prevent double-payments.
 */

/** Placeholder export. Replace with real settlement service in Phase 3. */
export const placeholder = 'zena-settle' as const
