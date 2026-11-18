import { expect, test } from 'bun:test';
import { scriptSafeJson } from './script-json';

test('a closing script tag inside a name cannot end the element, and the data is unchanged', () => {
  const value = { name: 'Model </script><img src=x onerror=alert(1)>', note: 'a < b', list: ['<!--', 1] };
  const safe = scriptSafeJson(JSON.stringify(value));
  expect(safe).not.toContain('<');
  expect(JSON.parse(safe)).toEqual(value);
});
