/**
 * Build-time loader for head-to-head matchups. One family list and one matchup list per build,
 * shared by /compare/{a}-vs-{b}, /matchups, /matchups.json and (through the lead) the sitemap.
 */
import {getModelCatalogData} from './model-catalog-data';
import {buildH2HFamilies,createMatchupLookup,selectMatchups,type H2HFamily,type Matchup} from './head-to-head';

const load=async()=>{
 const {records}=await getModelCatalogData();
 const families=buildH2HFamilies(records);
 const matchups=selectMatchups(families);
 const bySlug=new Map(families.map(family=>[family.slug,family]));
 return {families,matchups,bySlug,lookup:createMatchupLookup(matchups)};
};

let cached:ReturnType<typeof load>|undefined;
export type HeadToHeadData=Awaited<ReturnType<typeof load>>;
export const getHeadToHeadData=():Promise<HeadToHeadData>=>cached??=load().catch(error=>{cached=undefined;throw error;});

/** Every matchup page: {path, a:{slug,name,provider}, b:{...}, reason}. Use for the sitemap and links. */
export const getMatchups=async():Promise<Matchup[]>=>(await getHeadToHeadData()).matchups;

/** Whether a matchup page exists for two family slugs, in either order. O(1) after the first load. */
export const hasMatchup=async(slugA:string,slugB:string):Promise<boolean>=>(await getHeadToHeadData()).lookup.has(slugA,slugB);

/** The matchup family (and its slug) for a model family name and lab, for linking from other pages. */
export const findMatchupFamily=async(name:string,provider?:string):Promise<H2HFamily|undefined>=>
 (await getHeadToHeadData()).families.find(family=>family.name===name&&(provider===undefined||family.provider===provider));
