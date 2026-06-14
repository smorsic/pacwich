import { repository } from "../../packages/pacwich/package.json";
const releaseVersion = process.env.RELEASE_VERSION ?? "";
const commit = process.env.GITHUB_SHA ?? "";

if (!releaseVersion) throw new Error("Missing RELEASE_VERSION");
if (!commit) throw new Error("Missing GITHUB_SHA");

console.log(
  repository.url.replace(".git", "") +
    "/releases/new?tag=pacwich-v" +
    releaseVersion +
    "&title=" +
    releaseVersion +
    "&target=" +
    commit +
    "&body=" +
    encodeURIComponent(`
# Pacwich v${releaseVersion}

### Added

### Changed

### Fixed

### Removed
`),
);
