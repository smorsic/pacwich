// Minimal hand-rolled stand-in for the `vscode` module, aliased in for tests
// (see vitest.config.ts) since the real module only exists inside the
// extension host. Covers exactly the surface workspacesView/ and
// extension.ts use - extend as needed rather than trying to be exhaustive.

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
} as const;

export class ThemeIcon {
  constructor(public readonly id: string) {}
}

export class TreeItem {
  id?: string;
  label?: string;
  description?: string;
  tooltip?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;
  resourceUri?: unknown;
  command?: { command: string; title: string; arguments?: unknown[] };
  collapsibleState?: (typeof TreeItemCollapsibleState)[keyof typeof TreeItemCollapsibleState];

  constructor(
    label: string,
    collapsibleState?: (typeof TreeItemCollapsibleState)[keyof typeof TreeItemCollapsibleState],
  ) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return noopDisposable();
  };

  fire(value: T): void {
    for (const listener of this.listeners) listener(value);
  }
}

export class RelativePattern {
  constructor(
    public readonly base: string,
    public readonly pattern: string,
  ) {}
}

export class Disposable {
  constructor(private readonly onDispose: () => void = noop) {}

  dispose(): void {
    this.onDispose();
  }

  static from(...disposables: Array<{ dispose: () => void }>): Disposable {
    return new Disposable(() => {
      for (const disposable of disposables) disposable.dispose();
    });
  }
}

export const Uri = {
  file: (fsPath: string) => ({ fsPath, scheme: "file" }),
};

const noop = (): void => undefined;
const noopDisposable = () => ({ dispose: noop });

const noopWatcher = {
  onDidCreate: noopDisposable,
  onDidChange: noopDisposable,
  onDidDelete: noopDisposable,
  dispose: noop,
};

const configStore = new Map<string, unknown>();

/** Test-only helper: seed a value returned by `workspace.getConfiguration(section).get(key)`. */
export const __setConfigValue = (
  section: string,
  key: string,
  value: unknown,
): void => {
  configStore.set(`${section}.${key}`, value);
};

/** Test-only helper: clear all seeded config values between tests. */
export const __resetConfigValues = (): void => configStore.clear();

export const workspace = {
  workspaceFolders: undefined as unknown[] | undefined,
  getConfiguration: (section?: string) => ({
    get: <T>(key: string, defaultValue: T): T => {
      const storeKey = `${section}.${key}`;
      return configStore.has(storeKey)
        ? (configStore.get(storeKey) as T)
        : defaultValue;
    },
  }),
  createFileSystemWatcher: () => noopWatcher,
  onDidChangeConfiguration: noopDisposable,
  openTextDocument: async (path: string) => ({ uri: Uri.file(path) }),
};

export const window = {
  createTreeView: () => ({
    visible: true,
    onDidChangeVisibility: noopDisposable,
    dispose: noop,
  }),
  showQuickPick: async () => undefined,
  showTextDocument: async () => undefined,
};

export const commands = {
  registerCommand: noopDisposable,
  executeCommand: async () => undefined,
};
