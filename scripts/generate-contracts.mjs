import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const checkOnly = process.argv.includes('--check');
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  resolve(repositoryRoot, 'packages/contracts/openapi.json'),
  resolve(repositoryRoot, 'packages/contracts/src/generated.ts'),
];
const before = new Map(
  files.map((file) => [file, existsSync(file) ? readFileSync(file, 'utf8') : null]),
);

execFileSync(
  resolve(repositoryRoot, '.venv/bin/python'),
  [resolve(repositoryRoot, 'backend/scripts/export_openapi.py')],
  {
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql+psycopg://localhost/forhire_contract',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'contract-only-session-secret-at-least-32-characters',
    },
    stdio: 'inherit',
  },
);
execFileSync(
  resolve(repositoryRoot, 'node_modules/.bin/openapi-typescript'),
  [files[0], '-o', files[1]],
  { stdio: 'inherit' },
);

if (checkOnly) {
  const changed = files.filter(
    (file) => before.get(file) !== readFileSync(file, 'utf8'),
  );
  if (changed.length > 0) {
    console.error(`Generated contracts are stale: ${changed.join(', ')}`);
    process.exit(1);
  }
  console.log('Generated contracts are current.');
}
