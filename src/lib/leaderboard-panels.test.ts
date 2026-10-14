import {expect,test} from 'bun:test';
import {setLeaderboardCompareAction,setLeaderboardFamilyControlsDisabled,setLeaderboardPanel,type LeaderboardPanelLike} from './leaderboard-panels';

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

test('leaderboard compare action disables on empty results and restores the exact URL when results return',()=>{
 const attrs=new Map<string,string>();
 const link={setAttribute:(name:string,value:string)=>attrs.set(name,value),removeAttribute:(name:string)=>attrs.delete(name)};
 setLeaderboardCompareAction(link,'/compare?metric=mmlu_pro&m=opus-low');
 expect(attrs.get('href')).toBe('/compare?metric=mmlu_pro&m=opus-low');
 expect(attrs.has('aria-disabled')).toBe(false);
 setLeaderboardCompareAction(link,null);
 expect(attrs.has('href')).toBe(false);expect(attrs.get('aria-disabled')).toBe('true');expect(attrs.get('tabindex')).toBe('-1');
 setLeaderboardCompareAction(link,'/compare?metric=mmlu_pro&m=opus-low');
 expect(attrs.get('href')).toBe('/compare?metric=mmlu_pro&m=opus-low');expect(attrs.has('tabindex')).toBe(false);
});

test('Epoch selection disables every AA family filter and AA selection restores them',()=>{
 const controls=[{disabled:false},{disabled:false},{disabled:false},{disabled:false}];let marked=false;
 const container={toggleAttribute:(_name:string,force?:boolean)=>{marked=Boolean(force);},querySelectorAll:()=>controls};
 setLeaderboardFamilyControlsDisabled(container,true);
 expect(marked).toBe(true);expect(controls.every(control=>control.disabled)).toBe(true);
 setLeaderboardFamilyControlsDisabled(container,false);
 expect(marked).toBe(false);expect(controls.every(control=>!control.disabled)).toBe(true);
});
