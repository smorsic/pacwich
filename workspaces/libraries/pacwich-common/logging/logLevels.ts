export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export const getLogLevelNumber = (level: LogLevel) => LOG_LEVELS.indexOf(level);

/** A pacwich log level, in increasing severity (`"debug"` < `"info"` < `"warn"` < `"error"`). */
export type LogLevel = (typeof LOG_LEVELS)[number];

/** A {@link LogLevel}, or `"silent"` to suppress all log output. */
export type LogLevelSetting = LogLevel | "silent";
