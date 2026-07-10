/**
 * Local, in-browser implementation of the old web CLI's `HttpClient`
 * interface, backed by `runPacwichCliArgv` (the real pacwich CLI running
 * over memfs) instead of a network call to a (now-defunct) backend service.
 * `health`/`ready` resolve immediately — there's no separate service to
 * probe, only this same page's own bundle initializing.
 *
 * `errors`/`warnings` stay empty on every chunk: neither the CLI's
 * `writeOutput` hook nor the mocked subprocess produce structured
 * error/warning objects today, so inventing a derivation from stderr text
 * would be unbacked complexity. Failures are already visible via the normal
 * stderr-as-red-ANSI rendering path in `TerminalScreen`.
 */
import { runPacwichCliArgv } from "../../../cli/runPacwichCli";
import type { HttpClient, InvokeCliResponseChunk } from "./webCliClientTypes";

const makeChunk = (
  overrides: Partial<InvokeCliResponseChunk>,
): InvokeCliResponseChunk => ({
  terminalOutput: "",
  streamName: "stdout",
  isDone: false,
  errors: [],
  warnings: [],
  exitCode: null,
  ...overrides,
});

export const localWebCliClient: HttpClient = {
  health: () =>
    Promise.resolve({ status: "ok", buildId: "local", env: "local" }),
  ready: () => Promise.resolve({ isReady: true }),
  // A small pull queue: `onOutput` fires synchronously as the CLI writes, so
  // each chunk is queued and this generator yields them as they arrive
  // rather than batching until the run finishes — the mocked script output's
  // per-line delays (see demo-project/scriptMocks.ts) are meant to be seen
  // streaming into the terminal, not dumped all at once.
  invokeWebCli: async function* invokeWebCli({ argv, terminalWidth }) {
    const queue: InvokeCliResponseChunk[] = [];
    let notify: (() => void) | null = null;
    let finished = false;

    const push = (chunk: InvokeCliResponseChunk) => {
      queue.push(chunk);
      notify?.();
      notify = null;
    };

    const runPromise = runPacwichCliArgv(argv, {
      terminalWidth,
      onOutput: (text, stream) =>
        push(makeChunk({ terminalOutput: text, streamName: stream })),
    }).finally(() => {
      finished = true;
      notify?.();
      notify = null;
    });

    while (!finished || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
        continue;
      }
      yield queue.shift()!;
    }

    const { exitCode } = await runPromise;
    yield makeChunk({ isDone: true, exitCode });
  },
};
