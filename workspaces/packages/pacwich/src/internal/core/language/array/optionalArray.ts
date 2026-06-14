/**
 * A value that may be its type T or an array of T.
 */
export type OptionalArray<
  T = unknown,
  IncludeReadonly extends boolean = false,
> = IncludeReadonly extends true ? T | T[] | readonly T[] : T | T[];

export type ResolvedOptionalArray<T extends OptionalArray> =
  T extends (infer Item)[] ? Item[] : T[];

export type ResolvedOptionalArrayItem<T extends OptionalArray> =
  T extends (infer Item)[] ? Item : T;

/** Resolve `OptionalArray<T>` to `T[]` */
export const resolveOptionalArray = <T extends OptionalArray>(
  value: T,
): ResolvedOptionalArray<T> =>
  value === undefined
    ? ([] as never)
    : Array.isArray(value)
      ? (value as never)
      : ([value] as never);
