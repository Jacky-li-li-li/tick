import fs from "node:fs";
import path from "node:path";
import type { ModelSelection } from "@tick/shared";

type PersistShape = { version: 1; selected?: ModelSelection };

/**
 * Tick-side choice of the panel-chat model. Deliberately separate from pi's
 * settings.json so changing it here never mutates the pi CLI's defaults.
 */
export class ModelConfigStore {
  private selected: ModelSelection | undefined;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(
        fs.readFileSync(this.filePath, "utf8"),
      ) as PersistShape;
      if (
        parsed?.version === 1 &&
        parsed.selected?.provider &&
        parsed.selected?.modelId
      ) {
        this.selected = {
          provider: parsed.selected.provider,
          modelId: parsed.selected.modelId,
        };
      }
    } catch {
      this.selected = undefined;
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: PersistShape = { version: 1, selected: this.selected };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  get(): ModelSelection | undefined {
    return this.selected ? { ...this.selected } : undefined;
  }

  set(selection: ModelSelection): void {
    this.selected = { ...selection };
    this.save();
  }
}
