import {test,expect} from 'bun:test';
import {normalizeEpochModelMetadata} from './epoch-records.mjs';
test('Epoch model metadata preserves native identity and declared uncertainty',()=>{
 expect(normalizeEpochModelMetadata({model_version:'gpt-5.5_unknown',model_group:'GPT-5.5',display_name:'GPT-5.5 (unknown thinking)',organization:'OpenAI',date:'2026-04-23'}))
 .toMatchObject({model_version:'gpt-5.5_unknown',model_name:'GPT-5.5',display_name:'GPT-5.5 (unknown thinking)',organization:'OpenAI',release_date:'2026-04-23',eci_score:null});
 expect(normalizeEpochModelMetadata({model_group:'Unnamed family',model_version:''})).toBeNull();
});
