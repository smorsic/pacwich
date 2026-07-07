import { PacwichError } from "../internal/core";

/** Default per-stream output buffer cap: 16 MiB. */
export const DEFAULT_OUTPUT_BUFFER_BYTES = 16 * 1024 * 1024;

const BYTE_UNIT_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

const BYTE_SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/;

/**
 * Parse an output-buffer byte size into a concrete byte count.
 *
 * Accepts a raw byte count (a positive number or numeric string), a human
 * size with a `B`/`KB`/`MB`/`GB` suffix (1024-based, case-insensitive), or
 * `"unbounded"` / `Infinity` (=> `Infinity`, no cap). Throws
 * {@link PacwichError} on any other value.
 *
 * @example
 * parseOutputBufferBytes("16MB"); // 16777216
 * parseOutputBufferBytes(1024); // 1024
 * parseOutputBufferBytes("unbounded"); // Infinity
 */
export const parseOutputBufferBytes = (
  value: number | string,
  errorMessageSuffix = "",
): number => {
  if (typeof value === "number") {
    if (value === Infinity) return Infinity;
    if (!Number.isFinite(value) || value < 1) {
      throw new PacwichError(
        `Output buffer size must be a positive number of bytes${errorMessageSuffix}`,
      );
    }
    return Math.floor(value);
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === "unbounded") return Infinity;

  const match = BYTE_SIZE_PATTERN.exec(trimmed);
  if (match) {
    const amount = parseFloat(match[1]);
    const unit = match[2] ?? "b";
    const bytes = Math.floor(amount * BYTE_UNIT_MULTIPLIERS[unit]);
    if (bytes >= 1) return bytes;
  }

  throw new PacwichError(
    `Invalid output buffer size: ${JSON.stringify(
      value,
    )}. Expected a byte count, a size like "16MB", or "unbounded"${errorMessageSuffix}`,
  );
};
