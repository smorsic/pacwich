/**
 * The old (backend-driven) web CLI's request/response contract, reproduced
 * locally so the UI layer ported from documentation-website's dead
 * `bw-web-service-shared`-backed frontend can plug into a local, in-browser
 * implementation with no other changes. See `localWebCliClient.ts`.
 */

export type HealthResponse = {
  status: "ok";
  buildId: string;
  env: string;
};

export type ReadyResponse = {
  isReady: boolean;
};

export type InvokeCliRequestBody = {
  argv: string[];
  terminalWidth: number;
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

export type HttpClient = {
  health: () => Promise<HealthResponse>;
  ready: () => Promise<ReadyResponse>;
  invokeWebCli: (
    request: InvokeCliRequestBody,
  ) => AsyncIterable<InvokeCliResponseChunk>;
};
