import {expect,test} from 'bun:test';
import {existsSync} from 'node:fs';
test('Stats has a dedicated validated snapshot contract',async()=>{
 const present=existsSync(new URL('../src/lib/stats-snapshot.ts',import.meta.url));
 expect(present).toBe(true);
 if(!present)return;
 const module=await import('../src/lib/stats-snapshot');
 expect(typeof module.readStatsSnapshot).toBe('function');
 expect(typeof module.statsSnapshotText).toBe('function');
});
