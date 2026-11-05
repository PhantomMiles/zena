/**
 * @module @zena/connectors
 *
 * Zena Connectors — adapters that map external logistics system formats into
 * Zena SDK types, and push Zena events back out in the format the external
 * system expects. Planned connectors (Phase 2):
 *
 *   - REST webhook receiver (generic, with HMAC signature validation)
 *   - GS1 EPCIS 2.0 XML / JSON-LD → ZenaEvent mapper
 *   - MQTT telematics ingestion (geo-stamps, sensor readings)
 *   - EDI X12 / EDIFACT bridge
 *
 * Security rule 20 applies: ALL external input is treated as untrusted.
 * Every connector validates, size-limits, and sanitises before passing data
 * to the SDK types. Validation schemas live in @zena/sdk.
 */

/** Placeholder export. Replace with real connector adapters in Phase 2. */
export const placeholder = 'zena-connectors' as const
