export type LeaderboardPanelLike = {dataset:{metric?:string};hidden:boolean;classList:{toggle(name:string,force?:boolean):unknown}};

/** Apply the selected leaderboard panel as one synchronous visibility update. */
export function setLeaderboardPanel(panels:LeaderboardPanelLike[],metric:string):void{
 for(const panel of panels){
  const hidden=panel.dataset.metric!==metric;
  panel.hidden=hidden;
  panel.classList.toggle('hidden',hidden);
 }
}
