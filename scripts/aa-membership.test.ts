import {expect, test} from 'bun:test';
const membership = await import('./aa-membership.mjs').catch(() => ({}));
const receipt = {id: 'fetch', fetched_at: '2026-10-02T00:00:00Z', endpoint: 'language/models/free', status: 200,
  data: [{id: 'current'}]};
const rows = [{id: 'current', slug: 'current', last_seen: '2026-10-02T00:00:01Z'},
  {id: 'retired', slug: 'retired', last_seen: '2026-09-01T00:00:00Z'}];
test('current AA membership comes from a complete fetch while history remains intact', () => {
  const result = membership.selectAaCurrentMembership?.(rows, receipt);
  expect(result?.models.map((row: {id: string}) => row.id)).toEqual(['current']);
  expect(result?.snapshotId).toBe('fetch');
  expect(rows).toHaveLength(2);
});
test('fetch logs are not proof of a successful model import', () => {
  expect(() => membership.selectAaCurrentMembership?.([{...rows[0],last_seen:'2026-09-01T00:00:00Z'}], receipt)).toThrow('not fully imported');
  expect(() => membership.selectAaCurrentMembership?.([], receipt)).toThrow('not fully imported');
});
test('partial, duplicate and empty AA receipts cannot advance membership', () => {
  for (const data of [[], [{id:'current'},{id:'missing'}], [{id:'current'},{id:'current'}], [{}]]) {
    expect(() => membership.selectAaCurrentMembership?.(rows,{...receipt,data})).toThrow();
  }
  expect(() => membership.selectAaCurrentMembership?.(rows,{...receipt,status:503})).toThrow();
});
