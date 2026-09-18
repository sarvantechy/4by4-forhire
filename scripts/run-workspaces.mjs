import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const task = process.argv[2];

if (!task || !/^[a-z][a-z0-9:-]*$/i.test(task)) {
  console.error('Usage: node scripts/run-workspaces.mjs <task>');
  process.exit(2);
}

const workspaceRoots = ['apps', 'packages'];
const hasWorkspace = workspaceRoots.some((root) => {
  if (!existsSync(root)) {
    return false;
  }

  return readdirSync(root, { withFileTypes: true }).some(
    (entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')),
  );
});

if (!hasWorkspace) {
  console.log(`No application workspaces yet; skipped ${task}.`);
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npmCommand,
  ['run', task, '--workspaces', '--if-present'],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);