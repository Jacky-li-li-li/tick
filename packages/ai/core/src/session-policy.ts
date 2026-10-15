/**
 * Dual-session isolation — do not violate pi's models.
 * CLI ids ≠ panel pi-durable conversation ids.
 */
export type SessionNamespace = "cli:pi" | "panel:durable";

const PANEL_BRAND = Symbol("panel-pi-durable");

export type PanelConversationId = string & { readonly [PANEL_BRAND]?: true };

export function qualifySessionKey(
  ns: SessionNamespace,
  id: string,
): `${SessionNamespace}:${string}` {
  return `${ns}:${id}`;
}

export function assertCliSessionId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new Error("CLI session id required");
  }
  if (id.startsWith("panel:") || id.startsWith("durable:")) {
    throw new Error("panel/durable id cannot be used as CLI session id");
  }
}

export function assertPanelConversationId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new Error("panel conversation id required");
  }
  if (id.startsWith("cli:")) {
    throw new Error("CLI session id cannot be used as panel conversation id");
  }
}

/** Reject panel-looking ids in ai:launch / ai:resume / session:* handlers */
export function rejectCrossNamespaceSessionId(
  kind: "cli" | "panel",
  id: string,
): void {
  if (kind === "cli") assertCliSessionId(id);
  else assertPanelConversationId(id);
}
