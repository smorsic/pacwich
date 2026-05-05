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
  workspaceConfigTsPrecedence: "workspaceConfig/tsPrecedence",
  workspaceConfigTsConfig: "workspaceConfig/tsConfig",
  workspaceConfigTsEmpty: "workspaceConfig/tsEmpty",
  workspaceConfigJsPrecedence: "workspaceConfig/jsPrecedence",
  workspaceConfigJsConfig: "workspaceConfig/jsConfig",
  workspaceTags: "workspaceTags",
  rootConfigTsFile: "rootConfig/tsFile",
  rootConfigTsEmpty: "rootConfig/tsEmpty",
  rootConfigTsInvalid: "rootConfig/tsInvalid",
  rootConfigTsPrecedence: "rootConfig/tsPrecedence",
  rootConfigJsFile: "rootConfig/jsFile",
  rootConfigJsPrecedence: "rootConfig/jsPrecedence",
  rootConfigJsoncFile: "rootConfig/jsoncFile",
  rootConfigPackage: "rootConfig/package",
  rootConfigInvalidJson: "rootConfig/invalidJson",
  rootConfigInvalidType: "rootConfig/invalidType",
  rootConfigInvalidShell: "rootConfig/invalidShell",
  rootConfigInvalidParallel: "rootConfig/invalidParallel",
  rootConfigParallelMaxOnly: "rootConfig/parallelMaxOnly",
  rootConfigWorkspacePatternConfigs: "rootConfig/workspacePatternConfigs",
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
