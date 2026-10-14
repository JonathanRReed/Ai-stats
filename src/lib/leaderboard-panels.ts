export type LeaderboardPanelLike = {dataset:{metric?:string};hidden:boolean;classList:{toggle(name:string,force?:boolean):unknown}};

/** Apply the selected leaderboard panel as one synchronous visibility update. */
export function setLeaderboardPanel(panels:LeaderboardPanelLike[],metric:string):void{
 for(const panel of panels){
  const hidden=panel.dataset.metric!==metric;
  panel.hidden=hidden;
  panel.classList.toggle('hidden',hidden);
 }
}

export type CompareLinkLike={setAttribute(name:string,value:string):void;removeAttribute(name:string):void};
/** Disable the action entirely when the displayed leaderboard has no records. */
export function setLeaderboardCompareAction(link:CompareLinkLike,href:string|null|undefined):void{
 if(!href){link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.setAttribute('tabindex','-1');return;}
 link.setAttribute('href',href);link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');
}

export type FilterControlLike={disabled:boolean};
export type FilterContainerLike={toggleAttribute(name:string,force?:boolean):void;querySelectorAll(selector:string):Iterable<FilterControlLike>};
/** Keep the AA-only family controls synchronized with the selected leaderboard metric. */
export function setLeaderboardFamilyControlsDisabled(container:FilterContainerLike|null,disabled:boolean):void{
 if(!container)return;
 container.toggleAttribute('data-disabled',disabled);
 for(const control of container.querySelectorAll('input,select,button,fieldset'))control.disabled=disabled;
}
