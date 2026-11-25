/**
 * The invoke request/response shape the web CLI UI streams against, backed
 * by `localWebCliClient.ts`'s in-browser `runPacwichCliArgv` implementation.
 */

export type InvokeCliRequestBody = {
  argv: string[];
  terminalWidth: number;
  terminalHeight: number;
};

export type InvokeCliError = {
  message: string;
};

export type InvokeCliResponseChunk = {
  terminalOutput: string;
  streamName: "stdout" | "stderr";
  isDone: boolean;
  errors: InvokeCliError[];
  warnings: InvokeCliError[];
  exitCode: number | null;
};

export type WebCliClient = {
  invokeWebCli: (
    request: InvokeCliRequestBody,
  ) => AsyncIterable<InvokeCliResponseChunk>;
};
