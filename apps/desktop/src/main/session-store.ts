import fs from "node:fs";
import path from "node:path";
import type { Session } from "@tick/shared";

type PersistShape = { version: 1; sessions: Session[] };

/** CLI / tool sessions only — not panel chat. */
export class SessionStore {
  private sessions = new Map<string, Session>();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed?.version === 1 && Array.isArray(parsed.sessions)) {
        this.sessions = new Map(parsed.sessions.map((s) => [s.id, s]));
      }
    } catch {
      this.sessions = new Map();
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: PersistShape = {
      version: 1,
      sessions: [...this.sessions.values()],
    };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  set(session: Session): Session {
    this.sessions.set(session.id, session);
    this.save();
    return session;
  }
}
