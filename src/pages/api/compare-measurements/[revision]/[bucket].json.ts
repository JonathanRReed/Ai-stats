import type {APIRoute,GetStaticPaths} from 'astro';
import {getCompareDelivery} from '../../../../lib/compare-delivery-server';
import type {ExplorerModel} from '../../../../lib/compare-series';
type Props={revision:string;bucket:string;records:ExplorerModel[]};
export const prerender=true;
export const getStaticPaths=(async()=>{
 const {delivery,chunks}=await getCompareDelivery();
 return [...chunks].map(([bucket,records])=>({params:{revision:delivery.revision,bucket},props:{revision:delivery.revision,bucket,records}}));
}) satisfies GetStaticPaths;
export const GET:APIRoute<Props>=({props})=>new Response(JSON.stringify({schemaVersion:1,...props}),{
 headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=31536000, immutable','X-Robots-Tag':'noindex'}
});
