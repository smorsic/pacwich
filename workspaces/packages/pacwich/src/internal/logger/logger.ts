import { inspect } from "util";
import { USER_ENV_VARS } from "@pacwich/common/config";
import {
  LOG_LEVELS,
  getLogLevelNumber,
  type LogLevelSetting,
  type LogLevel,
} from "@pacwich/common/logging";
import {
  formatWarningMessage,
  formatWarningPrefix,
  type WarningId,
  type WarningInterpolation,
} from "@pacwich/common/warnings";
import { defineErrors } from "../core/error";
import { splitCsvList } from "../core/language/string/csvList";
import { IS_TEST } from "../core/process/env";

// Read live (not cached) so warnings emitted before any project/CLI setup
// still honor the env var, and so it stays overridable in tests.
const readEnvSuppressedWarnings = (): Set<string> => {
  const raw = process.env[USER_ENV_VARS.suppressWarnings];
  return new Set(raw ? splitCsvList(raw) : []);
};

/** Errors thrown by {@link setLogLevel} when given a value outside
 * the accepted set of log levels. Subclass of {@link PacwichError}. */
export const LOGGER_ERRORS = defineErrors("InvalidLogLevel");

export const validateLogLevel = (level: LogLevelSetting) => {
  if (level === "silent") return;
  if (!LOG_LEVELS.includes(level)) {
    throw new LOGGER_ERRORS.InvalidLogLevel(
      `Invalid log level: ${JSON.stringify(level)}. Accepted values: ${LOG_LEVELS.join(", ") + ", silent"}`,
    );
  }
};

/** The `PACWICH_LOG_LEVEL` env var as a valid level, or `undefined` when it is
 * unset or invalid. Read live so it reflects the env var at call time. An
 * invalid value is ignored (not thrown) so a typo can't crash pacwich at
 * import, before CLI arg parsing could correct it. */
export const resolveEnvLogLevel = (): LogLevelSetting | undefined => {
  const envLevel = process.env[USER_ENV_VARS.logLevel];
  if (envLevel === undefined) return undefined;
  try {
    validateLogLevel(envLevel as LogLevelSetting);
    return envLevel as LogLevelSetting;
  } catch {
    return undefined;
  }
};

/** The default print level for a new logger: the `PACWICH_LOG_LEVEL` env var
 * when valid, otherwise `"info"` (or `"error"` under test). The CLI --log-level
 * flag and setLogLevel override it. */
export const resolveDefaultLogLevel = (): LogLevelSetting =>
  resolveEnvLogLevel() ?? (IS_TEST ? "error" : "info");

export type LogMetadata = Record<string, unknown>;

export interface Log<
  Message extends string | Error = string,
  Metadata extends LogMetadata = LogMetadata,
> {
  message: Message;
  level: LogLevel;
  metadata: Metadata;
  time: Date;
}

/** Options accepted by {@link Logger.warn}: the warning id's own interpolation args, plus optional append/metadata. Always required, even when empty, so every warn call has the same shape. */
export type WarnOptions<Id extends WarningId = WarningId> =
  WarningInterpolation<Id> & {
    /** Extra context appended after the warning's canonical message. */
    append?: string;
    metadata?: LogMetadata;
  };

export type Logger = {
  name: string;

  log<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(
    message: Message,
    level: Exclude<LogLevel, "warn">,
    metadata?: Metadata,
  ): Log<Message, Metadata>;

  /** Logs a registered warning by id; unlike `debug`/`info`/`error`, not a plain string. See {@link setSuppressWarnings}. */
  warn<Id extends WarningId>(
    id: Id,
    options: WarnOptions<Id>,
  ): Log<string, LogMetadata>;

  printLevel: LogLevelSetting;

  /** Ids of warnings currently suppressed. See {@link setSuppressWarnings}. */
  suppressWarnings: readonly WarningId[];

  setPrintStdout: (
    stdout: (...args: Parameters<typeof process.stdout.write>) => void,
  ) => void;

  setPrintStderr: (
    stderr: (...args: Parameters<typeof process.stderr.write>) => void,
  ) => void;
} & {
  [Level in Exclude<LogLevel, "warn">]: <
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(
    message: Message,
    metadata?: Metadata,
  ) => Log<Message, Metadata>;
};

export const createLogger = (name: string): Logger => new _Logger(name);

const YELLOW = "\x1b[0;33m";
const NC = "\x1b[0m";
const RED = "\x1b[0;31m";

const LEVEL_OUTPUT_TARGETS: Record<LogLevel, "stdout" | "stderr"> = {
  debug: "stderr",
  info: "stdout",
  warn: "stderr",
  error: "stderr",
};

class _Logger implements Logger {
  constructor(public name: string) {}

  log<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(
    message: Message,
    level: Exclude<LogLevel, "warn">,
    metadata?: Metadata,
  ): Log<Message, Metadata> {
    const log: Log<Message, Metadata> = {
      message,
      level,
      metadata: metadata ?? ({} as Metadata),
      time: new Date(),
    };

    if (this.shouldPrint(level)) {
      const formattedMessage = this.formatLogMessage(message, level);
      if (message instanceof Error) {
        message.message = formattedMessage;
      }
      const mainMessage = message instanceof Error ? message : formattedMessage;
      const metadataMessages = metadata ? [{ metadata }] : [];

      this[
        LEVEL_OUTPUT_TARGETS[level] === "stderr"
          ? "_printStderr"
          : "_printStdout"
      ](
        (typeof mainMessage === "string"
          ? mainMessage
          : inspect(mainMessage, { colors: true })) +
          metadataMessages.map((m) => inspect(m, { colors: true })).join("\n") +
          "\n",
      );
    }

    return log;
  }

  debug<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(message: Message, metadata?: Metadata): Log<Message, Metadata> {
    return this.log(message, "debug", metadata);
  }

  info<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(message: Message, metadata?: Metadata): Log<Message, Metadata> {
    return this.log(message, "info", metadata);
  }

  warn<Id extends WarningId>(
    id: Id,
    options: WarnOptions<Id>,
  ): Log<string, LogMetadata> {
    const interpolatedMessage = formatWarningMessage(id, options);
    const message = options.append
      ? `${interpolatedMessage} ${options.append}`
      : interpolatedMessage;
    const metadata = options.metadata;
    const log: Log<string, LogMetadata> = {
      message,
      level: "warn",
      metadata: metadata ?? {},
      time: new Date(),
    };

    if (this._suppressWarnings.has(id) || readEnvSuppressedWarnings().has(id))
      return log;

    if (this.shouldPrint("warn")) {
      const formatted = `${YELLOW}${formatWarningPrefix(this.name, id)}: ${message}${NC}`;
      const metadataMessages = metadata
        ? [inspect({ metadata }, { colors: true })]
        : [];
      this._printStderr([formatted, ...metadataMessages].join("\n") + "\n");
    }

    return log;
  }

  get suppressWarnings(): readonly WarningId[] {
    return [...this._suppressWarnings];
  }

  set suppressWarnings(ids: readonly WarningId[]) {
    this._suppressWarnings = new Set(ids);
  }

  private _suppressWarnings = new Set<WarningId>();

  error<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(message: Message, metadata?: Metadata): Log<Message, Metadata> {
    return this.log(message, "error", metadata);
  }

  get printLevel() {
    return this._printLevel;
  }

  set printLevel(level: LogLevelSetting) {
    validateLogLevel(level);
    this._printLevel = level;
  }

  // Info prints normally for standard user-facing logs. Debug is highlighted
  // with a prefix. Errors print as Error instances. Warn has its own
  // implementation (see the `warn` method) since its prefix carries a
  // warning id and it can be suppressed.
  private formatLogMessage(message: Error | string, level: LogLevel): string {
    const content = message instanceof Error ? message.message : message;
    const prefixed =
      level === "debug" ? `[${this.name} DEBUG]: ${content}` : content;
    return level === "error" ? `${RED}${prefixed}${NC}` : prefixed;
  }

  private _printLevel: LogLevelSetting = resolveDefaultLogLevel();

  private shouldPrint(level: LogLevel): boolean {
    if (this.printLevel === "silent") return false;
    return getLogLevelNumber(level) >= getLogLevelNumber(this.printLevel);
  }

  private _printStdout: (
    ...args: Parameters<typeof process.stdout.write>
  ) => void = (...args) => process.stdout.write(...args);
  private _printStderr: (
    ...args: Parameters<typeof process.stderr.write>
  ) => void = (...args) => process.stderr.write(...args);

  setPrintStdout(
    stdout: (...args: Parameters<typeof process.stdout.write>) => void,
  ) {
    this._printStdout = stdout;
  }

  setPrintStderr(
    stderr: (...args: Parameters<typeof process.stderr.write>) => void,
  ) {
    this._printStderr = stderr;
  }
}

export const logger = createLogger("pacwich");

/**
 * Set the global logging level for pacwich's own logger. The default
 * comes from the `PACWICH_LOG_LEVEL` env var when it holds a valid level,
 * otherwise `"info"` (or `"error"` when `NODE_ENV` is `"test"`). Calling
 * this overrides that default for every log call from pacwich source for
 * the rest of the process.
 *
 * @example
 * import { setLogLevel } from "pacwich";
 *
 * setLogLevel("warn");
 */
export const setLogLevel = (level: LogLevelSetting) => {
  logger.printLevel = level;
};

// Internal. Sets the programmatic suppression set (the CLI --suppress-warnings
// flag). The PACWICH_SUPPRESS_WARNINGS env var is always additionally honored.
export const setSuppressWarnings = (ids: readonly WarningId[]) => {
  logger.suppressWarnings = ids;
};
