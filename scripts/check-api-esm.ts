import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

type ModuleReference = { specifier: string; line: number; kind: string };

/** Parse imports, re-exports, dynamic imports and TS import types across the graph. */
function references(file: ts.SourceFile): ModuleReference[] {
  const result: ModuleReference[] = [];
  const add = (node: ts.Node, specifier: string, kind: string) => {
    if (specifier.startsWith('./') || specifier.startsWith('../'))
      result.push({
        specifier,
        line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
        kind,
      });
  };
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      add(node, node.moduleSpecifier.text, ts.isImportDeclaration(node) ? 'import' : 'export');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert.ok(
        node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]),
        `Cannot audit computed dynamic import in ${file.fileName}`,
      );
      add(node, node.arguments[0].text, 'dynamic import');
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    )
      add(node, node.argument.literal.text, 'import type');
    ts.forEachChild(node, visit);
  };
  visit(file);
  return result;
}

function diagnostics(items: readonly ts.Diagnostic[]) {
  assert.equal(
    items.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(items, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }),
  );
}

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const configFile = ts.readConfigFile(join(root, 'tsconfig.api.json'), ts.sys.readFile);
if (configFile.error) diagnostics([configFile.error]);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
diagnostics(config.errors);
const outputParent = join(root, 'data');
mkdirSync(outputParent, { recursive: true });
const output = mkdtempSync(join(outputParent, 'vercel-esm-run-'));
try {
  const program = ts.createProgram(config.fileNames, {
    ...config.options,
    noEmit: false,
    noEmitOnError: true,
    rootDir: root,
    outDir: output,
  });
  const sources = program
    .getSourceFiles()
    .filter((file) => !file.isDeclarationFile && !program.isSourceFileFromExternalLibrary(file));
  let sourceReferences = 0;
  for (const file of sources) {
    for (const ref of references(file)) {
      sourceReferences++;
      assert.ok(
        ['.js', '.mjs', '.cjs', '.json', '.node'].includes(extname(ref.specifier)),
        `Invalid Node ESM ${ref.kind}: ${relative(root, file.fileName)}:${ref.line} ${ref.specifier}`,
      );
    }
  }
  diagnostics(ts.getPreEmitDiagnostics(program));
  const emitted = program.emit();
  diagnostics(emitted.diagnostics);
  assert.equal(emitted.emitSkipped, false);
  writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }));

  // Audit every runtime edge in unbundled output, including lazy imports that
  // importing the entry point alone would not execute. Directory imports fail.
  const visited = new Set<string>();
  let runtimeReferences = 0;
  const walk = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
    assert.ok(!file.text.includes('node:sqlite'), 'SQLite entered the production runtime graph');
    for (const ref of references(file)) {
      runtimeReferences++;
      const targetUrl = new URL(ref.specifier, pathToFileURL(path));
      assert.ok(extname(targetUrl.pathname), `Extensionless emitted import: ${path}:${ref.line}`);
      const target = fileURLToPath(targetUrl);
      const location = relative(output, target);
      assert.ok(
        !location.startsWith('..') && !isAbsolute(location),
        'Import escaped emitted graph',
      );
      assert.ok(statSync(target).isFile(), `Unresolvable emitted import: ${path}:${ref.line}`);
      if (['.js', '.mjs', '.cjs'].includes(extname(target))) walk(target);
    }
  };
  walk(join(output, 'api/index.js'));

  const runner = join(output, 'native-check.mjs');
  writeFileSync(
    runner,
    `import assert from 'node:assert/strict';
assert.equal(process.env.TURSO_DATABASE_URL, undefined);
assert.equal(process.env.TURSO_AUTH_TOKEN, undefined);
const { default: handler } = await import('./api/index.js');
assert.equal(typeof handler, 'function');
let status, body;
const response = {
  status(value) { status = value; return this; },
  json(value) { body = value; return this; },
};
await handler({ url: '/api/health' }, response);
assert.equal(status, 503);
assert.deepEqual(body, { status: 'error', database: 'unavailable' });
console.log('Native Node ESM API import and credential-free health response: PASS');
`,
  );
  const env = { ...process.env };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  delete env.NODE_OPTIONS;
  const launch = () =>
    spawnSync(process.execPath, [runner], {
      cwd: output,
      env,
      encoding: 'utf8',
      timeout: 30000,
    });
  const native = launch();
  assert.equal(native.error, undefined, 'Native Node process could not finish');
  assert.equal(native.status, 0, native.stderr);
  console.log(native.stdout.trim());

  // Prove that this check reproduces the reported deployment failure. Modify
  // only temporary emitted output; production source and data remain untouched.
  const schema = join(output, 'shared/schema.js');
  const original = readFileSync(schema, 'utf8');
  assert.ok(original.includes("from './model.js'"));
  try {
    writeFileSync(schema, original.replace("from './model.js'", "from './model'"));
    const broken = launch();
    assert.equal(broken.error, undefined);
    assert.notEqual(broken.status, 0);
    assert.ok(broken.stderr.includes('ERR_MODULE_NOT_FOUND'));
  } finally {
    writeFileSync(schema, original);
  }
  console.log(
    `NodeNext source audit (${sources.length} files, ${sourceReferences} relative references), emitted graph (${visited.size} files, ${runtimeReferences} edges) and extensionless-import regression: PASS`,
  );
} finally {
  // Remove only this newly created directory after checking its absolute path.
  const outputPath = realpathSync(output);
  assert.ok(outputPath.startsWith(realpathSync(outputParent) + sep));
  assert.ok(basename(outputPath).startsWith('vercel-esm-run-'));
  assert.equal(dirname(outputPath), realpathSync(outputParent));
  rmSync(outputPath, { recursive: true, force: true });
}
