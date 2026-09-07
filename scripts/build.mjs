import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const staging = await mkdtemp(path.join(tmpdir(), 'ani-portfolio-build-'));
try {
  // Build a production tree without touching the local editor or dev server.
  for (const name of ['app', 'lib', 'types', 'content', 'public', 'package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'tailwind.config.js']) {
    await cp(path.join(root, name), path.join(staging, name), {
      recursive: true,
      filter: (source) => source !== path.join(root, 'app/api'),
    });
  }
  await symlink(path.join(root, 'node_modules'), path.join(staging, 'node_modules'), 'dir');
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
      cwd: staging,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (status !== 0) process.exitCode = status;
  else {
    const output = path.join(staging, 'out');
    await cp(path.join(root, 'thegiftofpoetry'), path.join(output, 'thegiftofpoetry'), { recursive: true });
    await cp(path.join(root, 'CNAME'), path.join(output, 'CNAME'));
    await writeFile(path.join(output, '.nojekyll'), '');
    // Keep the previous export intact if compilation fails.
    await rm(path.join(root, 'out'), { recursive: true, force: true });
    await mkdir(path.join(root, 'out'), { recursive: true });
    await cp(output, path.join(root, 'out'), { recursive: true });
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
