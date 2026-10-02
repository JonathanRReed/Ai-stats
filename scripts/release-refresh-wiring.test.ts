import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
test('pending refreshes are cleared after rollback and revalidated at activation',()=>{
 const source=readFileSync('src/components/compare/CompareLive.tsx','utf8');
 expect(source).toContain('else setPending(null)');
 expect(source).toContain('const refresh=async()');
 expect(source).toContain('fetchNewCompareRelease(currentDataset.current');
 expect(source).not.toContain('setActive(pending)');
 expect(source).toContain('requestVersion.current');
});
test('publication is restricted to verified main pushes and keeps secrets out of builds',()=>{
 const source=readFileSync('.github/workflows/publish-app-data.yml','utf8');
 expect(source).toContain("github.event.workflow_run.event == 'push'");
 expect(source).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
 expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
 const build=source.split('- name: Build and validate public release artifacts')[1].split('- name: Publish validated app data')[0];
 expect(build).not.toContain('SERVICE_ROLE');
 expect(source).toContain('persist-credentials: false');
});
