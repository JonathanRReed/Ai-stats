import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OverviewExplorer from '../components/compare/OverviewExplorer';

test('overview chart renders family endpoint labels without requiring an active point', () => {
  const models = [
    { id:'a', name:'Model Alpha', family:'Alpha', provider:'Lab A', source:'aa' as const, sourceModelId:'a', current:true, intelligence:50, aaTaskCost:1, priceBlended:2, indexVersion:'4.3', performancePrompt:'long' },
    { id:'b', name:'Model Beta', family:'Beta', provider:'Lab B', source:'aa' as const, sourceModelId:'b', current:true, intelligence:80, aaTaskCost:3, priceBlended:4, indexVersion:'4.3', performancePrompt:'long' },
  ];
  const html = renderToStaticMarkup(createElement(OverviewExplorer, {
    models,
    suggestions:{'task-cost:4.3':['a','b'],'cost-intelligence:4.3':['a','b']},
  }));
  expect(html).toContain('aria-label="Alpha endpoint"');
  expect(html).toContain('aria-label="Beta endpoint"');
});

test('task-cost control is enabled only when the selected AA cohort has measured costs', () => {
  const models = [
    { id:'latest', name:'Latest', family:'Latest', source:'aa' as const, sourceModelId:'latest', current:true, intelligence:70, aaTaskCost:null, priceBlended:2, indexVersion:'4.4' },
    { id:'older', name:'Older', family:'Older', source:'aa' as const, sourceModelId:'older', current:true, intelligence:60, aaTaskCost:1, priceBlended:3, indexVersion:'4.3' },
  ];
  const html=renderToStaticMarkup(createElement(OverviewExplorer,{models,suggestions:{}}));
  expect(html).toContain('aria-pressed="false" disabled=""');
  expect(html).toContain('AA Index version');
  expect(html).toContain('value="4.4" selected');
});
