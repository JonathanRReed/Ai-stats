import {expect,test} from 'bun:test';
import {recentModelReleases,type ReleaseCandidate} from './recent-models';

const row=(id:string,releaseDate:string|null,family=id,score:number|null=10,provider='Lab'):ReleaseCandidate=>({id,name:id,family,provider,releaseDate,current:true,score});

test('actual release dates order models and collapse reasoning variants by family',()=>{
 const result=recentModelReleases([row('older','2026-09-01'),row('new-low','2026-10-12','New',10),row('new-max','2026-10-12','New',20),row('middle','2026-10-07')],'2026-10-14');
 expect(result.map(model=>model.id)).toEqual(['new-max','middle','older']);
});

test('missing, invalid, future, unverified, and retired releases are excluded',()=>{
 expect(recentModelReleases([row('missing',null),row('invalid','2026-02-30'),row('future','2026-11-01'),{...row('unverified','2026-10-13'),current:null},{...row('retired','2026-10-13'),current:false}],'2026-10-14')).toEqual([]);
});

test('provider-scoped family identity keeps independent releases and measured zero scores',()=>{
 const model=row('a','2026-10-12','Model',0);
 expect(recentModelReleases([model,{...model,id:'b',provider:'Other'}],'2026-10-14').map(item=>item.score)).toEqual([0,0]);
});
