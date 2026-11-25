import { Tree as ReactArboristTree } from "react-arborist";
import { REACT_ARBORIST_DATA, type TreeNodeData } from "./arboristData";
import { useSelectedFile } from "./selection";
import { TreeContent } from "./TreeContent";
import { TreeNode } from "./TreeNode";

const createOpenState = (
  data: TreeNodeData[],
  selectedFile: string,
): Record<string, boolean> =>
  data.reduce(
    (acc, node) => {
      return {
        ...acc,
        [node.id]:
          node.id === "packages" ||
          (!!selectedFile && selectedFile.startsWith(node.id + "/")),
        ...createOpenState(node.children ?? [], selectedFile),
      };
    },
    {} as Record<string, boolean>,
  );

export const Tree = () => {
  const selectedFile = useSelectedFile();

  return (
    <div className="web-cli-tree-container">
      <div className="web-cli-tree">
        <div className="web-cli-tree-files">
          <ReactArboristTree
            data={REACT_ARBORIST_DATA}
            rowHeight={26}
            initialOpenState={createOpenState(
              REACT_ARBORIST_DATA,
              selectedFile,
            )}
            width={240}
          >
            {TreeNode}
          </ReactArboristTree>
        </div>
        <TreeContent />
      </div>
      <div className="web-cli-tree-note">
        Note: This is a read-only demo project
      </div>
    </div>
  );
};
