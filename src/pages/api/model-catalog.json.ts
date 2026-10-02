import type {APIRoute} from 'astro';
import {getModelCatalogData} from '../../lib/model-catalog-data';
import {catalogCoverage} from '../../lib/model-catalog';
export const prerender=true;
export const GET:APIRoute=async()=>{
 const {records}=await getModelCatalogData();
 return new Response(JSON.stringify({schemaVersion:'ai-stats-source-catalog.v1',delivery:'build-snapshot',
 coverage:catalogCoverage(records),records}),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=3600','X-Robots-Tag':'noindex'}});
};
