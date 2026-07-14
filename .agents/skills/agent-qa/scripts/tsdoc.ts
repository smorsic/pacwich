/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import ts from "typescript";

// The probe must live in the project dir so `import "pacwich"` resolves from
// its local node_modules (the installed build), not this skill's location.
const probeFile = path.join(process.cwd(), "._tsdocProbe.ts");
fs.writeFileSync(probeFile, 'import * as pw from "pacwich";\n');

try {
  const program = ts.createProgram([probeFile], {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
  });
  const checker = program.getTypeChecker();
  const probe = program.getSourceFile(probeFile)!;
  const moduleSymbol = checker.getSymbolAtLocation(
    (probe.statements[0] as ts.ImportDeclaration).moduleSpecifier,
  );

  if (!moduleSymbol) {
    console.error(
      `Could not resolve "pacwich" from ${process.cwd()}. ` +
        `Install it locally there first (e.g. sandbox.sh run npm install <pkg>).`,
    );
    process.exit(1);
  }

  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const doc = ts.displayPartsToString(exp.getDocumentationComment(checker));
    const tags = exp.getJsDocTags(checker);
    console.log(exp.getName(), "\n  ", doc);
    for (const t of tags)
      console.log("  @" + t.name, ts.displayPartsToString(t.text ?? []));
  }
} finally {
  fs.rmSync(probeFile, { force: true });
}
