/**
 * Normalize newline-like control characters in a chunk of script output.
 * When `stripDisruptiveControls` is set, also drop disruptive single-byte
 * and C1 control characters and strip every ANSI escape sequence except
 * SGR color codes (`CSI ... m`), so untrusted workspace output cannot
 * manipulate the user's terminal.
 */
export const sanitizeChunk = (
  input: string,
  stripDisruptiveControls: boolean = false,
) => {
  if (!stripDisruptiveControls) {
    return input.replace(/\r\n/g, "\n");
  }

  // 1) Normalize newline-ish controls
  let normalizedText = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\v/g, "\n");

  // 2) Remove disruptive single-byte controls (except \n, \t)
  //    - backspace, bell, and C1 controls
  // eslint-disable-next-line no-control-regex
  normalizedText = normalizedText.replace(/[\b\x07\x80-\x9F]/g, "");

  // 3) Strip ANSI sequences, keeping only SGR (CSI ... m)
  //
  // We'll scan rather than rely on one giant regex so we can:
  // - keep SGR exactly
  // - drop any other ESC sequence
  // - handle incomplete ESC sequences conservatively (drop the ESC byte itself)
  //
  // ESC = \x1B
  const ESC = "\x1B";

  let result = "";
  for (let index = 0; index < normalizedText.length; index++) {
    const currentChar = normalizedText[index];
    if (currentChar !== ESC) {
      result += currentChar;
      continue;
    }

    // If ESC is last char, drop it
    if (index + 1 >= normalizedText.length) break;

    const nextChar = normalizedText[index + 1];

    // Keep only CSI ... m  (ESC [ ... m)
    if (nextChar === "[") {
      // Find final byte of CSI sequence (per spec: 0x40-0x7E).
      // We only keep it if the final byte is 'm'.
      let scanIndex = index + 2;
      while (scanIndex < normalizedText.length) {
        const code = normalizedText.charCodeAt(scanIndex);
        if (code >= 0x40 && code <= 0x7e) break; // final byte
        scanIndex++;
      }

      // If we didn't find a final byte, drop the ESC and stop (incomplete)
      if (scanIndex >= normalizedText.length) break;

      const finalByte = normalizedText[scanIndex];
      if (finalByte === "m") {
        // Keep full SGR sequence
        result += normalizedText.slice(index, scanIndex + 1);
      }
      // else: drop the entire CSI sequence

      index = scanIndex; // advance past sequence
      continue;
    }

    // All other ESC sequences: drop them.
    //
    // For 2-byte sequences (like ESC c), we can just drop ESC+next.
    // For string-terminated families (OSC/DCS/APC/PM/SOS), we should skip until terminator.
    //
    // OSC: ESC ] ... (BEL or ESC \)
    // DCS: ESC P ... (ST = ESC \)
    // APC: ESC _ ... (ST)
    // PM : ESC ^ ... (ST)
    // SOS: ESC X ... (ST)
    if (
      nextChar === "]" ||
      nextChar === "P" ||
      nextChar === "_" ||
      nextChar === "^" ||
      nextChar === "X"
    ) {
      let scanIndex = index + 2;

      while (scanIndex < normalizedText.length) {
        const currentByte = normalizedText[scanIndex];

        // BEL terminator (OSC can end with BEL)
        if (currentByte === "\x07") {
          scanIndex++;
          break;
        }

        // ST terminator: ESC \
        if (
          currentByte === ESC &&
          scanIndex + 1 < normalizedText.length &&
          normalizedText[scanIndex + 1] === "\\"
        ) {
          scanIndex += 2;
          break;
        }

        scanIndex++;
      }

      index = scanIndex - 1; // -1 because loop will index++
      continue;
    }

    // Fallback: treat as a 2-byte escape and drop ESC + next.
    index += 1;
  }

  return result;
};
