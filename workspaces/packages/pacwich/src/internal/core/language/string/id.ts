export const createShortId = (bytes = 12) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);

  return Buffer.from(buf)
    .toString("base64url")
    .slice(0, Math.ceil((bytes * 4) / 3));
};
