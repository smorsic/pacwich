import { PmTabs } from "../components/PmTabs";

const installDescription =
  "Install the package in your project's devDependencies";

const PM_INSTALL = {
  bun: {
    code: "bun add -d pacwich",
    description: installDescription,
  },
  pnpm: {
    code: "pnpm add -D pacwich",
    description: installDescription,
  },
  npm: {
    code: "npm install -D pacwich",
    description: installDescription,
  },
};

export const ApiInstall = () => {
  return (
    <PmTabs
      title="Install"
      sections={{
        bun: [
          {
            code: PM_INSTALL.bun.code,
            description: PM_INSTALL.bun.description,
          },
        ],
        pnpm: [
          {
            code: "pnpm add -D pacwich",
            description: installDescription,
          },
        ],
        npm: [
          {
            code: "npm install -D pacwich",
            description: installDescription,
          },
        ],
      }}
    />
  );
};

/* Separate for markdown generation */
export const ApiInstallAlt = () => {
  return (
    <div
      style={{
        visibility: "hidden",
        position: "absolute",
        left: "-9999px",
      }}
    >
      <div>
        Alt install instructions for .md page in place of {`<ApiInstall />`}{" "}
        above:
      </div>
      <div>Installing:</div>
      {Object.entries(PM_INSTALL).map(([pm, command]) => (
        <div key={`api-install-${pm}`}>
          <h3>{pm}:</h3>
          <div>
            Install: <code>{command.code}</code>
          </div>
        </div>
      ))}
    </div>
  );
};
