/**
 * Dual-session isolation. CLI pi session ids and panel pi-durable
 * conversation ids live in different namespaces and must not be
 * interchangeable. Every id that crosses the IPC boundary is parsed here
 * before use, so the shape of the id enforces the rule.
 */

declare const CLI_SESSION_BRAND: unique symbol;
declare const PANEL_SESSION_BRAND: unique symbol;

/** Native CLI session id, e.g. the UUIDv7 pi accepts via `--session-id`. */
export type CliSessionId = string & { readonly [CLI_SESSION_BRAND]: true };

/**
 * Panel chat session key. Always carries the `panel:` namespace prefix, so it
 * can never be mistaken for a CLI session id and vice versa.
 */
export type PanelSessionKey = string & { readonly [PANEL_SESSION_BRAND]: true };

export const PANEL_SESSION_PREFIX = "panel:";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse an untrusted IPC value into a CLI session id.
 * ids we create are always UUIDs (`newCliSessionId`, pi's own ids), so the
 * UUID shape rejects panel keys, durable conversation numbers, and junk.
 */
export function parseCliSessionId(value: unknown): CliSessionId {
  if (typeof value === "string" && value.startsWith(PANEL_SESSION_PREFIX)) {
    throw new Error(
      `panel session key cannot be used as a CLI session id: ${value}`,
    );
  }
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`invalid CLI session id: ${JSON.stringify(value)}`);
  }
  return value as CliSessionId;
}

/**
 * Parse an untrusted IPC value into a panel session key.
 * Requires the `panel:` prefix, so a CLI UUID or durable conversation number
 * is rejected here rather than reaching the panel store.
 */
export function parsePanelSessionKey(value: unknown): PanelSessionKey {
  if (typeof value !== "string" || !value.startsWith(PANEL_SESSION_PREFIX)) {
    throw new Error(`invalid panel session key: ${JSON.stringify(value)}`);
  }
  if (value.length === PANEL_SESSION_PREFIX.length) {
    throw new Error("panel session key is empty");
  }
  return value as PanelSessionKey;
}
