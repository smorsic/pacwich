import type {
  ParallelMaxValue,
  ScriptShellOption,
} from "@pacwich/common/parameters";
import { createAsyncIterableQueue } from "../internal/core";
import { logger } from "../internal/logger";
import type { ScriptCommand } from "../packageManager/adapter";
import {
  createProcessOutput,
  createMultiProcessOutput,
  type MultiProcessOutput,
  type BytesOutput,
  type OutputStreamName,
} from "./output";
import { determineParallelMax } from "./parallel";
import {
  runScript,
  type RunScriptExit,
  type RunScriptResult,
} from "./runScript";

export type RunScriptsScript<ScriptMetadata extends object = object> = {
  scriptCommand: ScriptCommand;
  metadata: ScriptMetadata;
  env: Record<string, string>;
  /** The shell to use to run the script */
  shell?: ScriptShellOption;
  /** Indices of other scripts in the array that must complete before this one starts */
  dependsOn?: number[];
  /** Set to `true` to ignore all output from the script. This saves memory when you don't need script output. */
  ignoreOutput?: boolean;
};

export type RunScriptsScriptResult<ScriptMetadata extends object = object> = {
  /** The result of running the script */
  result: RunScriptResult<ScriptMetadata>;
};

/** Aggregate outcome of a batch script run, with per-script exit details in `scriptResults`. */
export type RunScriptsSummary<ScriptMetadata extends object = object> = {
  totalCount: number;
  successCount: number;
  failureCount: number;
  allSuccess: boolean;
  startTimeISO: string;
  endTimeISO: string;
  durationMs: number;
  scriptResults: RunScriptExit<ScriptMetadata>[];
};

/** Lifecycle event emitted per script during a batch run: `"start"`, `"skip"` (a dependency failed), or `"exit"`. */
export type ScriptEventName = "start" | "skip" | "exit";

export type RunScriptsResult<ScriptMetadata extends object = object> = {
  output: MultiProcessOutput<ScriptMetadata & { streamName: OutputStreamName }>;
  /** Resolves with a results summary after all scripts have exited */
  summary: Promise<RunScriptsSummary<ScriptMetadata>>;
};

export type RunScriptsParallelOptions = {
  max: ParallelMaxValue;
};

export type RunScriptsOptions<ScriptMetadata extends object = object> = {
  scripts: RunScriptsScript<ScriptMetadata>[];
  parallel: boolean | RunScriptsParallelOptions;
  /** When true, run scripts even if a dependency failed. Default: false (skip them). */
  ignoreDependencyFailure?: boolean;
  /** Set to `true` to ignore all output from the scripts. This saves memory when you don't need script output. */
  ignoreOutput?: boolean;
  /** Callback to invoke when a script event occurs */
  onScriptEvent?: (
    event: ScriptEventName,
    scriptIndex: number,
    result: RunScriptExit<ScriptMetadata> | null,
  ) => void;
};

/** Validate dependency indices and detect cycles via DFS */
const validateScriptDependencies = (
  scripts: { dependsOn?: number[] }[],
): void => {
  const scriptCount = scripts.length;

  for (let i = 0; i < scriptCount; i++) {
    const deps = scripts[i].dependsOn;
    if (!deps) continue;

    for (const dep of deps) {
      if (dep === i) {
        throw new Error(
          `Script at index ${i} has a self-referencing dependency`,
        );
      }
      if (dep < 0 || dep >= scriptCount) {
        throw new Error(
          `Script at index ${i} depends on invalid index ${dep} (valid range: 0-${scriptCount - 1})`,
        );
      }
    }
  }

  const UNVISITED = 0;
  const VISITING = 1;
  const DONE = 2;
  const nodeStates = new Array<number>(scriptCount).fill(UNVISITED);

  const visit = (node: number, path: number[]): void => {
    nodeStates[node] = VISITING;
    const deps = scripts[node].dependsOn;
    if (deps) {
      for (const dep of deps) {
        if (nodeStates[dep] === VISITING) {
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart);
          throw new Error(
            `Dependency cycle detected: ${[...cycle, dep].join(" -> ")}`,
          );
        }
        if (nodeStates[dep] === UNVISITED) {
          visit(dep, [...path, dep]);
        }
      }
    }
    nodeStates[node] = DONE;
  };

  for (let i = 0; i < scriptCount; i++) {
    if (nodeStates[i] === UNVISITED) {
      visit(i, [i]);
    }
  }
};

/** Run a list of scripts */
export const runScripts = <ScriptMetadata extends object = object>({
  scripts,
  parallel,
  ignoreDependencyFailure = false,
  ignoreOutput = false,
  onScriptEvent,
}: RunScriptsOptions<ScriptMetadata>): RunScriptsResult<ScriptMetadata> => {
  validateScriptDependencies(scripts);

  const startTime = new Date();

  type ScriptTrigger = {
    promise: Promise<ScriptTrigger>;
    trigger: () => void;
    index: number;
  };

  const scriptTriggers: ScriptTrigger[] = scripts.map((_, index) => {
    let trigger: () => void = () => {
      void 0;
    };

    const promise = new Promise<ScriptTrigger>((res) => {
      trigger = () => res(result);
    });

    const result: ScriptTrigger = {
      promise,
      trigger,
      index,
    };

    return result;
  });

  const scriptResults: RunScriptsScriptResult<ScriptMetadata>[] = scripts.map(
    () => null as never as RunScriptsScriptResult<ScriptMetadata>,
  );

  const parallelMax =
    parallel === false
      ? 1
      : determineParallelMax(
          typeof parallel === "boolean" ? "default" : parallel.max,
        );

  const parallelBatchSize = Math.min(parallelMax, scripts.length);
  const recommendedParallelMax = determineParallelMax("auto");
  if (
    parallel &&
    parallelBatchSize > recommendedParallelMax &&
    process.env._PACWICH_IS_INTERNAL_TEST !== "true"
  ) {
    logger.warn(
      `Number of scripts to run in parallel (${parallelBatchSize}) is greater than the available CPUs (${recommendedParallelMax})`,
    );
  }

  const pendingScripts = new Set<number>(scripts.map((_, i) => i));
  const runningScripts = new Set<number>();
  const completedScripts = new Set<number>();
  const exitResults: (RunScriptExit<ScriptMetadata> | null)[] = scripts.map(
    () => null,
  );

  // Eagerly-created output iterators to prevent race condition where a fast
  // process completes and its ProcessOutput stream is fully drained before
  // handleScriptProcesses calls .bytes() (which throws OutputStreamDone).
  type ScriptProcessBytes = BytesOutput<
    ScriptMetadata & { streamName: OutputStreamName }
  >;
  const scriptProcessBytes: (ScriptProcessBytes | null)[] = scripts.map(
    () => null,
  );

  const createSkippedExit = (index: number): RunScriptExit<ScriptMetadata> => {
    const now = new Date().toISOString();
    return {
      exitCode: -1,
      signal: null,
      success: false,
      skipped: true,
      startTimeISO: now,
      endTimeISO: now,
      durationMs: 0,
      metadata: scripts[index].metadata,
    };
  };

  const createSkippedResult = (
    index: number,
  ): RunScriptsScriptResult<ScriptMetadata> => {
    const skippedExit = createSkippedExit(index);
    exitResults[index] = skippedExit;
    return {
      result: {
        output: createMultiProcessOutput([]),
        exit: Promise.resolve(skippedExit),
        metadata: scripts[index].metadata,
        kill: () => {
          /* empty */
        },
      },
    };
  };

  const hasDependencyFailure = (index: number): boolean => {
    const deps = scripts[index].dependsOn;
    if (!deps) return false;
    return deps.some(
      (dep) => exitResults[dep] !== null && !exitResults[dep]!.success,
    );
  };

  const areDependenciesMet = (index: number): boolean => {
    const deps = scripts[index].dependsOn;
    if (!deps) return true;
    return deps.every((dep) => completedScripts.has(dep));
  };

  const scriptOutputQueues = scripts.map(() => ({
    stdout: createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>(),
    stderr: createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>(),
  }));

  const scheduleReadyScripts = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const index of [...pendingScripts]) {
        if (runningScripts.size >= parallelMax) return;
        if (!areDependenciesMet(index)) continue;

        if (!ignoreDependencyFailure && hasDependencyFailure(index)) {
          pendingScripts.delete(index);
          completedScripts.add(index);
          scriptResults[index] = createSkippedResult(index);
          scriptProcessBytes[index] = (async function* () {
            /* empty */
          })();
          scriptOutputQueues[index].stdout.close();
          scriptOutputQueues[index].stderr.close();
          onScriptEvent?.("skip", index, null);
          scriptTriggers[index].trigger();
          changed = true;
          continue;
        }

        pendingScripts.delete(index);
        runningScripts.add(index);

        const scriptResult = {
          ...scripts[index],
          result: runScript({
            ...scripts[index],
            env: {
              ...scripts[index].env,
              _PACWICH_PARALLEL_MAX: parallelMax.toString(),
            },
            ignoreOutput,
          }),
        };

        scriptResults[index] = scriptResult;
        const bytesOutput = scriptResult.result.output.bytes();
        scriptProcessBytes[index] = bytesOutput;
        (async () => {
          for await (const { chunk, metadata } of bytesOutput) {
            scriptOutputQueues[index][metadata.streamName].push(chunk);
          }
          scriptOutputQueues[index].stdout.close();
          scriptOutputQueues[index].stderr.close();
        })();

        onScriptEvent?.("start", index, null);
        scriptTriggers[index].trigger();

        scriptResult.result.exit.then((exit) => {
          runningScripts.delete(index);
          completedScripts.add(index);
          exitResults[index] = exit;
          onScriptEvent?.("exit", index, exit);
          scheduleReadyScripts();
        });
      }
    }
  };

  const multiProcessOutput = createMultiProcessOutput<
    ScriptMetadata & { streamName: OutputStreamName }
  >(
    scriptOutputQueues.flatMap(({ stdout, stderr }, index) => [
      createProcessOutput(stdout, {
        ...scripts[index].metadata,
        streamName: "stdout",
      }),
      createProcessOutput(stderr, {
        ...scripts[index].metadata,
        streamName: "stderr",
      }),
    ]),
  );

  const handleScriptProcesses = async () => {
    let pendingScriptCount = scripts.length;
    while (pendingScriptCount > 0) {
      const { index } = await Promise.race(
        scriptTriggers.map((trigger) => trigger.promise),
      );

      pendingScriptCount--;

      scriptTriggers[index].promise = new Promise<never>(() => {
        void 0;
      });
    }

    await Promise.all(
      scriptOutputQueues.flatMap(({ stdout, stderr }) => [
        stdout.closed,
        stderr.closed,
      ]),
    );
    await Promise.all(scriptResults.map(({ result }) => result.exit));
  };

  const awaitSummary = async () => {
    scheduleReadyScripts();

    await handleScriptProcesses();

    const scriptExitResults = await Promise.all(
      scripts.map((_, index) => scriptResults[index].result.exit),
    );

    const endTime = new Date();

    return {
      totalCount: scriptExitResults.length,
      successCount: scriptExitResults.filter((exit) => exit.success).length,
      failureCount: scriptExitResults.filter((exit) => !exit.success).length,
      allSuccess: scriptExitResults.every((exit) => exit.success),
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
      scriptResults: scriptExitResults,
    };
  };

  return {
    output: multiProcessOutput,
    summary: awaitSummary(),
  };
};
