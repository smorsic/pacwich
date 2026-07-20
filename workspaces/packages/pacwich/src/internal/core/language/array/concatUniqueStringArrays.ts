/** Concatenates and dedupes two optional string arrays; `undefined` if both are empty/absent. */
export const concatUniqueStringArrays = (
  base: string[] | undefined,
  override: string[] | undefined,
): string[] | undefined => {
  if (!base?.length && !override?.length) return undefined;
  return [...new Set([...(base ?? []), ...(override ?? [])])];
};
