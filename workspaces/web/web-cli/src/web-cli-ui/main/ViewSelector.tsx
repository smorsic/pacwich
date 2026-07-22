import { FaTerminal, FaFolderOpen } from "react-icons/fa";
import { useSetView, useView } from "../util/view";

export const ViewSelector = () => {
  const view = useView();
  const setView = useSetView();

  return (
    <div className="web-cli-view-selector">
      <button
        aria-selected={view === "tree"}
        className={`web-cli-view-selector-button${view === "tree" ? " selected" : ""}`}
        onClick={() => setView("tree")}
      >
        <FaFolderOpen />
        Project Files
      </button>
      <button
        aria-selected={view === "terminal"}
        className={`web-cli-view-selector-button${view === "terminal" ? " selected" : ""}`}
        onClick={() => setView("terminal")}
      >
        <FaTerminal />
        Terminal
      </button>
    </div>
  );
};
