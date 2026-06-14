// Code based on package strip-json-comments

const stripWithoutWhitespace = () => "";

// Replace all characters except ASCII spaces, tabs and line endings with regular spaces to ensure valid JSON output.
const stripWithWhitespace = (string: string, start: number, end?: number) =>
  string.slice(start, end).replace(/[^ \t\r\n]/g, " ");

const isEscaped = (jsonString: string, quotePosition: number) => {
  let index = quotePosition - 1;
  let backslashCount = 0;

  while (jsonString[index] === "\\") {
    index -= 1;
    backslashCount += 1;
  }

  return Boolean(backslashCount % 2);
};

export const convertJSONCToJSON = (
  jsonString: string,
  { whitespace = true } = {},
) => {
  if (typeof jsonString !== "string") {
    throw new TypeError(
      `Expected argument \`jsonString\` to be a \`string\`, got \`${typeof jsonString}\``,
    );
  }

  const strip = whitespace ? stripWithWhitespace : stripWithoutWhitespace;

  let isInsideString = false;
  let inComment: null | "single" | "multi" = null;
  let offset = 0;
  let buffer = "";
  let result = "";
  let commaIndex = -1;

  for (let index = 0; index < jsonString.length; index++) {
    const currentCharacter = jsonString[index];
    const nextCharacter = jsonString[index + 1];

    if (!inComment && currentCharacter === '"') {
      // Enter or exit string
      const escaped = isEscaped(jsonString, index);
      if (!escaped) {
        isInsideString = !isInsideString;
      }
    }

    if (isInsideString) {
      continue;
    }

    if (!inComment && currentCharacter + nextCharacter === "//") {
      // Enter single-line comment
      buffer += jsonString.slice(offset, index);
      offset = index;
      inComment = "single";
      index++;
    } else if (
      inComment === "single" &&
      currentCharacter + nextCharacter === "\r\n"
    ) {
      // Exit single-line comment via \r\n
      index++;
      inComment = null;
      buffer += strip(jsonString, offset, index);
      offset = index;
      continue;
    } else if (inComment === "single" && currentCharacter === "\n") {
      // Exit single-line comment via \n
      inComment = null;
      buffer += strip(jsonString, offset, index);
      offset = index;
    } else if (!inComment && currentCharacter + nextCharacter === "/*") {
      // Enter multiline comment
      buffer += jsonString.slice(offset, index);
      offset = index;
      inComment = "multi";
      index++;
      continue;
    } else if (
      inComment === "multi" &&
      currentCharacter + nextCharacter === "*/"
    ) {
      // Exit multiline comment
      index++;
      inComment = null;
      buffer += strip(jsonString, offset, index + 1);
      offset = index + 1;
      continue;
    } else if (!inComment) {
      if (commaIndex !== -1) {
        if (currentCharacter === "}" || currentCharacter === "]") {
          // Strip trailing comma
          buffer += jsonString.slice(offset, index);
          result += strip(buffer, 0, 1) + buffer.slice(1);
          buffer = "";
          offset = index;
          commaIndex = -1;
        } else if (
          currentCharacter !== " " &&
          currentCharacter !== "\t" &&
          currentCharacter !== "\r" &&
          currentCharacter !== "\n"
        ) {
          // Hit non-whitespace following a comma, so it is not trailing
          buffer += jsonString.slice(offset, index);
          offset = index;
          commaIndex = -1;
        }
      } else if (currentCharacter === ",") {
        // Flush buffer prior to this point, and save new comma index
        result += buffer + jsonString.slice(offset, index);
        buffer = "";
        offset = index;
        commaIndex = index;
      }
    }
  }

  const remaining =
    inComment === "single"
      ? strip(jsonString, offset)
      : jsonString.slice(offset);

  return result + buffer + remaining;
};

export const parseJSONC = (jsonString: string) =>
  JSON.parse(convertJSONCToJSON(jsonString));
