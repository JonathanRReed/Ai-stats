import {expect,test} from 'bun:test';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import receipts from '../supabase/tests/applied-migration-receipts.json';
test('applied October migrations use production versions and preserve verified SQL bytes',()=>{
 for(const receipt of receipts){
 const path='supabase/migrations/'+receipt.version+'_'+receipt.name+'.sql';
 expect(existsSync(path)).toBe(true);
 if(existsSync(path)){
 const sql=readFileSync(path,'utf8').replace(/^ +| +$/g,'');
 expect(createHash('md5').update(sql).digest('hex')).toBe(receipt.sqlDigest);
 }
 }
});

// Missing production SQL receipts are coverage gaps, not evidence of whether a
// migration was applied. Never generate a production receipt from repository SQL.
// Keep this inventory explicit so removing a receipt cannot silently remove a check.
const unreceiptedMigrations=[
 '20260901000100_model_intelligence_foundation.sql',
 '20260901000200_backfill_legacy_intelligence.sql',
 '20260901000300_register_intelligence_migrations.sql',
 '20260901155807_reconcile_source_native_observation_keys.sql',
 '20260901170000_harden_cron_secrets_and_extensions.sql',
 '20260902010000_ai_drag_race_shares.sql',
 '20260902011000_lock_down_ai_drag_share_function_grants.sql',
 '20260902020000_validate_ai_drag_share_payloads.sql',
 '20260905141631_aa_source_metadata.sql',
 '20261003024932_app_release_publication_timeout.sql',
 '20261003173339_publisher_release_protocol_v2.sql'
];
test('explicitly accounts for migrations without verified production SQL receipts',()=>{
 const receipted=new Set(receipts.map(receipt=>receipt.version+'_'+receipt.name+'.sql'));
 const missing=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')&&!receipted.has(name)).sort();
 expect(missing).toEqual(unreceiptedMigrations);
});
