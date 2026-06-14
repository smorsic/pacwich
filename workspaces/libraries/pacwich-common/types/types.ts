export type RequiredDeep<T> = T extends object
  ? Required<{
      [K in keyof T]: RequiredDeep<T[K]>;
    }>
  : T;

export type PartialDeep<T> = T extends object
  ? Partial<{
      [K in keyof T]: PartialDeep<T[K]>;
    }>
  : T;
