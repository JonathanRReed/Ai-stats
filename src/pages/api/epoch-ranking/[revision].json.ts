import type {APIRoute,GetStaticPaths} from 'astro';
import {getEpochLeaderboardSource} from '../../../lib/epoch-leaderboard-server';
import {buildEpochRankingPayload} from '../../../lib/epoch-leaderboard-ranking';
export const prerender=true;
export const getStaticPaths:GetStaticPaths=async()=>{
 const payload=buildEpochRankingPayload(await getEpochLeaderboardSource());
 return [{params:{revision:payload.revision},props:{payload}}];
};
export const GET:APIRoute=async({props})=>new Response(JSON.stringify(props.payload),{
 headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600','X-Robots-Tag':'noindex'},
});
