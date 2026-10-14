import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import OpenRouterUsage from '../src/components/OpenRouterUsage';

const snapshot={schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-10-14T00:00:00Z',startDate:'2026-10-13',endDate:'2026-10-14',missingDays:[],sourceUrl:'https://openrouter.ai/rankings',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',rows:[
 {date:'2026-10-13',modelPermaslug:'lab/a',totalTokens:'9007199254740993'},
 {date:'2026-10-13',modelPermaslug:'lab/missing',totalTokens:'999'},
 {date:'2026-10-14',modelPermaslug:'lab/a',totalTokens:'20'},
 {date:'2026-10-14',modelPermaslug:'lab/b',totalTokens:'80'},
 {date:'2026-10-14',modelPermaslug:'other',totalTokens:'100'},
]};
test('selected-day inspector ranks measured model traffic and separates aggregates',()=>{
 const html=renderToStaticMarkup(createElement(OpenRouterUsage,{snapshot}));
 const inspector=html.slice(html.indexOf('<aside'),html.indexOf('</aside>'));
 expect(inspector.indexOf('title="lab/b"')).toBeLessThan(inspector.indexOf('title="lab/a"'));
 expect(inspector.indexOf('title="lab/a"')).toBeLessThan(inspector.indexOf('title="lab/missing"'));
 expect(inspector.indexOf('title="lab/missing"')).toBeLessThan(inspector.indexOf('Unselected ranked models'));
 expect(inspector).toContain('Not ranked');
 expect(inspector).toContain('40.00%');
 expect(inspector).toContain('title="200"');
 expect(html).toContain('9007199254740993');
 expect(html).not.toContain('class="usage-legend"');
 expect(html).toContain('class="usage-visualization"');
});
