import { describe, expect, test } from 'bun:test';
import { PRIMARY_NAV, SECONDARY_NAV, navAriaCurrent, normalizeNavPath } from './site-nav';

const labs = PRIMARY_NAV.find((link) => link.key === 'labs')!;
const stats = PRIMARY_NAV.find((link) => link.key === 'dashboard')!;
const changes = SECONDARY_NAV.find((link) => link.key === 'changes')!;

describe('normalizeNavPath', () => {
  test('drops the .html suffix and trailing slashes', () => {
    expect(normalizeNavPath('/labs.html')).toBe('/labs');
    expect(normalizeNavPath('/labs/')).toBe('/labs');
    expect(normalizeNavPath('/index.html')).toBe('/');
    expect(normalizeNavPath('/')).toBe('/');
  });
});

describe('navAriaCurrent', () => {
  test('marks the index page itself as the current page', () => {
    expect(navAriaCurrent(labs, 'labs', '/labs')).toBe('page');
    expect(navAriaCurrent(stats, 'dashboard', '/')).toBe('page');
    expect(navAriaCurrent(changes, 'changes', '/changes.html')).toBe('page');
  });

  test('marks the section, not the page, on a detail page inside it', () => {
    expect(navAriaCurrent(labs, 'labs', '/labs/openai')).toBe('true');
  });

  test('leaves every other link unmarked', () => {
    expect(navAriaCurrent(labs, 'models', '/models')).toBeUndefined();
    expect(navAriaCurrent(stats, undefined, '/subprocessors')).toBeUndefined();
  });
});
