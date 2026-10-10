import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';

export const digest = value => createHash('md5').update(value).digest('hex');
export function splitDocuments(text) {
  const docs = [];
  let start = 0;
  while (start < text.length) {
    while (/\s/.test(text[start] ?? '') && start < text.length) start++;
    if (start === text.length) break;
    assert.equal(text[start], '{', 'Expected a JSON row');
    let depth = 0, quoted = false, escaped = false, end = start;
    for (; end < text.length; end++) {
      const c = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) { end++; break; }
      }
    }
    assert.equal(depth, 0, 'Incomplete JSON row');
    assert.equal(quoted, false, 'Incomplete JSON string');
    const doc = text.slice(start, end);
    JSON.parse(doc); // Validate syntax only: preserve the original numeric text.
    docs.push(doc);
    start = end;
  }
  return docs;
}
const ident = value => '"' + value.replaceAll('"', '""') + '"';
const qualified = (schema, table) => ident(schema) + '.' + ident(table);
async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }

export async function verifyRecovery(directory, modulePath) {
  // A failed rerun must never leave an old success receipt certifying this export.
  await rm(path.join(directory, 'restore-verification.json'), {force: true});
  assert.ok(modulePath, 'Set PGLITE_TEST_MODULE to an installed isolated database module');
  const manifest = await json(path.join(directory, 'start-manifest.json'));
  const progress = await json(path.join(directory, 'export-progress.json'));
  assert.ok(progress.every(table => table.done), 'Export is incomplete');
  assert.equal(progress.length, manifest.tables.length, 'Recovery table set is incomplete');
  assert.equal(new Set(progress.map(t => t.table)).size, progress.length, 'Duplicate recovery table');
  assert.ok(manifest.tables.every(t => progress.some(p => p.table === t.table_name)), 'Recovery table set differs from manifest');
  for (const table of progress) {
    assert.ok(typeof table.schema === 'string' && typeof table.name === 'string' &&
      table.table === table.schema + '.' + table.name, 'Recovery destination differs from manifest identity');
  }
  const schema = await json(path.join(directory, 'schema-metadata.json'));
  const {PGlite} = await import(modulePath);
  const {pgcrypto} = await import(path.join(path.dirname(modulePath), 'contrib/pgcrypto.js'));
  const db = new PGlite({extensions:{pgcrypto}});
  const report = {kind: 'application-data-restore-test', verificationScope: 'application-row-content',
    productionRecoveryVerified: false, complete: false, tables: [], indexes: 0,
    indexCoverage: {expected: schema.indexes.length, created: 0,
      skippedUnverified: /** @type {{schema: string, name: string}[]} */ ([])},
    unverifiedSchemaSemantics: [
      'column defaults', 'identity columns and sequence state', 'generated column expressions',
      'column collations', 'view options including security_invoker',
      'function execution behavior', 'grants and row-level security policies'
    ], limitations: [
    'Isolated PGlite engine is not the production Supabase engine',
    'Credentials, managed auth configuration and cron commands are deliberately excluded',
    'External-service function bodies cannot be exercised offline; grants and policies are archived for recovery'
  ]};
  try {
    report.engine = (await db.query('select version() as version')).rows[0].version;
    await db.exec("create schema extensions; create extension pgcrypto with schema extensions; set timezone='UTC'; create schema if not exists aa; create schema if not exists private;");
    for (const table of schema.tables) {
      const columns = schema.columns.filter(c => c.schema_name === table.schema_name && c.table_name === table.table_name).sort((a,b) => a.position-b.position);
      await db.exec('create table ' + qualified(table.schema_name, table.table_name) + '(' + columns.map(c => ident(c.column_name) + ' ' + c.data_type + (c.not_null ? ' not null' : '')).join(',') + ')');
    }
    const filenames = await readdir(directory);
    for (const table of progress) {
      const expected = manifest.tables.find(t => t.table_name === table.table);
      assert.ok(expected, 'Missing manifest table');
      const files = filenames.filter(f => f.startsWith(table.table + '.batch-') && f.endsWith('.json'));
      const groups = new Map();
      for (const file of files) {
        const match = file.match(/\.batch-(\d+)\.part-(\d+)\.json$/);
        assert.ok(match, 'Invalid fragment filename');
        const offset = Number(match[1]);
        if (!groups.has(offset)) groups.set(offset, []);
        groups.get(offset).push({file, charOffset: Number(match[2])});
      }
      let count = 0, bytes = 0;
      const hash = createHash('md5');
      const rowHashes = [];
      for (const [offset, parts] of [...groups].sort((a,b) => a[0]-b[0])) {
        assert.equal(offset, count, 'Missing or overlapping row batch');
        let assembled = '', charOffset = 0, first;
        for (const item of parts.sort((a,b) => a.charOffset-b.charOffset)) {
          const fragment = await json(path.join(directory, item.file));
          first ??= fragment;
          assert.equal(fragment.table, table.table);
          assert.equal(fragment.row_offset, offset);
          assert.equal(fragment.char_offset, charOffset);
          assert.equal(fragment.batch_digest, first.batch_digest);
          assert.equal(digest(fragment.part), fragment.part_digest);
          const chars = [...fragment.part].length; // PostgreSQL counts Unicode code points.
          assert.equal(chars, Math.min(fragment.part_size, Number(fragment.batch_chars)-charOffset));
          assembled += fragment.part;
          charOffset += fragment.part_size;
        }
        assert.equal([...assembled].length, Number(first.batch_chars));
        assert.equal(Buffer.byteLength(assembled), Number(first.batch_bytes));
        assert.equal(digest(assembled), first.batch_digest);
        const docs = splitDocuments(assembled);
        assert.equal(docs.length, Number(first.row_count));
        for (const doc of docs) { const rowHash=digest(doc); hash.update(rowHash); rowHashes.push(rowHash); bytes += Buffer.byteLength(doc); }
        const name = qualified(table.schema, table.name);
        await db.query('insert into ' + name + ' select * from json_populate_recordset(null::' + name + ',$1::json)', ['[' + docs.join(',') + ']']);
        // Match each original row by its typed primary key; local collation may differ.
        const pkType = schema.columns.find(c => c.schema_name === table.schema && c.table_name === table.name && c.column_name === table.pk).data_type;
        const checked = (await db.query("select count(*)::int as matched,count(*) filter(where md5(row_to_json(t)::text)=md5(source.doc::text))::int as exact from json_array_elements($1::json) source(doc) join " + name + " t on t." + ident(table.pk) + "=(source.doc->>$2)::" + pkType, ['[' + docs.join(',') + ']',table.pk])).rows[0];
        assert.equal(checked.matched,docs.length,table.table + ' restored keys');
        assert.equal(checked.exact,docs.length,table.table + ' restored row checksums');
        count += docs.length;
      }
      assert.equal(count, Number(expected.row_count), table.table + ' row count');
      assert.equal(bytes, Number(expected.export_bytes), table.table + ' byte count');
      assert.equal(hash.digest('hex'), expected.content_digest, table.table + ' source checksum');
      const actual = (await db.query("select count(*)::text as count,coalesce(md5(string_agg(md5(row_to_json(t)::text),'' order by t." + ident(table.pk) + ")),md5('')) as digest from " + qualified(table.schema, table.name) + ' t')).rows[0];
      assert.equal(actual.count, String(count), table.table + ' restored row count');
      report.tables.push({table: table.table, rows: count, sourceDigest: expected.content_digest, unorderedDigest: digest(rowHashes.sort().join('')), exactRowChecksumsVerified: true});
      console.log('Restored and verified ' + table.table + ': ' + count + ' rows');
    }
    await db.exec('set check_function_bodies=off');
    for (const fn of schema.functions ?? []) await db.exec(fn.definition);
    await db.exec('set check_function_bodies=on');
    for (const view of schema.views ?? []) await db.exec('create view ' + qualified(view.schema_name,view.view_name) + ' as ' + view.definition);
    report.functionsCreated = (schema.functions ?? []).length;
    report.viewsCreated = (schema.views ?? []).length;
    for (const kind of ['p','u','c','f','x']) {
      for (const c of schema.constraints.filter(c => c.kind === kind)) {
        await db.exec('alter table ' + qualified(c.schema_name,c.table_name) + ' add constraint ' + ident(c.constraint_name) + ' ' + c.definition);
      }
    }
    const indexCoverage = report.indexCoverage;
    for (const index of schema.indexes) {
      if (schema.constraints.some(c => c.schema_name === index.schemaname && c.constraint_name === index.indexname)) {
        // The legacy name match does not establish backing-index equivalence.
        indexCoverage.skippedUnverified.push({schema: index.schemaname, name: index.indexname});
      } else {
        await db.exec(index.indexdef);
        indexCoverage.created++;
      }
    }
    report.constraints = schema.constraints.length;
    // Count only explicit CREATE INDEX operations, not all archived metadata.
    report.indexes = indexCoverage.created;
    report.complete = true;
    report.verifiedAt = new Date().toISOString();
    await writeFile(path.join(directory,'restore-verification.json'), JSON.stringify(report,null,2));
    return report;
  } finally { await db.close(); }
}
if (import.meta.main) {
  const directory = process.argv[2];
  assert.ok(directory, 'Pass the private recovery directory');
  const report = await verifyRecovery(directory, process.env.PGLITE_TEST_MODULE);
  console.log(JSON.stringify({complete:report.complete,verificationScope:report.verificationScope,
    productionRecoveryVerified:report.productionRecoveryVerified,tables:report.tables.length,engine:report.engine,
    unverifiedSchemaSemantics:report.unverifiedSchemaSemantics,indexCoverage:report.indexCoverage,limitations:report.limitations}));
}
