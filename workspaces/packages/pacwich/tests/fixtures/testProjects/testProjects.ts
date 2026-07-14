import fs from "fs";
import path from "path";
import { IS_WINDOWS } from "../../../src/internal/core";
import { withWindowsPath } from "../../util/windows";

const TEST_PROJECTS = {
  default: "fullProject",
  fullProject: "fullProject",
  notAProject: "notAProject",
  simple1: "simple1",
  simple2: "simple2",
  simpleWorkspaceGlobs: "simpleWorkspaceGlobs",
  emptyWorkspaces: "emptyWorkspaces",
  emptyScripts: "emptyScripts",
  withNodeModuleWorkspace: "withNodeModuleWorkspace",
  oneWorkspace: "oneWorkspace",
  negationGlobs: "negationGlobs",
  invalidBadJson: "invalid/badJson",
  invalidNoName: "invalid/noName",
  invalidDuplicateName: "invalid/duplicateName",
  invalidDuplicateAlias: "invalid/duplicateAlias",
  invalidBadTypeWorkspaces: "invalid/badTypeWorkspaces",
  badWorkspaceInvalidName: "invalid/badWorkspaceInvalidName",
  invalidBadTypeScripts: "invalid/badTypeScripts",
  invalidNoPackageJson: "invalid/noPackageJson",
  invalidBadWorkspaceGlobType: "invalid/badWorkspaceGlobType",
  invalidBadWorkspaceGlobOutsideRoot: "invalid/badWorkspaceGlobOutsideRoot",
  invalidAliasConflict: "invalid/aliasConflict",
  runScriptWithDelays: "forRunScript/withDelays",
  runScriptWithFailures: "forRunScript/withFailures",
  runScriptWithMixedOutput: "forRunScript/withMixedOutput",
  runScriptWithEchoArgs: "forRunScript/withEchoArgs",
  runScriptWithMetacharScriptName: "forRunScript/withMetacharScriptName",
  runScriptWithRuntimeMetadataDebug: "forRunScript/withRuntimeMetadataDebug",
  runScriptWithDelaysAndSequenceConfig:
    "forRunScript/withDelaysAndSequenceConfig",
  runScriptWithDebugParallelMax: "forRunScript/withDebugParallelMax",
  runScriptWithDebugParallelMaxRootDefault:
    "forRunScript/withDebugParallelMaxRootDefault",
  runScriptWithSequenceConfig: "forRunScript/withSequenceConfig",
  runScriptWithSequenceConfigPartial: "forRunScript/withSequenceConfigPartial",
  runScriptForGroupedOutput: "forRunScript/forGroupedOutput",
  runScriptWithDebugArgv: "forRunScript/withDebugArgv",
  runScriptWithScriptMetadataApi: "forRunScript/withScriptMetadataApi",
  workspaceConfigPackageOnly: "workspaceConfig/packageOnly",
  workspaceConfigPackageFileMix: "workspaceConfig/packageFileMix",
  workspaceConfigFileOnly: "workspaceConfig/fileOnly",
  workspaceConfigInvalidConfig: "workspaceConfig/invalidConfig",
  workspaceConfigInvalidJson: "workspaceConfig/invalidJson",
  workspaceConfigTsInvalid: "workspaceConfig/tsInvalid",
  workspaceConfigTsInvalidViaDefine: "workspaceConfig/tsInvalidViaDefine",
  workspaceConfigTsPrecedence: "workspaceConfig/tsPrecedence",
  workspaceConfigTsConfig: "workspaceConfig/tsConfig",
  workspaceConfigTsEmpty: "workspaceConfig/tsEmpty",
  workspaceConfigJsPrecedence: "workspaceConfig/jsPrecedence",
  workspaceConfigJsConfig: "workspaceConfig/jsConfig",
  workspaceTags: "workspaceTags",
  projectConfigTsFile: "projectConfig/tsFile",
  projectConfigTsRelativeImport: "projectConfig/tsRelativeImport",
  projectConfigTsEmpty: "projectConfig/tsEmpty",
  projectConfigTsInvalid: "projectConfig/tsInvalid",
  projectConfigTsInvalidViaDefine: "projectConfig/tsInvalidViaDefine",
  projectConfigTsPrecedence: "projectConfig/tsPrecedence",
  projectConfigJsFile: "projectConfig/jsFile",
  projectConfigJsPrecedence: "projectConfig/jsPrecedence",
  projectConfigJsoncFile: "projectConfig/jsoncFile",
  projectConfigPackage: "projectConfig/package",
  projectConfigInvalidJson: "projectConfig/invalidJson",
  projectConfigInvalidType: "projectConfig/invalidType",
  projectConfigInvalidPatternEntry: "projectConfig/invalidPatternEntry",
  projectConfigInvalidShell: "projectConfig/invalidShell",
  projectConfigInvalidParallel: "projectConfig/invalidParallel",
  projectConfigParallelMaxOnly: "projectConfig/parallelMaxOnly",
  projectConfigCliScriptOutputStylePlain:
    "projectConfig/cliScriptOutputStylePlain",
  projectConfigPackageManagerNpm: "projectConfig/packageManagerNpm",
  projectConfigWorkspacePatternConfigs: "projectConfig/workspacePatternConfigs",
  projectConfigWorkspacePatternConfigsFactory:
    "projectConfig/workspacePatternConfigsFactory",
  withCatalogSimple: "withCatalog/simple",
  withRootWorkspace: "withRootWorkspace/simple",
  withRootWorkspaceWithConfigFiles: "withRootWorkspace/withConfigFiles",
  withDependenciesSimple: "withDependencies/simple",
  withDependenciesSimpleWithDelays: "withDependencies/simpleWithDelays",
  withDependenciesWithFailures: "withDependencies/withFailures",
  withDependenciesDirectCycle: "withDependencies/withDirectCycle",
  withDependenciesIndirectCycle: "withDependencies/withIndirectCycle",
  withDependenciesIndirectCycleMixed: "withDependencies/withIndirectCycleMixed",
  withDependenciesCatalogDependencies:
    "withDependencies/withCatalogDependencies",
  withDependenciesWithExternal: "withDependencies/withExternalDependencies",
  withDependenciesWithExternalCatalog:
    "withDependencies/withExternalDependenciesCatalog",
  withDependencyRulesDenyDirect:
    "withDependencies/withDependencyRulesDenyDirect",
  withDependencyRulesDenyIndirect:
    "withDependencies/withDependencyRulesDenyIndirect",
  withDependencyRulesAllowDirect:
    "withDependencies/withDependencyRulesAllowDirect",
  withDependencyRulesAllowIndirect:
    "withDependencies/withDependencyRulesAllowIndirect",
  withDependencyRulesDirectCycle:
    "withDependencies/withDependencyRulesDirectCycle",
  withDependencyRulesIndirectCycle:
    "withDependencies/withDependencyRulesIndirectCycle",
  withDependencyRulesMultiViolation:
    "withDependencies/withDependencyRulesMultiViolation",
  withDependencyRulesMultiValid:
    "withDependencies/withDependencyRulesMultiValid",
  recursiveScript: "recursiveScript",
  affectedWithInputs: "affected/withInputs",
  affectedWithExternalDepInputs: "affected/withExternalDepInputs",
  npmSmoke: "npmSmoke",
  pnpmSmoke: "pnpmSmoke",
  semverWorkspaceLink: "semverWorkspaceLink",
  verifySimple: "verify/simple",
  verifyWithIgnore: "verify/withIgnore",
  verifyWithRootWorkspace: "verify/withRootWorkspace",
};

export type TestProjectName = keyof typeof TEST_PROJECTS;

export const getProjectRoot = (testProjectName: TestProjectName) => {
  const windowsProject = path.join(
    __dirname,
    "_windows",
    TEST_PROJECTS[testProjectName],
  );

  if (IS_WINDOWS && fs.existsSync(windowsProject)) {
    return windowsProject;
  }

  return withWindowsPath(path.join(__dirname, TEST_PROJECTS[testProjectName]));
};
