import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2";

// Moves old aa_fetches payloads (data and raw) into the private aa-fetch-archive bucket.
// Each row keeps the object path, the SHA-256 and the byte size of the archived payload, so
// nothing is lost: the payload is uploaded, downloaded again and checked before the columns are cleared.
// The newest successful language fetch and anything from the last day stay inline.
// verify_jwt MUST remain enabled: the gateway verifies the signature before this handler.
const BUCKET = "aa-fetch-archive";
const KEEP_INLINE = "24 hours";
const MAX_ROWS_PER_CALL = 6;

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

async function ensureBucket() {
  const { data } = await storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`bucket: ${error.message}`);
}

async function archiveBatch(limit: number) {
  await ensureBucket();
  return await sql.begin(async (tx) => {
    // The payload keeps a flag for SQL NULL so a restore can tell it apart from a JSON null value.
    const rows = await tx`
      select a.id::text as id, to_char(a.fetched_at at time zone 'UTC', 'YYYY/MM') as month,
        jsonb_build_object(
          'data', a.data, 'raw', a.raw,
          'data_is_sql_null', a.data is null, 'raw_is_sql_null', a.raw is null
        )::text as payload
      from public.aa_fetches a
      where (a.data is not null or a.raw is not null)
        and a.payload_object_path is null
        and a.fetched_at < now() - ${KEEP_INLINE}::interval
        and a.id is distinct from (
          select l.id from public.aa_fetches l
          where l.status = 200 and l.endpoint like 'language/%'
          order by l.fetched_at desc
          limit 1
        )
      order by a.fetched_at
      limit ${limit}
      for update of a skip locked`;

    const archived: { id: string; bytes: number }[] = [];
    for (const row of rows) {
      const raw = new TextEncoder().encode(row.payload);
      const sha = await sha256(raw);
      const path = `${row.month}/${row.id}.json.gz`;
      const gz = await pipe(raw, new CompressionStream("gzip"));
      const up = await storage.from(BUCKET).upload(path, gz, { contentType: "application/gzip", upsert: true });
      if (up.error) throw new Error(`upload failed for ${row.id}: ${up.error.message}`);

      const down = await storage.from(BUCKET).download(path);
      if (down.error || !down.data) throw new Error(`download failed for ${row.id}`);
      const check = await sha256(await pipe(new Uint8Array(await down.data.arrayBuffer()), new DecompressionStream("gzip")));
      if (check !== sha) throw new Error(`checksum mismatch for ${row.id}`);

      const updated = await tx`
        update public.aa_fetches a
        set data = null, raw = null,
            payload_object_path = ${path}, payload_sha256 = ${sha},
            payload_bytes = ${raw.byteLength}, payload_archived_at = now()
        where a.id = ${row.id}::uuid
          and jsonb_build_object(
            'data', a.data, 'raw', a.raw,
            'data_is_sql_null', a.data is null, 'raw_is_sql_null', a.raw is null
          )::text = ${row.payload}
        returning a.id`;
      if (updated.length !== 1) throw new Error(`row ${row.id} changed while archiving`);
      archived.push({ id: row.id, bytes: raw.byteLength });
    }
    return archived;
  });
}

Deno.serve(async (req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!isServiceCaller(authorization)) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || MAX_ROWS_PER_CALL, 1), MAX_ROWS_PER_CALL);
    const archived = await archiveBatch(limit);
    const [{ remaining }] = await sql`
      select count(*)::int as remaining from public.aa_fetches a
      where (a.data is not null or a.raw is not null) and a.payload_object_path is null
        and a.fetched_at < now() - ${KEEP_INLINE}::interval
        and a.id is distinct from (
          select l.id from public.aa_fetches l
          where l.status = 200 and l.endpoint like 'language/%'
          order by l.fetched_at desc
          limit 1
        )`;
    return Response.json({ ok: true, archived: archived.length, bytes: archived.reduce((n, r) => n + r.bytes, 0), remaining });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
});
