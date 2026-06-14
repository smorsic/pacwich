export const createRawPattern = (pattern: string) =>
  pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createWildcardRegex = (pattern: string) =>
  new RegExp(`^${pattern.split("*").map(createRawPattern).join(".*")}$`);
