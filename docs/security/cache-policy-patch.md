# HTTP cache policy patch

GHSA-ch52-4w7c-c8xp affects http-cache-semantics 4.2.0. There is no upstream patched release as of 2026-10-03. The checked-in Bun patch rejects security-restricted cache entries before max-stale reuse, direct stale-while-revalidate, and stale-if-error fallback. Ordinary public stale reuse and cookie opt-ins remain supported.

`bun run audit` verifies the exact package version, patch mapping, patch SHA-256, every installed module copy and resolved entrypoint. It runs installed-package regression tests, then reads the unfiltered Bun audit JSON. Only the exact repaired advisory is permitted; other findings, missing patches, unknown copies, invalid output and audit service failures block release. This is a local remediation, not an upstream fixed release. Raw `bun audit` will still report the version-based advisory.

Upstream reference: https://github.com/kornelski/http-cache-semantics/pull/58

The patch also closes stale-if-error and direct stale-while-revalidate sibling paths. Expired shared s-maxage responses also require revalidation; their ordinary fresh lifetime remains usable. Replace the patch with a trusted upstream fixed release and remove this exception when available.

## October 9, 2026 hardening and upstream review

The local patch also normalizes Cache-Control directive names when parsing and
restoring serialized policies. Mixed-case `Private`, `No-Store`, `No-Cache`,
`Must-Revalidate`, `Proxy-Revalidate`, and `S-Maxage` must enforce the same local
restrictions as their lowercase forms. Arguments retain their original case.
Wildcard members in `Vary`, including surrounding whitespace or other list
members, block reuse, stale fallback, and positive TTL. See [RFC 9111 sections
4.1 and 5.2](https://www.rfc-editor.org/rfc/rfc9111.html).

Upstream 4.3.0 was published October 4 by the existing npm maintainer. Its
published `index.js` was verified byte-for-byte against official repository
commit `b1d4bd682fbab0252985de45219f4e7497c0067c`; the package has no install
scripts. It still fails 8 of this repository's 10 pre-existing cache-policy
regressions, so it does not replace this project's stricter local policy.
The maintainer closed and disputed the original proposed CVE fix in
[upstream PR 58](https://github.com/kornelski/http-cache-semantics/pull/58).
Do not describe the 4.3.0 release as implementing this patch or silently remove
the integrity-verified exception. These are dependency-level hardening tests,
not proof that the static visitor-facing site exposes a shared response cache.

The October 9 lockfile update also pins the smallest qualified upstream fixes:
`postcss-selector-parser` 7.1.6, `sharp` 0.35.5 (prebuilt librsvg 2.63.2),
`smol-toml` 1.9.1, and `source-map-js` 1.2.2. Registry repositories and
maintainers, published package contents, and install hooks were inspected before
installation with lifecycle scripts disabled. The lockfile changes are limited
to those four packages and Sharp's matching platform libraries.

`smol-toml` 1.9.0 repairs the reported complexity issue but accepts malformed
extra exponent signs such as `1e++2`; the signed
[1.9.1 release](https://github.com/squirrelchat/smol-toml/releases/tag/v1.9.1)
repairs that regression. `scripts/dependency-security-compatibility.test.ts`
checks the version floors, malformed source-map offsets, normal selector/TOML
behavior, invalid exponent rejection, the loaded librsvg version, and a small
trusted SVG-to-PNG render. The dependency audit still permits only the existing,
integrity-verified cache-policy exception and rejects other findings.
