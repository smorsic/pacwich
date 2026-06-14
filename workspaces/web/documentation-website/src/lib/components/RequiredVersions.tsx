import { TOOL_VERSIONS } from "@pacwich/common/toolVersions";
import { useId } from "react";

export const RequiredVersions = () => {
  const id = useId();
  return (
    <p>
      Version requirements:
      <br />
      {Object.entries(TOOL_VERSIONS).map(
        ([toolName, toolVersionData], index) => (
          <span key={id + toolName}>
            <b>{toolName}:</b> {toolVersionData.endUserRequirement}{" "}
            {index < Object.keys(TOOL_VERSIONS).length - 1 && "| "}
          </span>
        ),
      )}
    </p>
  );
};
