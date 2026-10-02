import {expect,test} from 'bun:test';
import * as freshness from '../src/lib/data-freshness';
test('daily usage health uses its fetch receipt and source-native coverage',()=>{
 const value={snapshot:{schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-09-29T02:00:00.000Z',
  startDate:'2026-09-28',endDate:'2026-09-28',missingDays:[],sourceUrl:'https://openrouter.ai/rankings',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  rows:[{date:'2026-09-28',modelPermaslug:'lab/a',totalTokens:'42'}]},
 receipt:{status:'healthy',fetchedAt:'2026-10-02T06:00:00.000Z',publishedAt:'2026-09-29T03:00:00.000Z',snapshotId:'42',contentHash:'a'.repeat(64)}};
 expect(freshness.usageSourceFreshness?.(value,new Date('2026-10-02T07:00:00Z'))).toMatchObject({
 sourceKey:'openrouter-usage',status:'healthy',coverageLabel:'1 days / 1 model-day buckets',snapshotId:'42',contentHash:'a'.repeat(64)});
 expect(freshness.usageSourceFreshness?.(null,new Date('2026-10-02T07:00:00Z')).status).toBe('unavailable');
});
