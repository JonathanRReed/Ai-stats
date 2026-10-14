import {expect,test} from 'bun:test';
import {setLeaderboardPanel,type LeaderboardPanelLike} from './leaderboard-panels';

const panel=(metric:string,hidden:boolean):LeaderboardPanelLike&{hidden:boolean;classes:Set<string>}=>{
 const classes=new Set<string>(hidden?['hidden']:[]);
 return {dataset:{metric},hidden,classes,classList:{toggle(name,force){if(force)classes.add(name);else classes.delete(name);return force;}}};
};

test('metric changes apply panel visibility synchronously with no transition callback or stale state',()=>{
 const panels=[panel('aa_intelligence_index',false),panel('gpqa',true),panel('hle',true)];
 setLeaderboardPanel(panels,'gpqa');
 expect(panels.map(row=>[row.dataset.metric,row.hidden,row.classes.has('hidden')])).toEqual([
  ['aa_intelligence_index',true,true],['gpqa',false,false],['hle',true,true],
 ]);
 setLeaderboardPanel(panels,'hle');
 expect(panels.filter(row=>!row.hidden).map(row=>row.dataset.metric)).toEqual(['hle']);
});
