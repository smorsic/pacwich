export interface PnpmWorkspaceYamlOptions {
  packages: string[];
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
  /** Verbatim text prepended above `packages:` (caller adds any `# ` prefix). */
  header?: string;
}

export const formatPnpmWorkspaceYaml = ({
  packages,
  catalog,
  catalogs,
  header,
}: PnpmWorkspaceYamlOptions): string => {
  const sections: string[] = [];

  let packagesSection = "";
  if (header) packagesSection += `${header}\n`;
  if (packages.length === 0) {
    packagesSection += "packages: []";
  } else {
    packagesSection += "packages:\n";
    packagesSection += packages.map((glob) => `  - "${glob}"`).join("\n");
  }
  sections.push(packagesSection);

  if (catalog && Object.keys(catalog).length > 0) {
    const lines = ["catalog:"];
    for (const [depName, version] of Object.entries(catalog)) {
      lines.push(`  "${depName}": ${version}`);
    }
    sections.push(lines.join("\n"));
  }

  if (catalogs && Object.keys(catalogs).length > 0) {
    const lines = ["catalogs:"];
    for (const [catalogName, deps] of Object.entries(catalogs)) {
      lines.push(`  ${catalogName}:`);
      for (const [depName, version] of Object.entries(deps)) {
        lines.push(`    "${depName}": ${version}`);
      }
    }
    sections.push(lines.join("\n"));
  }

  return `${sections.join("\n\n")}\n`;
};

export const readWorkspacePackages = (pkgJson: {
  workspaces?: unknown;
}): string[] => {
  const ws = pkgJson.workspaces;
  if (Array.isArray(ws)) {
    return ws.filter((entry): entry is string => typeof entry === "string");
  }
  if (
    ws &&
    typeof ws === "object" &&
    Array.isArray((ws as { packages?: unknown }).packages)
  ) {
    return (ws as { packages: unknown[] }).packages.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return [];
};
