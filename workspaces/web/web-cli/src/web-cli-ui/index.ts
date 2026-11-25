/**
 * The web CLI's UI component tree, shared between workspaces/web/web-cli and
 * documentation-website's /web-cli page so there's exactly one implementation
 * instead of two hand-synced copies. Host apps supply their own footer notes
 * (copy/links legitimately differ per site) via `WebCliPage`'s `notes` prop.
 */
export { WebCliPage } from "./WebCliPage";
export type { WebCliPageProps } from "./WebCliPage";
