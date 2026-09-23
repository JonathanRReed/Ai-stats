import { expect, test } from 'bun:test';
import { parseOpenRouterRankingRows } from './openrouter-ranking-parser';

test('resolves ranking rows from a React Flight reference', () => {
  const flight = [
    '31:["$","$Lx",null,{"state":{"queries":[{}, {}, {"state":{"data":[null,{"model_permaslug":"openai/test","total_prompt_tokens":2}]}}]}}]',
    'c4:["$","$Ly",null,{"initialRanking":{"rankingData":"$31:props:state:queries:2:state:data"}}]',
  ].join('\n');

  expect(parseOpenRouterRankingRows(flight)).toEqual([
    { model_permaslug: 'openai/test', total_prompt_tokens: 2 },
  ]);
});

test('accepts the older inline ranking array and ignores null entries', () => {
  const flight = 'c4:["$","$Ly",null,{"initialRanking":{"rankingData":[null,{"model_permaslug":"openai/test"}]}}]';
  expect(parseOpenRouterRankingRows(flight)).toEqual([{ model_permaslug: 'openai/test' }]);
});

test('returns no rows for a missing or malformed reference', () => {
  expect(parseOpenRouterRankingRows('c4:{"rankingData":"$31:props:state:data"}')).toEqual([]);
  expect(parseOpenRouterRankingRows('no ranking data')).toEqual([]);
});
