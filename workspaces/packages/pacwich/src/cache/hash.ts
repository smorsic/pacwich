import { createHash } from "crypto";
import { createReadStream } from "fs";

export const hashData = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

export const hashFile = async (filePath: string) => {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
};
