import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./ModelSearchPalette.tsx',import.meta.url),'utf8');

test('the palette keeps its model search and adds "x vs y" lookups from /matchups.json', () => {
 expect(source).toContain("fetch('/api/model-index.json')");
 expect(source).toContain("fetch('/matchups.json')");
 expect(source).toContain('resolveVersusQuery(query, matchups)');
 expect(source).toContain('readMatchupSearchIndex');
});

test('a versus result is offered first and suppresses the empty state', () => {
 const versusAt=source.indexOf('{versus && (');
 const modelsAt=source.indexOf('{results.length > 0 && (');
 expect(versusAt).toBeGreaterThan(-1);
 expect(versusAt).toBeLessThan(modelsAt);
 expect(source).toContain('results.length === 0 && !versus');
});

test('a failed matchup index never blocks model search', () => {
 const loader=source.slice(source.indexOf('const loadMatchups'),source.indexOf('useEffect(() => {\n    const onKey'));
 expect(loader).toContain('catch');
 expect(loader).not.toContain("setState('error')");
});
