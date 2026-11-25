import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Folding Artificial Analysis observations into runs must keep every row recoverable.
// A control table receives the same upserts without the trigger; the history view must match it.
const migration=readFileSync('supabase/migrations/20261125173057_store_unchanged_aa_observations_once.sql','utf8');
const base=`
create schema if not exists private;
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public to anon,authenticated,service_role;
create table public.intelligence_sources (id bigint primary key, source_key text not null);
create table public.canonical_models (id bigint primary key, canonical_key text not null, display_name text not null);
create table public.benchmark_definitions (id bigint primary key, benchmark_key text, display_name text, unit text, higher_is_better boolean);
create table public.benchmark_versions (id bigint primary key, benchmark_definition_id bigint references public.benchmark_definitions(id), version_key text);
create table public.benchmark_observations (
 id bigint generated always as identity primary key,
 intelligence_source_id bigint not null references public.intelligence_sources(id) on delete cascade,
 canonical_model_id bigint not null references public.canonical_models(id) on delete cascade,
 benchmark_version_id bigint not null references public.benchmark_versions(id) on delete cascade,
 observation_key text not null, source_model_key text not null, value numeric,
 observed_at timestamptz not null, source_url text, metadata jsonb not null default '{}'::jsonb,
 ingested_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint benchmark_observations_source_key unique (intelligence_source_id, observation_key));
create table public.control (like public.benchmark_observations including all);
insert into public.intelligence_sources values (1,'artificial-analysis'),(2,'epoch-ai');
insert into public.canonical_models select g,'m'||g,'Model '||g from generate_series(1,6) g;
insert into public.benchmark_definitions select g,'b'||g,'Bench '||g,'pts',true from generate_series(1,3) g;
insert into public.benchmark_versions select g,g,'v1' from generate_series(1,3) g;`;

let seed=7;
const random=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
const stamp=(t:Date)=>t.toISOString();
// Literal numbers keep their written scale, so 33.5 and 33.50 reach the database as different text.
const literal=(text:string)=>`__N${text}__`;

function batch(k:number,extraMs=0) {
 const t=new Date(Date.UTC(2026,9,1,1,0,5)+k*4*3600_000+Math.floor(random()*1000)+extraMs);
 const rows:Record<string,unknown>[]=[];
 for(let cm=1;cm<=6;cm++) for(let bv=1;bv<=3;bv++) {
  if(random()<0.05) continue;
  const slug=`model-${cm}`;
  let value:unknown=Math.round((cm*10+bv+(k%5?[0,0,0,0.5][Math.floor(random()*4)]:random()))*1000)/1000;
  if(cm===6&&bv===3) value=null;
  const metadata:Record<string,unknown>={tier:k%7===0&&cm===2?'paid':'free',endpoint:'language/models/free',observed_at:stamp(t),index_cost:null,v:bv};
  if(cm===3&&bv===1) value=literal(k%2?'33.5':'33.50');
  if(cm===3&&bv===2) {value=32;metadata.index_cost=literal(k%2?'1.5':'1.50');}
  if(cm===5&&bv===1) delete metadata.observed_at;
  if(cm===4&&bv===2&&k%3===0) metadata.observed_at=t.toISOString().replace('Z','+00:00');
  rows.push({intelligence_source_id:1,canonical_model_id:cm,benchmark_version_id:bv,
   observation_key:`artificial-analysis:${slug}:prop${bv}:${stamp(t)}`,source_model_key:slug,value,
   observed_at:t.toISOString(),source_url:null,metadata,updated_at:t.toISOString()});
 }
 rows.push({intelligence_source_id:2,canonical_model_id:1,benchmark_version_id:1,observation_key:`epoch-ai:run${k}`,
  source_model_key:'m1',value:k,observed_at:t.toISOString(),source_url:'https://epoch.ai/x',metadata:{k},updated_at:t.toISOString()});
 return JSON.stringify(rows).replace(/"__N([0-9.]+)__"/g,'$1');
}

// One transaction per batch, as PostgREST does, so both tables get the same ingested_at.
async function upsert(db:PGlite,rows:string) {
 await db.transaction(async tx=>{for(const table of ['benchmark_observations','control']) await tx.query(`
  insert into public.${table} (intelligence_source_id,canonical_model_id,benchmark_version_id,observation_key,source_model_key,value,observed_at,source_url,metadata,updated_at)
  select intelligence_source_id,canonical_model_id,benchmark_version_id,observation_key,source_model_key,value,observed_at,source_url,coalesce(metadata,'{}'),updated_at
  from jsonb_populate_recordset(null::public.${table},$1::jsonb)
  on conflict (intelligence_source_id,observation_key) do update set value=excluded.value,metadata=excluded.metadata,
   observed_at=excluded.observed_at,source_url=excluded.source_url,updated_at=excluded.updated_at`,[rows]);});
}

async function compare(db:PGlite) {
 const {rows}=await db.query<Record<string,number>>(`select
  (select count(*)::int from public.benchmark_observation_history_v1) as history,
  (select count(*)::int from public.control) as control,
  (select count(*)::int from (select to_jsonb(h)::text from public.benchmark_observation_history_v1 h
    except all select to_jsonb(c)::text from public.control c) x) as extra,
  (select count(*)::int from (select to_jsonb(c)::text from public.control c
    except all select to_jsonb(h)::text from public.benchmark_observation_history_v1 h) x) as missing,
  (select count(*)::int from public.benchmark_observations) as plain,
  (select count(*)::int from public.benchmark_observation_runs) as runs`);
 return rows[0];
}

const latest=(table:string)=>`select canonical_model_id,benchmark_version_id,value::text,observed_at from (
 select *,row_number() over (partition by canonical_model_id,benchmark_version_id order by observed_at desc,id desc) n from ${table}) x
 where n=1 order by 1,2`;

test('folds unchanged observations into runs and rebuilds every row exactly',async()=>{
 const db=new PGlite();
 await db.exec(base);
 const batches=Array.from({length:40},(_,k)=>batch(k));
 for(const rows of batches.slice(0,25)) await upsert(db,rows);
 const before={control:(await db.query<{n:number}>('select count(*)::int as n from public.control')).rows[0].n};

 await db.exec(migration);
 const folded=await compare(db);
 expect(folded).toMatchObject({history:before.control,control:before.control,extra:0,missing:0});
 expect(folded.plain).toBeLessThan(before.control/3);

 await db.exec(migration);
 expect(await compare(db)).toEqual(folded);

 for(const rows of batches.slice(25)) await upsert(db,rows);
 await upsert(db,batches[30]);
 await upsert(db,batches[39]);
 await upsert(db,batch(20,2*3600_000));
 const appended=await compare(db);
 expect(appended).toMatchObject({extra:0,missing:0});
 expect(appended.history).toBe(appended.control);
 expect(appended.plain).toBeLessThan(appended.control/3);

 // A re-send that changes a stored value keeps both versions: the folded original and the
 // updated row the upsert would have left, with the same id and ingested_at.
 await upsert(db,batches[39].replace(/"value":[^,]+/,'"value":999'));
 const resent=await compare(db);
 expect(resent).toMatchObject({history:resent.control+1,extra:1,missing:0});
 await db.exec(migration);
 expect(await compare(db)).toEqual(resent);
 const view=(await db.query(`select canonical_key,benchmark_key,value::text,observed_at
  from public.latest_benchmark_observations_v1 order by 1,2`)).rows;
 const expected=(await db.query(`select m.canonical_key,d.benchmark_key,c.value,c.observed_at from (${latest('public.control')}) c
  join public.canonical_models m on m.id=c.canonical_model_id join public.benchmark_versions v on v.id=c.benchmark_version_id
  join public.benchmark_definitions d on d.id=v.benchmark_definition_id order by 1,2`)).rows;
 expect(view).toEqual(expected);
 const fromHistory=(await db.query(latest('public.benchmark_observation_history_v1'))).rows;
 const fromControl=(await db.query(latest('public.control'))).rows;
 expect(fromHistory).toEqual(fromControl);
 await db.close();
},60000);
