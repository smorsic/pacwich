type JSONPrimitiveMap = {
  string: string;
  number: number;
  boolean: boolean;
  null: null;
};

export type JSONPrimitiveName = keyof JSONPrimitiveMap;

export type JSONPrimitiveToName<P extends JSONPrimitive> = {
  [key in keyof JSONPrimitiveMap]: P extends JSONPrimitiveMap[key]
    ? key
    : never;
}[keyof JSONPrimitiveMap];

export type NameToJSONPrimitive<Name extends JSONPrimitiveName> =
  JSONPrimitiveMap[Name];

export type JSONPrimitive<N extends JSONPrimitiveName = JSONPrimitiveName> =
  NameToJSONPrimitive<N>;

export interface JSONObject {
  [key: string]: JSONData;
}

export type JSONItem = JSONPrimitive | JSONObject;

export type JSONArrayItem =
  | JSONItem
  | JSONItem[]
  | JSONItem[][]
  | JSONItem[][][]
  | JSONItem[][][][]
  | JSONItem[][][][][]
  | JSONItem[][][][][][]
  | JSONItem[][][][][][][]
  | JSONItem[][][][][][][][]
  | JSONItem[][][][][][][][][]
  | JSONItem[][][][][][][][][][]
  | JSONItem[][][][][][][][][][][];

export type JSONArray<Item extends JSONArrayItem = JSONArrayItem> = Item[];

export type JSONArrayToItem<A extends JSONArray> = A extends (infer Item)[]
  ? Item
  : never;

export type JSONData = JSONPrimitive | JSONObject | JSONArray;

export const isJSONObject = <T extends JSONObject = JSONObject>(
  value: unknown,
): value is T =>
  typeof value === "object" &&
  value !== null &&
  (value as object)?.constructor === Object;

export const isJSONPrimitive = (value: unknown): value is JSONPrimitive =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null;

export const isJSONArray = <T extends JSONArray = JSONArray>(
  value: unknown,
): value is T => Array.isArray(value) && value.every(isJSON);

export const isJSON = (value: unknown): value is JSONData =>
  isJSONPrimitive(value) || isJSONArray(value) || isJSONObject(value);
