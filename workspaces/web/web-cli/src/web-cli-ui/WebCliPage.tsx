import { lazy, type ReactNode, Suspense } from "react";

const WebCliMainLazy = lazy(() => import("./main/WebCliMain"));

import "../css/web-cli.css";

export type WebCliPageProps = {
  /** App-specific footer notes (links/copy differ per host site). */
  notes?: ReactNode;
};

export const WebCliPage = ({ notes }: WebCliPageProps) => {
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
      <Suspense fallback={<div className="web-cli-placeholder" />}>
        <WebCliMainLazy />
      </Suspense>
      {notes}
    </div>
  );
};
