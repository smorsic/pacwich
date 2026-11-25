import { getDemoProjectFiles } from "../../web-cli-runtime";
import { SyntaxHighlighter } from "../util/highlight";
import { useSelectedFile } from "./selection";

const EXTENSION_LANGUAGES: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".html": "html",
  ".yaml": "yaml",
  ".yml": "yaml",
};

const languageForPath = (relativePath: string | undefined): string => {
  const extension = Object.keys(EXTENSION_LANGUAGES).find((ext) =>
    relativePath?.endsWith(ext),
  );
  return extension ? EXTENSION_LANGUAGES[extension] : "json";
};

export const TreeContent = () => {
  const selectedFile = useSelectedFile();
  const fileData = getDemoProjectFiles().find(
    (file) => file.relativePath === selectedFile,
  );

  return (
    <div className="web-cli-tree-content">
      <SyntaxHighlighter
        wrapLongLines
        language={languageForPath(fileData?.relativePath)}
      >
        {fileData?.content ?? ""}
      </SyntaxHighlighter>
    </div>
  );
};
