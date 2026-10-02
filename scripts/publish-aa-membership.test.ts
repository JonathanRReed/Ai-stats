import {expect,test} from 'bun:test';
import * as publisher from './publish-aa-membership.mjs';
test('AA membership publisher sends identities only after verified input validation', async()=>{
  let sent: unknown;
  const receipt=await publisher.runAaMembershipPublication?.({
    argv:['--input','input.json'],env:{SUPABASE_URL:'https://bgbqdzmgxkwstjihgeef.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only'},
    readFileImpl:async()=>JSON.stringify({aa:{snapshotId:'fetch',fetchedAt:'2026-10-02T00:00:00Z',
      observedAt:'2026-10-02T00:00:01Z',models:[{id:'one',raw:{private:'discard'}}]}}),
    publishImpl:async(args:{input: unknown})=>{sent=args.input;return{snapshotId:3,contentHash:'hash',recordCount:1};},
  });
  expect(receipt?.snapshotId).toBe(3);
  expect(sent).toMatchObject({records:[{id:'one',kind:'model-membership'}]});
});
test('AA membership dry-run never writes',async()=>{
  let calls=0;
  const receipt=await publisher.runAaMembershipPublication?.({
    argv:['--input','input.json','--dry-run'],env:{},
    readFileImpl:async()=>JSON.stringify({aa:{snapshotId:'fetch',fetchedAt:'2026-10-02T00:00:00Z',
      observedAt:'2026-10-02T00:00:01Z',models:[{id:'one'}]}}),
    publishImpl:async()=>{calls++;throw new Error('unexpected');},
  });
  expect(receipt?.dryRun).toBe(true);expect(calls).toBe(0);
});
