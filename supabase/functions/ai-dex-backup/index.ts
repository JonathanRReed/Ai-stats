import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2";

// Exports every public and private table to the private ai-dex-backup bucket as gzipped NDJSON
// (one to_jsonb row per line) and verifies each object against private.backup_manifest.
// verify_jwt stays on; only service_role callers are accepted.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const BUCKET = "ai-dex-backup";
const SCHEMAS = ["public", "private"];
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-dex-backup`;
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1, idle_timeout: 5 });
const storage = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
}).storage;

function isServiceCaller(authorization: string): boolean {
  if (authorization === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) return true;
  if (!authorization.startsWith("Bearer ")) return false;
  try {
    const encoded = authorization.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded)).role === "service_role";
  } catch {
    return false;
  }
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array<ArrayBuffer>) => hex(await crypto.subtle.digest("SHA-256", bytes));
async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function chainNext(authorization: string, body: unknown) {
  EdgeRuntime.waitUntil(
    fetch(SELF, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.text()).catch(() => undefined),
  );
}

async function tableInfo(schema: string, table: string) {
  if (!SCHEMAS.includes(schema)) throw new Error("schema not allowed");
  const rows = await sql`
    select a.attname as pk, format_type(a.atttypid, a.atttypmod) as pk_type
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indisprimary and n.nspname = ${schema} and c.relname = ${table} and c.relkind = 'r'
      and array_length(i.indkey, 1) = 1`;
  if (rows.length !== 1) throw new Error(`no single-column primary key for ${schema}.${table}`);
  return rows[0] as { pk: string; pk_type: string };
}

async function exportChunk(b: any) {
  const { run, schema, table, limit } = b;
  const chunk: number = b.chunk ?? 0;
  const after: string | null = b.after ?? null;
  const { pk, pk_type } = await tableInfo(schema, table);
  const casts: Record<string, any> = {
    bigint: sql`cast(${after} as bigint)`,
    smallint: sql`cast(${after} as smallint)`,
    uuid: sql`cast(${after} as uuid)`,
    text: sql`cast(${after} as text)`,
    boolean: sql`cast(${after} as boolean)`,
  };
  if (!casts[pk_type]) throw new Error(`unsupported key type ${pk_type}`);
  const where = after === null ? sql`true` : sql`t.${sql(pk)} > ${casts[pk_type]}`;
  const rows = await sql`
    select t.${sql(pk)}::text as k, to_jsonb(t)::text as j
    from ${sql(schema)}.${sql(table)} t
    where ${where}
    order by t.${sql(pk)}
    limit ${limit}`;
  if (rows.length === 0) return { done: true, rows: 0 };
  const raw = new TextEncoder().encode(rows.map((r) => r.j).join("\n") + "\n");
  const sha = await sha256(raw);
  const gz = await pipe(raw, new CompressionStream("gzip"));
  const path = `${run}/${schema}.${table}/${String(chunk).padStart(5, "0")}.ndjson.gz`;
  const { error } = await storage.from(BUCKET).upload(path, gz, { contentType: "application/gzip", upsert: true });
  if (error) throw new Error(`upload failed: ${error.message}`);
  const lastKey = rows[rows.length - 1].k as string;
  await sql`
    insert into private.backup_manifest
      (run_id, schema_name, table_name, chunk, after_key, last_key, row_count, raw_bytes, gz_bytes, sha256_raw, object_path)
    values (${run}, ${schema}, ${table}, ${chunk}, ${after}, ${lastKey}, ${rows.length}, ${raw.byteLength}, ${gz.byteLength}, ${sha}, ${path})
    on conflict (run_id, schema_name, table_name, chunk) do update set
      after_key = excluded.after_key, last_key = excluded.last_key, row_count = excluded.row_count,
      raw_bytes = excluded.raw_bytes, gz_bytes = excluded.gz_bytes, sha256_raw = excluded.sha256_raw,
      object_path = excluded.object_path, created_at = now(), verified_at = null, verify_ok = null, verify_note = null`;
  return { done: rows.length < limit, rows: rows.length, next: { ...b, chunk: chunk + 1, after: lastKey } };
}

async function verifyOne(b: any) {
  const offset: number = b.offset ?? 0;
  const [m] = await sql`
    select * from private.backup_manifest where run_id = ${b.run}
    order by schema_name, table_name, chunk offset ${offset} limit 1`;
  if (!m) return { done: true };
  let ok = false;
  let note = "";
  const { data, error } = await storage.from(BUCKET).download(m.object_path);
  if (error || !data) {
    note = `download failed: ${error?.message ?? "no data"}`;
  } else {
    const gz = new Uint8Array(await data.arrayBuffer());
    const raw = await pipe(gz, new DecompressionStream("gzip"));
    const sha = await sha256(raw);
    let lines = 0;
    for (let i = 0; i < raw.length; i++) if (raw[i] === 10) lines++;
    ok = sha === m.sha256_raw && lines === m.row_count && gz.byteLength === Number(m.gz_bytes);
    note = `sha ${sha === m.sha256_raw ? "match" : "MISMATCH"}, lines ${lines}/${m.row_count}, gz ${gz.byteLength}/${m.gz_bytes}`;
  }
  await sql`
    update private.backup_manifest set verified_at = now(), verify_ok = ${ok}, verify_note = ${note}
    where run_id = ${m.run_id} and schema_name = ${m.schema_name} and table_name = ${m.table_name} and chunk = ${m.chunk}`;
  return { done: false, ok, note, next: { ...b, offset: offset + 1 } };
}

async function dumpSchema(run: string) {
  const [info] = await sql`
    select jsonb_build_object(
      'captured_at', now(),
      'server_version', current_setting('server_version'),
      'columns', (select jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'column', column_name,
          'position', ordinal_position, 'type', data_type, 'udt', udt_name, 'nullable', is_nullable, 'default', column_default)
          order by table_schema, table_name, ordinal_position)
        from information_schema.columns where table_schema in ('public', 'private')),
      'constraints', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'name', k.conname,
          'def', pg_get_constraintdef(k.oid)) order by n.nspname, c.relname, k.conname)
        from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'private')),
      'indexes', (select jsonb_agg(jsonb_build_object('schema', schemaname, 'name', indexname, 'def', indexdef) order by schemaname, indexname)
        from pg_indexes where schemaname in ('public', 'private')),
      'views', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
          'def', pg_get_viewdef(c.oid, true)) order by n.nspname, c.relname)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('v', 'm') and n.nspname in ('public', 'private')),
      'functions', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'def', pg_get_functiondef(p.oid))
          order by n.nspname, p.proname)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
        where n.nspname in ('public', 'private') and p.prokind in ('f', 'p') and d.objid is null),
      'triggers', (select jsonb_agg(jsonb_build_object('table', c.relname, 'name', t.tgname, 'def', pg_get_triggerdef(t.oid)))
        from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal and n.nspname in ('public', 'private')),
      'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public', 'private')),
      'sequences', (select jsonb_agg(jsonb_build_object('schema', schemaname, 'name', sequencename, 'last_value', last_value))
        from pg_sequences where schemaname in ('public', 'private')),
      'row_counts_at_capture', (select jsonb_object_agg(n.nspname || '.' || c.relname, c.reltuples::bigint)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname in ('public', 'private')),
      'cron_jobs', (select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'command', command)) from cron.job)
    ) as doc`;
  const raw = new TextEncoder().encode(JSON.stringify(info.doc, null, 1));
  const gz = await pipe(raw, new CompressionStream("gzip"));
  const path = `${run}/schema.json.gz`;
  const { error } = await storage.from(BUCKET).upload(path, gz, { contentType: "application/gzip", upsert: true });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return { path, raw_bytes: raw.byteLength, gz_bytes: gz.byteLength, sha256_raw: await sha256(raw) };
}

Deno.serve(async (req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!isServiceCaller(authorization)) return new Response("Unauthorized", { status: 401 });
  try {
    const b = await req.json();
    if (b.mode === "init") {
      const { data } = await storage.getBucket(BUCKET);
      if (!data) {
        const { error } = await storage.createBucket(BUCKET, { public: false });
        if (error) throw new Error(`bucket: ${error.message}`);
      }
      return json({ ok: true, bucket: BUCKET });
    }
    if (b.mode === "schema") return json(await dumpSchema(b.run));
    if (b.mode === "export") {
      const r = await exportChunk(b);
      if (!r.done && b.chain) chainNext(authorization, r.next);
      return json(r);
    }
    if (b.mode === "verify") {
      const r = await verifyOne(b);
      if (!r.done && b.chain) chainNext(authorization, r.next);
      return json(r);
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
