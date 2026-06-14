import {
  isJSONObject,
  type JSONData,
  type JSONArray,
  type JSONArrayToItem,
  type JSONObject,
  type JSONPrimitive,
  type JSONPrimitiveToName,
} from "@pacwich/common/types";

type PlainStringValueToDisplay = {
  value: string;
  comment?: string;
};

type PrimitiveToDisplay<P extends JSONPrimitive = JSONPrimitive> = {
  primitive: true;
  types: Array<JSONPrimitiveToName<P>>;
  comment?: string;
};

type ArrayToDisplay<A extends JSONArray = JSONArray> = {
  array: true;
  item: ValueToDisplay<JSONArrayToItem<A>>;
  comment?: string;
};

export type ValueToDisplay<O extends JSONData = JSONData> = O extends JSONObject
  ? {
      [key in keyof O]: O[key] extends JSONPrimitive
        ? PrimitiveToDisplay<O[key]>
        : O[key] extends JSONArray
          ? ArrayToDisplay<O[key]>
          : O[key] extends JSONObject
            ? ValueToDisplay<O[key]>
            : PlainStringValueToDisplay;
    }
  : O extends JSONArray
    ? ArrayToDisplay<O>
    : O extends JSONPrimitive
      ? PrimitiveToDisplay<O>
      : PlainStringValueToDisplay;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _formatSimpleTypeToDisplay = <V extends ValueToDisplay<any>>(
  value: V,
  prev = "",
  level = 0,
) => {
  let result = prev;
  const indent = "  ".repeat(level);
  const nextIndent = "  ".repeat(level + 1);
  if ((value as { primitive: true }).primitive === true) {
    result += (value as { types: string[] }).types.join(" | ");
  } else if (isJSONObject(value)) {
    if ((value as PlainStringValueToDisplay).value) {
      result += (value as PlainStringValueToDisplay).value;
      return result;
    }

    if ((value as ArrayToDisplay).array === true) {
      result +=
        _formatSimpleTypeToDisplay((value as ArrayToDisplay).item, "", level) +
        "[]";
      return result;
    }

    result += "{\n";
    const entries = Object.entries(value as ValueToDisplay);
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i];
      if ((val as { comment: string }).comment) {
        result += (val as { comment: string }).comment
          .split("\n")
          .map((line) => indent + "  // " + line + "\n")
          .join("");
      }
      if (key === "comment") {
        continue;
      }
      result +=
        nextIndent +
        key +
        (key.includes("[") ? "" : "?") +
        ": " +
        _formatSimpleTypeToDisplay(val as ValueToDisplay, "", level + 1) +
        (i < entries.length - 1 ? ",\n" : "");
    }
    result += "\n" + indent + "}";
  }

  return result;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatSimpleTypeToDisplay = <V extends ValueToDisplay<any>>(
  value: V,
) => _formatSimpleTypeToDisplay(value);
