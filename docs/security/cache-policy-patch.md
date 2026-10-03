# HTTP cache policy patch

GHSA-ch52-4w7c-c8xp affects http-cache-semantics 4.2.0. There is no upstream patched release as of 2026-10-03. The checked-in Bun patch rejects security-restricted cache entries before max-stale reuse, direct stale-while-revalidate, and stale-if-error fallback. Ordinary public stale reuse and cookie opt-ins remain supported.

`bun run audit` verifies the exact package version, patch mapping, patch SHA-256, every installed module copy and resolved entrypoint. It runs installed-package regression tests, then reads the unfiltered Bun audit JSON. Only the exact repaired advisory is permitted; other findings, missing patches, unknown copies, invalid output and audit service failures block release. This is a local remediation, not an upstream fixed release. Raw `bun audit` will still report the version-based advisory.

Upstream reference: https://github.com/kornelski/http-cache-semantics/pull/58

The patch also closes stale-if-error and direct stale-while-revalidate sibling paths. It intentionally leaves unrelated shared s-maxage expiry semantics unchanged. Replace the patch with a trusted upstream fixed release and remove this exception when available.
