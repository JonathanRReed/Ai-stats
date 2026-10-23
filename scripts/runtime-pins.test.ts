import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const rootFile = (name: string) => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('local Node pins and package engine minimum stay aligned', async () => {
  const node = (await rootFile('.node-version')).trim();
  expect((await rootFile('.nvmrc')).trim()).toBe(node);
  expect(node).toMatch(/^24\.\d+\.\d+$/);
  expect(pkg.engines.node).toBe(`>=${node} <25`);
});

test('every Bun workflow uses the package pin and the shared Node version file', async () => {
  const bun = pkg.packageManager.replace(/^bun@/, '');
  expect(pkg.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
  expect(pkg.engines.bun).toBe(`>=${bun}`);
  for (const name of ['verify', 'refresh-benchmarks', 'publish-app-data']) {
    const workflow = await rootFile(`.github/workflows/${name}.yml`);
    expect(workflow).toContain(`bun-version: '${bun}'`);
    expect(workflow).toContain('node-version-file: .node-version');
    expect(workflow).toMatch(/uses: actions\/setup-node@[a-f0-9]{40}/);
  }
});

test('setup documentation points to authoritative runtime pins', async () => {
  const readme = await rootFile('README.md');
  expect(readme).toContain('Node version in `.node-version`');
  expect(readme).toContain('Bun version pinned by `packageManager`');
});

test('setup documentation distinguishes credential-free checks from release builds', async () => {
  const readme = await rootFile('README.md');
  expect(readme).not.toContain('Without credentials, run lint and build.');
  expect(readme).toContain('A release build also needs configured Supabase data');
  expect(readme).toContain('bun run test');
  expect(readme).toContain('bun run typecheck');
  expect(readme).toContain('bun run audit');
});
