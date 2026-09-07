import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

/** Load server modules with the installed compiler, without adding a test runner dependency. */
export function loadTypeScript(file, mocks = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const nativeRequire = createRequire(file);
  const require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const relative = path.resolve(path.dirname(file), name);
      if (fs.existsSync(`${relative}.ts`)) return loadTypeScript(`${relative}.ts`, mocks);
    }
    return nativeRequire(name);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(require, loaded, loaded.exports);
  return loaded.exports;
}
