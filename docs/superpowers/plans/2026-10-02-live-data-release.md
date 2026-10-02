# Cached data releases independent of code deploys
## Intent
A successful source refresh should become usable by AI Stats without a Git commit or website rebuild. Keep the existing static page as an immediate fallback and never call upstream data vendors from a visitor's browser.
## Design
Publish a validated, versioned app-data release from the existing scheduled ingestion workflow into a bounded Supabase cache. Reuse its existing server identity. The cache holds current and previous derived app releases in two slots; original source history remains untouched. An atomic service-only promotion swaps the active slot, and a service-only rollback can select the previous release.
Serve current-release metadata, manifests and selected measurement/benchmark assets through narrowly routed Cloudflare Pages Functions using existing public Supabase environment bindings. Only GET/HEAD and this production project are supported. Edge caching limits database traffic. All other site routes remain static.
A small Compare wrapper checks the current release, validates it, and loads the manifest once when its revision differs. Existing URL selections remain the source of truth. Later refreshes are offered through a concise refresh control so an inspection or open picker is not interrupted. Offline, missing configuration or invalid data leaves the dated static snapshot usable.
## Release contract
Manifest carries schemaVersion, generatedAt, source timestamps, delivery catalog/control metadata, default measurement seed and benchmark names. Measurement chunks and benchmark datasets are immutable for a release revision. The publisher reads only verified public build artifacts and validates identity/count/units before promotion. No raw fetch data, credentials or user/share data enter this cache.
## Order
1. Publisher/manifest contract and isolated database tests
2. Reviewed additive cache migration and service-only promotion/rollback
3. Read-only Pages API and client refresh, with missing-binding fallback
4. Publish a first release from the existing workflow and verify it independently of code deployment
5. Apply the same coherent refresh contract to Stats/catalog consumers, then finish AA fixed-window quota guards before raising cadence
## Verification
Empty or malformed release cannot replace current; anonymous callers cannot publish/rollback/write; two-slot cache stays bounded; previous release survives; identity mismatches/old releases cannot mix; failed chunk does not hide successful selections; fresh manifest preserves URL state; source failure retains last good timestamps; runtime routes never expose credentials or proxy arbitrary URLs.
## Constraints
No paid APIs, subscriptions or new credential grants. No destructive source/history cleanup. No changes to AI Drag Racing sharing RPCs. Code and migrations through GitHub MCP; tests on Snoopy's cloud machine. Keep UI text brief and operational.
