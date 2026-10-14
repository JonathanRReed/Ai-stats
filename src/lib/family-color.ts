const FAMILY_HUES:Array<[RegExp,number]>=[
 [/^Claude/i,1],[/^(GPT|o[1-9])/i,8],[/^(Gemini|Gemma)/i,0],[/^(Muse|Llama)/i,2],
 [/^Grok/i,3],[/^MiMo/i,4],[/^Qwen/i,5],[/^Kimi/i,6],[/^GLM/i,7],[/^DeepSeek/i,5],
];
export function familyColor(family:string){
 const known=FAMILY_HUES.find(([pattern])=>pattern.test(family));
 let hash=0;for(const letter of family)hash=(hash*31+letter.charCodeAt(0))>>>0;
 return 'var(--compare-family-'+(known?.[1]??hash%9)+')';
}
