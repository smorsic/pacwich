import { createLogger } from "../internal/logger";

export const fatalErrorLogger = createLogger("fatalError");
fatalErrorLogger.printLevel = "error";
