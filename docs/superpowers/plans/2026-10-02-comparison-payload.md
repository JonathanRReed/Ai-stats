# Smaller comparison payloads
## Approved scope
Keep every source record searchable while reducing first-load mobile data. Detailed measurements load only for selected records; default chart and exact data remain server-rendered. Preserve source identities, history, shared URLs, presets, costs and accessibility. No upstream calls per visitor and no new services or credentials.
## Approach
Use an additive compact catalog prop and existing static Astro API pattern. A build-scoped server helper produces a versioned identity catalog, six complete default records, preset/control metadata and deterministic measurement chunks. Chunk URLs include a SHA-256 revision so a stale page cannot mix datasets. Browser reads same-origin static JSON, validates revision and exact IDs, caches successful chunks and supports retry without clearing selections. Existing full catalog/API stays compatible.
## Implementation
1. Test compact roundtrip, all source identities, reduced serialized size, hash partitioning, stale/malformed response rejection, concurrent selection and failed retry; run failing tests
2. Implement pure delivery helpers plus server-only snapshot hashing and static chunk endpoint
3. Switch Compare page to compact catalog + default seed; fetch missing selected measurements only, preserve picker metadata and server-rendered fallback
4. Test full suite/lint/typecheck, actual preview desktop and 390px shared-link/rapid-selection/retry/accessibility flows; inspect measured output byte counts
5. Independent review, PR and merge, verify production before refresh work
## Boundaries
Static delivery remains build-bound in this step. Separating refresh from code release is the next approved step. Avoid runtime database load or adding any credentials.
