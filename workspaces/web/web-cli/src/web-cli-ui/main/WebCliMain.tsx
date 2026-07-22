import { useCallback } from "react";
import { Terminal, type TerminalProps } from "../terminal/Terminal";
import { Tree } from "../tree/Tree";
import {
  useSetWebCliTerminalHeight,
  useSetWebCliTerminalWidth,
} from "../util/invokeWebCli";
import { useView } from "../util/view";
import { ViewSelector } from "./ViewSelector";

export const WebCliMain = () => {
  const setTerminalWidth = useSetWebCliTerminalWidth();
  const setTerminalHeight = useSetWebCliTerminalHeight();
  const view = useView();

  const onTerminalResize = useCallback<
    NonNullable<TerminalProps["onTerminalResize"]>
  >(
    ({ cols, rows }) => {
      setTerminalWidth(cols);
      setTerminalHeight(rows);
    },
    [setTerminalWidth, setTerminalHeight],
  );
  return (
    <div className="web-cli-container">
      <ViewSelector />
      {view === "terminal" && <Terminal onTerminalResize={onTerminalResize} />}
      {view === "tree" && <Tree />}
    </div>
  );
};

export default WebCliMain;
