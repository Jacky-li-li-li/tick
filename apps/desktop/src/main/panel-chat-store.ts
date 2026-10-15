import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type PanelChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
};

type PersistShape = {
  version: 1;
  /** panel sessionId → messages (isolated from CLI sessions) */
  bySession: Record<string, PanelChatMessage[]>;
};

function assertPanelSessionId(sessionId: string) {
  const id = sessionId?.trim();
  if (!id) throw new Error("chat sessionId is required");
  if (id.startsWith("panel:") || id.startsWith("durable:") || id.startsWith("chat-")) {
    return id;
  }
  // Allow demo stubs and future durable ids; reject obvious CLI uuids only when branded wrong.
  if (id.startsWith("cli:")) {
    throw new Error("CLI session id cannot be used as panel chat sessionId");
  }
  return id;
}

export class PanelChatStore {
  private bySession: Record<string, PanelChatMessage[]> = {};
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as PersistShape;
      if (parsed?.version === 1 && parsed.bySession && typeof parsed.bySession === "object") {
        this.bySession = parsed.bySession;
      }
    } catch {
      this.bySession = {};
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: PersistShape = { version: 1, bySession: this.bySession };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  history(sessionId: string): PanelChatMessage[] {
    const id = assertPanelSessionId(sessionId);
    return [...(this.bySession[id] ?? [])];
  }

  send(input: { sessionId: string; text: string }): {
    ok: boolean;
    sessionId: string;
    user: PanelChatMessage;
    assistant: PanelChatMessage;
  } {
    const id = assertPanelSessionId(input.sessionId);
    const text = input.text?.trim();
    if (!text) throw new Error("chat text is required");

    const now = new Date().toISOString();
    const user: PanelChatMessage = {
      id: randomUUID(),
      role: "user",
      text,
      createdAt: now,
    };
    // P0: durable host not wired yet — echo stub so history + isolation are testable
    const assistant: PanelChatMessage = {
      id: randomUUID(),
      role: "assistant",
      text: `[stub] chat:* stored for ${id} (≠ CLI session). ChatAgentHost TBD.`,
      createdAt: new Date().toISOString(),
    };

    const list = this.bySession[id] ?? [];
    list.push(user, assistant);
    this.bySession[id] = list;
    this.save();

    return { ok: true, sessionId: id, user, assistant };
  }
}
