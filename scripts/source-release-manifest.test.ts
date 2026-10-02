import {expect,test} from 'bun:test';
const release=await import('./source-release-manifest.mjs').catch(()=>({}));
const source={aa:{models:[{id:'a',aa_intelligence_index:5,last_seen:'2026-10-02T00:00:00Z'}]},
  epoch:{models:[{model_version:'a',updated_at:'2026-10-02T00:00:00Z'}],runs:[{id:'r',score:1}]},
  polibench:{generatedAt:'2026-09-01T00:00:00Z',runs:[{id:'p',score:1}]}};
test('AA-only membership and measurement changes require a new deployment manifest',()=>{
  const baseline=release.buildSourceReleaseManifest?.(source);
  expect(baseline).toBeDefined();
  expect(release.buildSourceReleaseManifest?.({...source,aa:{models:[{id:'b',aa_intelligence_index:5}]}})).not.toEqual(baseline);
  expect(release.buildSourceReleaseManifest?.({...source,aa:{models:[{...source.aa.models[0],aa_intelligence_index:6}]}})).not.toEqual(baseline);
});
test('retrieval-only changes do not cause deployments or relabel evidence dates',()=>{
  const next={...source,aa:{models:[{...source.aa.models[0],last_seen:'2026-10-02T06:00:00Z'}]},
    epoch:{...source.epoch,fetched_at:'2026-10-02T06:00:00Z',models:[{...source.epoch.models[0],updated_at:'2026-10-02T06:00:00Z'}]}};
  expect(release.buildSourceReleaseManifest?.(source)).toBeDefined();
  expect(release.buildSourceReleaseManifest?.(next)).toEqual(release.buildSourceReleaseManifest?.(source));
});
