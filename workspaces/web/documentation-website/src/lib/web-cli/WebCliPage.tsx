import { WebCli } from "@pacwich/web-cli/ui";
import { WebCliNotes } from "./WebCliNotes";

export const WebCliPage = () => {
  return (
    <div className="web-cli-page">
      <div className="web-cli-page-header">
        <h1>Web CLI</h1>
        <p>
          Try the CLI right here in your browser!
          <br />
          This uses a demo project you can view in the Project Files below.
        </p>
        <div className="web-cli-mobile-warning">
          You may have a better experience with the Web CLI on desktop.
        </div>
      </div>
      <WebCli />
      <WebCliNotes />
    </div>
  );
};
