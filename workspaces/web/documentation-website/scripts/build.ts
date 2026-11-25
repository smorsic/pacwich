import {
  writeFileSync,
  rmSync,
  readFileSync,
  readdirSync,
  mkdirSync,
} from "fs";
import path from "path";
import { $ } from "bun";
import { createFileSystemProject } from "pacwich_local";
import packageJson from "../../../packages/pacwich/package.json";

export const runBuild = async () => {
  const project = createFileSystemProject();

  const outputPath = path.resolve("__dirname", "..", "doc_build");

  if (process.env.SKIP_PACWICH_BUILD !== "true") {
    await $`bun --cwd=${project.rootDirectory} run pw build:no-dts`;
  }

  await $`bunx rspress build`;

  if (process.env.PACWICH_DOCS_ENV === "development") {
    rmSync(path.resolve(outputPath, "sitemap.xml"), {
      recursive: true,
      force: true,
    });
    writeFileSync(
      path.resolve(outputPath, "robots.txt"),
      "User-agent: *\nDisallow: /\n",
    );
  }

  const pacwichBuildDir = path.resolve(
    project.rootDirectory,
    project.findWorkspaceByName("pacwich_local")?.path ?? "",
    "dist",
  );

  writeFileSync(
    path.resolve(outputPath, "AGENTS.md"),
    readFileSync(path.join(pacwichBuildDir, "AGENTS.md")).toString(),
  );

  mkdirSync(path.resolve(outputPath, "agents"));

  for (const agentsFile of readdirSync(path.join(pacwichBuildDir, "agents"))) {
    writeFileSync(
      path.resolve(outputPath, "agents", agentsFile),
      readFileSync(path.join(pacwichBuildDir, "agents", agentsFile)).toString(),
    );
  }

  writeFileSync(path.resolve(outputPath, "version.txt"), packageJson.version);

  const outputHtmlFiles = new Bun.Glob(
    path.resolve(outputPath, "**/*.html"),
  ).scanSync();
  for (const htmlFile of outputHtmlFiles) {
    const html = readFileSync(htmlFile, "utf8");
    writeFileSync(htmlFile, html.replace(/href=['"]\/?index['"]/g, 'href="/"'));
  }
};

if (import.meta.main) {
  await runBuild();
}
