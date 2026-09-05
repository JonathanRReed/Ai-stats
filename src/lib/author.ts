/**
 * The one author entity every site in the family points at.
 *
 * All five sites emit the same `@id`, so a crawler that meets Jonathan on
 * AI News and again on PoliBench merges the two into one Person instead of
 * five look-alikes. Keep the id and the sameAs list identical across repos.
 */
export const AUTHOR_ID = 'https://jonathanrreed.com/#person';

export const AUTHOR_SAME_AS = [
  'https://jonathanrreed.com/',
  'https://github.com/JonathanRReed',
  'https://x.com/jonathanrayreed',
  'https://aistats.jonathanrreed.com/',
  'https://ai-news.helloworldfirm.com/',
  'https://prompt-info.helloworldfirm.com/',
  'https://ai-dragrace.jonathanrreed.com/',
  'https://polibench.jonathanrreed.com/',
];

export const AUTHOR_PERSON = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: 'Jonathan R. Reed',
  alternateName: 'Jonathan Reed',
  url: 'https://jonathanrreed.com/',
  sameAs: AUTHOR_SAME_AS,
} as const;

/** Reference form for use inside other nodes of the same graph. */
export const AUTHOR_REF = { '@id': AUTHOR_ID } as const;
