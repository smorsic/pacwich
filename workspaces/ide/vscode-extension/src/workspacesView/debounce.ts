export type DebounceOptions = {
  waitMs: number;
  maxWaitMs: number;
};

/**
 * Trailing debounce with a max-wait cap, so a burst of events that never
 * fully quiets down (e.g. a long-running install) still fires eventually.
 */
export const debounce = (
  fn: () => void,
  { waitMs, maxWaitMs }: DebounceOptions,
): (() => void) => {
  let waitTimeout: ReturnType<typeof setTimeout> | undefined;
  let maxWaitTimeout: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (waitTimeout) clearTimeout(waitTimeout);
    if (maxWaitTimeout) clearTimeout(maxWaitTimeout);
    waitTimeout = undefined;
    maxWaitTimeout = undefined;
    fn();
  };

  return () => {
    if (waitTimeout) clearTimeout(waitTimeout);
    waitTimeout = setTimeout(run, waitMs);
    if (!maxWaitTimeout) maxWaitTimeout = setTimeout(run, maxWaitMs);
  };
};
