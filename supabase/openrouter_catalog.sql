-- Add OpenRouter's public model catalog as a separate source layer.
-- This stores metadata, pricing, capabilities, and source raw JSON without
-- mixing OpenRouter popularity/performance signals into AA or Epoch scores.

create table if not exists public.openrouter_models (
  id uuid primary key default gen_random_uuid(),
  openrouter_id text not null unique,
  canonical_slug text,
  author_slug text,
  model_slug text,
  name text not null,
  description text,
  created_unix bigint,
  context_length integer,
  prompt_price_1m numeric,
  completion_price_1m numeric,
  request_price numeric,
  image_price numeric,
  web_search_price numeric,
  internal_reasoning_price_1m numeric,
  input_cache_read_price_1m numeric,
  input_cache_write_price_1m numeric,
  is_free boolean not null default false,
  input_modalities text[] not null default '{}',
  output_modalities text[] not null default '{}',
  tokenizer text,
  instruct_type text,
  supported_parameters text[] not null default '{}',
  architecture jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  top_provider jsonb,
  per_request_limits jsonb,
  expiration_date text,
  raw jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.openrouter_model_endpoints (
  id uuid primary key default gen_random_uuid(),
  openrouter_model_id text not null references public.openrouter_models(openrouter_id) on delete cascade,
  provider_name text not null,
  endpoint_name text,
  tag text,
  model_name text,
  context_length integer,
  max_prompt_tokens integer,
  max_completion_tokens integer,
  prompt_price_1m numeric,
  completion_price_1m numeric,
  request_price numeric,
  image_price numeric,
  web_search_price numeric,
  status integer,
  uptime_last_5m numeric,
  uptime_last_30m numeric,
  uptime_last_1d numeric,
  latency_last_30m numeric,
  throughput_last_30m numeric,
  supports_implicit_caching boolean,
  quantization text,
  supported_parameters text[] not null default '{}',
  pricing jsonb not null default '{}'::jsonb,
  raw jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_openrouter_models_author_slug
  on public.openrouter_models(author_slug);

create index if not exists idx_openrouter_models_context_length
  on public.openrouter_models(context_length desc nulls last);

create index if not exists idx_openrouter_models_prompt_price
  on public.openrouter_models(prompt_price_1m asc nulls last)
  where prompt_price_1m is not null;

create index if not exists idx_openrouter_models_free
  on public.openrouter_models(openrouter_id)
  where is_free;

create index if not exists idx_openrouter_models_supported_parameters
  on public.openrouter_models using gin(supported_parameters);

create index if not exists idx_openrouter_models_input_modalities
  on public.openrouter_models using gin(input_modalities);

create index if not exists idx_openrouter_model_endpoints_model
  on public.openrouter_model_endpoints(openrouter_model_id);

create index if not exists idx_openrouter_model_endpoints_provider
  on public.openrouter_model_endpoints(provider_name);

create unique index if not exists openrouter_model_endpoints_unique_endpoint
  on public.openrouter_model_endpoints(
    openrouter_model_id,
    provider_name,
    coalesce(tag, ''),
    coalesce(endpoint_name, '')
  );

create or replace function public.openrouter_price_per_million(value text)
returns numeric
language sql
immutable
strict
as $$
  select case
    when value ~ '^-?[0-9]+(\.[0-9]+)?$' then value::numeric * 1000000
    else null
  end;
$$;

create or replace function public.openrouter_price_value(value text)
returns numeric
language sql
immutable
strict
as $$
  select case
    when value ~ '^-?[0-9]+(\.[0-9]+)?$' then value::numeric
    else null
  end;
$$;

create or replace function public.openrouter_jsonb_text_array(value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(coalesce(value, '[]'::jsonb))
    ),
    '{}'::text[]
  );
$$;

create or replace function public.sync_openrouter_models()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  response record;
  synced_count integer;
begin
  select status, content
  into response
  from public.http_get('https://openrouter.ai/api/v1/models?output_modalities=all');

  if response.status < 200 or response.status >= 300 then
    raise exception 'OpenRouter model sync failed with HTTP status %', response.status;
  end if;

  with source_rows as (
    select jsonb_array_elements((response.content::jsonb)->'data') as model
  ),
  normalized as (
    select
      model,
      model->>'id' as openrouter_id,
      nullif(model->>'canonical_slug', '') as canonical_slug,
      nullif(split_part(model->>'id', '/', 1), '') as author_slug,
      nullif(split_part(model->>'id', '/', 2), '') as model_slug,
      coalesce(nullif(model->>'name', ''), model->>'id') as name,
      nullif(model->>'description', '') as description,
      public.openrouter_price_per_million(model #>> '{pricing,prompt}') as prompt_price_1m,
      public.openrouter_price_per_million(model #>> '{pricing,completion}') as completion_price_1m
    from source_rows
    where model ? 'id'
  )
  insert into public.openrouter_models (
    openrouter_id,
    canonical_slug,
    author_slug,
    model_slug,
    name,
    description,
    created_unix,
    context_length,
    prompt_price_1m,
    completion_price_1m,
    request_price,
    image_price,
    web_search_price,
    internal_reasoning_price_1m,
    input_cache_read_price_1m,
    input_cache_write_price_1m,
    is_free,
    input_modalities,
    output_modalities,
    tokenizer,
    instruct_type,
    supported_parameters,
    architecture,
    pricing,
    top_provider,
    per_request_limits,
    expiration_date,
    raw,
    fetched_at,
    updated_at
  )
  select
    openrouter_id,
    canonical_slug,
    author_slug,
    model_slug,
    name,
    description,
    case when (model->>'created') ~ '^[0-9]+$' then (model->>'created')::bigint else null end,
    case when (model->>'context_length') ~ '^[0-9]+$' then (model->>'context_length')::integer else null end,
    prompt_price_1m,
    completion_price_1m,
    public.openrouter_price_value(model #>> '{pricing,request}'),
    public.openrouter_price_value(model #>> '{pricing,image}'),
    public.openrouter_price_value(model #>> '{pricing,web_search}'),
    public.openrouter_price_per_million(model #>> '{pricing,internal_reasoning}'),
    public.openrouter_price_per_million(model #>> '{pricing,input_cache_read}'),
    public.openrouter_price_per_million(model #>> '{pricing,input_cache_write}'),
    openrouter_id like '%:free' or (coalesce(prompt_price_1m, 0) = 0 and coalesce(completion_price_1m, 0) = 0),
    public.openrouter_jsonb_text_array(model #> '{architecture,input_modalities}'),
    public.openrouter_jsonb_text_array(model #> '{architecture,output_modalities}'),
    nullif(model #>> '{architecture,tokenizer}', ''),
    nullif(model #>> '{architecture,instruct_type}', ''),
    public.openrouter_jsonb_text_array(model->'supported_parameters'),
    coalesce(model->'architecture', '{}'::jsonb),
    coalesce(model->'pricing', '{}'::jsonb),
    model->'top_provider',
    model->'per_request_limits',
    nullif(model->>'expiration_date', ''),
    model,
    now(),
    now()
  from normalized
  on conflict (openrouter_id) do update set
    canonical_slug = excluded.canonical_slug,
    author_slug = excluded.author_slug,
    model_slug = excluded.model_slug,
    name = excluded.name,
    description = excluded.description,
    created_unix = excluded.created_unix,
    context_length = excluded.context_length,
    prompt_price_1m = excluded.prompt_price_1m,
    completion_price_1m = excluded.completion_price_1m,
    request_price = excluded.request_price,
    image_price = excluded.image_price,
    web_search_price = excluded.web_search_price,
    internal_reasoning_price_1m = excluded.internal_reasoning_price_1m,
    input_cache_read_price_1m = excluded.input_cache_read_price_1m,
    input_cache_write_price_1m = excluded.input_cache_write_price_1m,
    is_free = excluded.is_free,
    input_modalities = excluded.input_modalities,
    output_modalities = excluded.output_modalities,
    tokenizer = excluded.tokenizer,
    instruct_type = excluded.instruct_type,
    supported_parameters = excluded.supported_parameters,
    architecture = excluded.architecture,
    pricing = excluded.pricing,
    top_provider = excluded.top_provider,
    per_request_limits = excluded.per_request_limits,
    expiration_date = excluded.expiration_date,
    raw = excluded.raw,
    fetched_at = excluded.fetched_at,
    updated_at = excluded.updated_at;

  get diagnostics synced_count = row_count;
  return synced_count;
end;
$$;

alter table public.openrouter_models enable row level security;
alter table public.openrouter_model_endpoints enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_models'
      and policyname = 'openrouter_models_select_all'
  ) then
    create policy openrouter_models_select_all
      on public.openrouter_models
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_model_endpoints'
      and policyname = 'openrouter_model_endpoints_select_all'
  ) then
    create policy openrouter_model_endpoints_select_all
      on public.openrouter_model_endpoints
      for select
      using (true);
  end if;
end;
$$;

revoke all on function public.sync_openrouter_models() from public, anon, authenticated;
revoke all on function public.openrouter_price_per_million(text) from public, anon, authenticated;
revoke all on function public.openrouter_price_value(text) from public, anon, authenticated;
revoke all on function public.openrouter_jsonb_text_array(jsonb) from public, anon, authenticated;

select public.sync_openrouter_models();
