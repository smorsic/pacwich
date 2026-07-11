import { getDemoProjectFiles } from "@pacwich/web-common/web-cli-runtime";
import { SyntaxHighlighter } from "../../util/highlight";
import { useSelectedFile } from "./selection";

export const TreeContent = () => {
  const selectedFile = useSelectedFile();
  const fileData = getDemoProjectFiles().find(
    (file) => file.relativePath === selectedFile,
  );

  return (
    <div className="web-cli-tree-content">
      <SyntaxHighlighter
        wrapLongLines
        language={
          fileData?.relativePath.endsWith(".ts")
            ? "typescript"
            : fileData?.relativePath.endsWith(".tsx")
              ? "tsx"
              : fileData?.relativePath.endsWith(".html")
                ? "html"
                : "json"
        }
      >
        {fileData?.content ?? ""}
      </SyntaxHighlighter>
    </div>
  );
};
