import {expect,test} from 'bun:test';
import {readFileSync,existsSync} from 'node:fs';
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
