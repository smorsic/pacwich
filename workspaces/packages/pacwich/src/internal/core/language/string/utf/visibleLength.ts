import { stripANSI } from "../stripANSI";
import { eaw } from "./eastAsianWidth";

const getVisibleSliceIndex = (str: string, maxVisible: number): number => {
  let i = 0;
  let visibleCount = 0;
  while (i < str.length && visibleCount < maxVisible) {
    if (str[i] === "\x1b" && str[i + 1] === "[") {
      i += 2;
      while (i < str.length && /[0-9;?]/.test(str[i])) i++;
      if (i < str.length) i++;
    } else {
      const codePoint = str.codePointAt(i)!;
      const char = String.fromCodePoint(codePoint);
      const charWidth = eaw.characterLength(char);
      if (visibleCount + charWidth > maxVisible) break;
      visibleCount += charWidth;
      i += char.length;
    }
  }
  return i;
};

export const calculateVisibleLength = (str: string): number => {
  return eaw.length(stripANSI(str));
};

export const truncateTerminalString = (
  str: string,
  maxVisible: number,
): string => str.slice(0, getVisibleSliceIndex(str, maxVisible));
