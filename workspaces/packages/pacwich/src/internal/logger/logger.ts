import { inspect } from "util";
import {
  LOG_LEVELS,
  getLogLevelNumber,
  type LogLevelSetting,
  type LogLevel,
} from "@pacwich/common/logging";
import { defineErrors } from "../core/error";
import { IS_TEST } from "../core/process/env";

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

export type Logger = {
  name: string;

  log<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(
    message: Message,
    level: LogLevel,
    metadata?: Metadata,
  ): Log<Message, Metadata>;

  printLevel: LogLevelSetting;

  setPrintStdout: (
    stdout: (...args: Parameters<typeof process.stdout.write>) => void,
  ) => void;

  setPrintStderr: (
    stderr: (...args: Parameters<typeof process.stderr.write>) => void,
  ) => void;
} & {
  [Level in LogLevel]: <
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
    level: LogLevel,
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

  warn<
    Message extends string | Error = string,
    Metadata extends LogMetadata = LogMetadata,
  >(message: Message, metadata?: Metadata): Log<Message, Metadata> {
    return this.log(message, "warn", metadata);
  }

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

  // Info prints normally for standard user-facing logs. Debug and Warn are highlighted with a prefix. Errors print as Error instances
  private formatLogMessage(message: Error | string, level: LogLevel): string {
    const content = message instanceof Error ? message.message : message;
    const prefixed =
      level === "debug" || level === "warn"
        ? `[${this.name} ${level.toUpperCase()}]: ${content}`
        : content;
    return level === "warn"
      ? `${YELLOW}${prefixed}${NC}`
      : level === "error"
        ? `${RED}${prefixed}${NC}`
        : prefixed;
  }

  private _printLevel: LogLevelSetting = IS_TEST ? "error" : "info";

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
 * Set the global logging level for pacwich's own logger. Defaults
 * to `"info"`, or `"error"` when `NODE_ENV` is `"test"`. Affects
 * every log call from pacwich source for the rest of the process.
 *
 * @example
 * import { setLogLevel } from "pacwich";
 *
 * setLogLevel("warn");
 */
export const setLogLevel = (level: LogLevelSetting) => {
  logger.printLevel = level;
};
