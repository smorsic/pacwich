import { useCallback } from "react";
import type { NodeRendererProps } from "react-arborist";
import { type TreeNodeData } from "./arboristData";
import { useSelectedFile, useSetSelectedFile } from "./selection";

export const TreeNode = ({ node, style }: NodeRendererProps<TreeNodeData>) => {
  const selectedFile = useSelectedFile();
  const setSelectedFile = useSetSelectedFile();

  const onClick = useCallback(() => {
    if (node.data.isFile) {
      setSelectedFile(node.data.id);
    } else {
      node.toggle();
    }
  }, [setSelectedFile, node]);

  const classNames = ["web-cli-tree-node"];
  if (!node.data.isFile) classNames.push("directory");
  if (node.isOpen) classNames.push("open");
  if (!node.data.isFile && selectedFile.startsWith(node.data.id))
    classNames.push("selected-parent");
  if (selectedFile === node.data.id) classNames.push("selected");
  if (!node.data.isFile) classNames.push("directory");

  return (
    <button style={style} className={classNames.join(" ")} onClick={onClick}>
      <span>
        {node.data.name}
        {node.data.isFile ? "" : "/"}
      </span>
    </button>
  );
};
