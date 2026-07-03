import { useCallback } from "react";
import { useSetWebCliTerminalWidth } from "./state/invokeWebCli";
import { useView } from "./state/view";
import { Terminal, type TerminalProps } from "./terminal/Terminal";
import { Tree } from "./tree/Tree";
import { ViewSelector } from "./ViewSelector";
import "./webCli.css";

/**
 * The shared Web CLI experience: a view selector over an xterm terminal (the
 * real pacwich CLI, running in-browser over memfs) and a file tree of the demo
 * project. Rendered both by this package's preview app and by the docs site.
 *
 * The surrounding chrome (page header, notes) and theme CSS variables come from
 * the host — see the docs' WebCliPage and this package's preview theme.
 */
export const WebCli = () => {
  const setTerminalWidth = useSetWebCliTerminalWidth();
  const view = useView();

  const onTerminalResize = useCallback<
    NonNullable<TerminalProps["onTerminalResize"]>
  >(
    ({ cols }) => {
      setTerminalWidth(cols);
    },
    [setTerminalWidth],
  );
  return (
    <div className="web-cli-container">
      <ViewSelector />
      {view === "terminal" && <Terminal onTerminalResize={onTerminalResize} />}
      {view === "tree" && <Tree />}
    </div>
  );
};
