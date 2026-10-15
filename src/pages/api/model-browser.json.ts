import type {APIRoute} from 'astro';
import {getModelCatalogData} from '../../lib/model-catalog-data';
import {getPublicCatalogModels,enrichModelsWithPublicCatalogData} from '../../lib/supabase';
import {toModelDrawerPayload} from '../../lib/model-api';
import {selectBrowserModels} from '../../lib/model-browser';
export const prerender=true;
export const GET:APIRoute=async()=>{
 const [catalog,publicCatalogs]=await Promise.all([getModelCatalogData(),getPublicCatalogModels()]);
 const models=selectBrowserModels(enrichModelsWithPublicCatalogData(catalog.currentAaModels,publicCatalogs,catalog.bindings)).map(toModelDrawerPayload);
 return new Response(JSON.stringify({schemaVersion:'ai-stats-model-browser.v1',models}),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Robots-Tag':'noindex'}});
};
