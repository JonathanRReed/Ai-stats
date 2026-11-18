import type {APIRoute} from 'astro';
import {getHeadToHeadData} from '../lib/head-to-head-data';
import {MATCHUP_INDEX_SCHEMA,type MatchupSearchIndex} from '../lib/head-to-head-search';

export const prerender=true;

/** Families and matchup pages for the command palette's "x vs y" search. Fetched on first use. */
export const GET:APIRoute=async()=>{
 const {families,matchups}=await getHeadToHeadData();
 const body:MatchupSearchIndex&{schema:string}={schema:MATCHUP_INDEX_SCHEMA,
  families:families.map(family=>({s:family.slug,n:family.name,p:family.provider,r:family.rank,ids:family.records.map(record=>record.id)})),
  matchups:matchups.map(matchup=>({u:matchup.path,a:matchup.a.slug,b:matchup.b.slug}))};
 return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800','X-Robots-Tag':'noindex'}});
};
