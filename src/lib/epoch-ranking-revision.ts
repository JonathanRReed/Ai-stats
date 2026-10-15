import {createHash} from 'node:crypto';
import {buildInitialEpochLeaderboardData} from './epoch-leaderboard-initial';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

export type EpochRankingContent={
 benchmarks:EpochBenchmark[];
 runs:EpochBenchmarkRun[];
 labels:Record<string,string>;
 modelNames:Record<string,string>;
};

const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable)
 :value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,stable(item)]))
 :value;

/**
 * Content fingerprint of the complete ranking artifact: every ranked row in display order,
 * benchmark definitions and order, labels, names, and cohort totals. It is independent of the
 * compare release manifest, so a change to any ranked benchmark (in or out of compare) moves it.
 */
export function epochRankingRevision(content:EpochRankingContent):string{
 const full=buildInitialEpochLeaderboardData(content.benchmarks,content.runs,content.labels,content.modelNames,Number.POSITIVE_INFINITY);
 const semantics={schemaVersion:1,benchmarks:full.benchmarks,labels:full.labels,runs:full.runs,modelNames:full.modelNames,totals:full.totals};
 return createHash('sha256').update(JSON.stringify(stable(JSON.parse(JSON.stringify(semantics))))).digest('hex');
}

export const withEpochRankingRevision=<T extends EpochRankingContent>(content:T):T&{revision:string}=>({...content,revision:epochRankingRevision(content)});
