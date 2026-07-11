import {
  getDemoProjectFiles,
  type DemoProjectFile,
} from "@pacwich/web-common/web-cli-runtime";

export type TreeNodeData = {
  id: string;
  name: string;
  isFile: boolean;
  children?: TreeNodeData[];
};

export type BuilderNode = {
  id: string;
  name: string;
  children: Map<string, BuilderNode>;
  isFile: boolean;
};

const compareTreeNodes = (a: BuilderNode, b: BuilderNode): number => {
  if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
  return a.name.localeCompare(b.name);
};

const builderMapToArboristNodes = (
  map: Map<string, BuilderNode>,
): TreeNodeData[] =>
  [...map.values()].sort(compareTreeNodes).map((node) => {
    const children = builderMapToArboristNodes(node.children);
    if (children.length === 0) {
      return { id: node.id, name: node.name, isFile: node.isFile };
    }
    return { id: node.id, name: node.name, children, isFile: node.isFile };
  });

/** Turn flat demo project files into a nested tree for react-arborist. */
export const demoProjectFilesToArboristTree = (
  files: readonly DemoProjectFile[],
): TreeNodeData[] => {
  const root = new Map<string, BuilderNode>();

  for (const file of files) {
    const segments = file.relativePath.split("/").filter((s) => s.length > 0);
    if (segments.length === 0) continue;

    let pathAcc = "";
    let level = root;

    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]!;
      pathAcc = pathAcc ? `${pathAcc}/${name}` : name;
      const isLast = i === segments.length - 1;

      let node = level.get(name);
      if (!node) {
        node = {
          id: pathAcc,
          name,
          children: new Map(),
          isFile: isLast,
        };
        level.set(name, node);
      } else if (isLast) {
        node.isFile = true;
      }

      if (!isLast) {
        level = node.children;
      }
    }
  }

  return builderMapToArboristNodes(root);
};

export const REACT_ARBORIST_DATA = demoProjectFilesToArboristTree(
  getDemoProjectFiles(),
);
