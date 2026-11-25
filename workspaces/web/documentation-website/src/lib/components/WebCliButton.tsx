import { Link } from "@rspress/core/theme-original";

export const WebCliButton = () => {
  return (
    <div className="web-cli-button-container">
      <Link href="/web-cli" className="web-cli-button">
        Try the CLI
      </Link>
      <div className="web-cli-button-note">
        Get hands-on with a demo project, <br /> right here in the browser!
      </div>
    </div>
  );
};
