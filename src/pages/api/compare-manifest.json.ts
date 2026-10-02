import type {APIRoute} from 'astro';
import {getCompareReleaseManifest} from '../../lib/compare-release-server';
export const prerender=true;
export const GET:APIRoute=async()=>new Response(JSON.stringify(await getCompareReleaseManifest()),{
 headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Robots-Tag':'noindex'}
});
