import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/refresh-benchmarks.yml',import.meta.url),'utf8');
test('refresh pipeline publishes only after candidate verification and build',()=>{
  const build=workflow.indexOf('run: bun run build');
  expect(workflow.indexOf('bun scripts/publish-epoch-cache.mjs')).toBeGreaterThan(build);
  expect(workflow.indexOf('bun scripts/publish-aa-membership.mjs')).toBeGreaterThan(build);
  expect(workflow).toContain('--write-cache-snapshot .tmp/epoch-cache-candidate.json');
  expect(workflow).toContain("cron: '37 1,7,13,19 * * *'");
  expect(workflow).toContain('cancel-in-progress: false');
});
