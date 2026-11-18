import type { APIRoute } from 'astro';
import { getChangeLog } from '../lib/change-log-load';
import { atomFeed } from '../lib/change-log';
import { SITE_ORIGIN } from '../lib/model-pages';
import { CHANGES_PATH } from '../lib/site-routes';

export const prerender = true;

/** Atom feed of /changes: the same entries, newest first, without routine retrieval receipts. */
export const GET: APIRoute = async () => {
  const log = await getChangeLog();
  const body = atomFeed(log.entries, { origin: SITE_ORIGIN, pagePath: CHANGES_PATH, feedPath: `${CHANGES_PATH}.xml`, updated: log.updated });
  return new Response(body, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
