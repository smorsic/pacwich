import { describe, expect, it, vi } from "vitest";
import { debounce } from "../src/workspacesView/debounce";

describe("debounce", () => {
  it("only calls fn once after the wait period following a single trigger", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const scheduled = debounce(fn, { waitMs: 500, maxWaitMs: 2000 });

    scheduled();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("coalesces a burst of triggers into a single call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const scheduled = debounce(fn, { waitMs: 500, maxWaitMs: 2000 });

    scheduled();
    vi.advanceTimersByTime(200);
    scheduled();
    vi.advanceTimersByTime(200);
    scheduled();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("fires at maxWaitMs even if triggers keep resetting the wait timer", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const scheduled = debounce(fn, { waitMs: 500, maxWaitMs: 2000 });

    scheduled();
    // Keep resetting the wait timer before it fires, up to just under maxWaitMs.
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(400); // total elapsed: 1600ms
      scheduled();
    }
    expect(fn).not.toHaveBeenCalled();

    // maxWaitMs (measured from the first call) fires here regardless.
    vi.advanceTimersByTime(400); // total elapsed: 2000ms
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
