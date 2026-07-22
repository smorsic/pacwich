/**
 * The browser `buffer` polyfill (used by `@rsbuild/plugin-node-polyfill`)
 * predates `base64url` support, but pacwich's id generator calls
 * `Buffer.from(bytes).toString("base64url")`. rspack dedupes the `buffer`
 * module, so patching the shared `Buffer` class here fixes every reference
 * (including the auto-injected global) as long as this module is imported
 * before any pacwich module evaluates.
 */
import { Buffer } from "buffer";

const B = Buffer as unknown as {
  __base64urlPatched?: boolean;
  prototype: { toString: (encoding?: string, ...rest: unknown[]) => string };
  from: (value: unknown, encoding?: string, ...rest: unknown[]) => unknown;
};

const toBase64Url = (b64: string) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");

if (!B.__base64urlPatched) {
  const origToString = B.prototype.toString;
  B.prototype.toString = function (
    this: unknown,
    encoding?: string,
    ...rest: unknown[]
  ) {
    if (encoding === "base64url") {
      return toBase64Url(origToString.call(this, "base64"));
    }
    return origToString.call(this, encoding, ...rest);
  };

  const origFrom = B.from.bind(B);
  B.from = (value: unknown, encoding?: string, ...rest: unknown[]) => {
    if (encoding === "base64url" && typeof value === "string") {
      return origFrom(fromBase64Url(value), "base64");
    }
    return origFrom(value, encoding, ...rest);
  };

  B.__base64urlPatched = true;
}

export {};
