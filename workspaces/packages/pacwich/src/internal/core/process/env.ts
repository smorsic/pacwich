export const IS_INTERNAL_TEST =
  process.env._PACWICH_IS_INTERNAL_TEST === "true";
export const IS_TEST = IS_INTERNAL_TEST || process.env.NODE_ENV === "test";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
