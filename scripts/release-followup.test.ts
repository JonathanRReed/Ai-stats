import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
test('explicit refresh owns the request while pending',()=>{
 const source=readFileSync('src/components/compare/CompareLive.tsx','utf8');
 expect(source).toContain('manualRefresh.current||');
 expect(source).toContain('if(manualRefresh.current)return');
 expect(source).toContain('manualRefresh.current=true');
 expect(source).toContain('manualRefresh.current=false');
});
test('failed app cache publication still saves verified snapshots and reports failure',()=>{
 const source=readFileSync('.github/workflows/refresh-benchmarks.yml','utf8');
 const publish=source.split('- name: Publish validated app data independently of deployment')[1].split('- name: Publish only the verified public snapshots')[0];
 expect(publish).toContain('id: app_release');
 expect(publish).toContain('continue-on-error: true');
 expect(source).toContain("always() && steps.app_release.outcome == 'failure'");
 expect(source.indexOf('- name: Report app release failure')).toBeGreaterThan(source.indexOf('git push origin HEAD:main'));
});
