import { EugineError } from "./errors.js";

export interface EuginePlugin<TEditor = unknown> {
  name: string;
  install?(editor: TEditor): void;
  initialize?(editor: TEditor): void;
  ready?(editor: TEditor): void;
  destroy?(editor: TEditor): void;
}

/**
 * Drives the install → initialize → ready → destroy plugin lifecycle.
 * Installing a plugin gives that plugin's code execution privileges in the
 * host application — plugins are trusted dependencies, not a sandboxed
 * extension format.
 */
export class PluginManager<TEditor> {
  private installed = new Map<string, EuginePlugin<TEditor>>();
  private isReady = false;

  constructor(private readonly editor: TEditor) {}

  use(plugin: EuginePlugin<TEditor>): void {
    if (this.installed.has(plugin.name)) {
      throw new EugineError("EUGINE_PLUGIN_ERROR", `Plugin "${plugin.name}" is already installed.`, {
        context: { plugin: plugin.name },
      });
    }
    try {
      plugin.install?.(this.editor);
      plugin.initialize?.(this.editor);
      this.installed.set(plugin.name, plugin);
      if (this.isReady) plugin.ready?.(this.editor);
    } catch (error) {
      this.installed.delete(plugin.name);
      throw new EugineError("EUGINE_PLUGIN_ERROR", `Plugin "${plugin.name}" failed during install.`, {
        cause: error,
        context: { plugin: plugin.name },
      });
    }
  }

  /** Called once by the editor once its initial setup has completed. */
  markReady(): void {
    if (this.isReady) return;
    this.isReady = true;
    for (const plugin of this.installed.values()) {
      try {
        plugin.ready?.(this.editor);
      } catch (error) {
        throw new EugineError("EUGINE_PLUGIN_ERROR", `Plugin "${plugin.name}" failed during ready().`, {
          cause: error,
          context: { plugin: plugin.name },
        });
      }
    }
  }

  destroy(): void {
    for (const plugin of this.installed.values()) {
      plugin.destroy?.(this.editor);
    }
    this.installed.clear();
    this.isReady = false;
  }

  has(name: string): boolean {
    return this.installed.has(name);
  }

  list(): EuginePlugin<TEditor>[] {
    return Array.from(this.installed.values());
  }
}
