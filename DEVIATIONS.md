# Deviations from the pre-registration

Each entry: date, what changed, why, and the effect on interpretation.

## 2026-10-12: control arm uses a random sample of queries
- **Pre-registered:** matched organic-result controls for all 300 queries.
- **Done instead:** a seeded random sample of 100 queries (20 per vertical, seed 20261012; ids in `data/sample-ids.json`). Only these 100 queries enter the cited-vs-control comparison.
- **Why:** the search API used for organic results rate-limited the full run (290 of the first 300 requests failed at default concurrency; roughly 1-2 requests per minute after slowing down).
- **Effect:** fewer query-site rows, wider confidence intervals. The engine collection itself covers all 300 queries and is published in full.
- Sample chosen by Jeffrey's instruction ("use a random sample for controls"); the seed was fixed before the control data was fetched.

## 2026-10-12: hypothesis 3 not tested
- **Pre-registered:** H3, name/address/phone consistency across third-party directories.
- **Why dropped:** it needs per-business lookups across several directories; not feasible for hundreds of sites in this run.
- **Effect:** the study reports H1 and H2 only. H3 stays untested, not "no effect".

## 2026-10-12: domain-age control dropped
- **Pre-registered:** control for domain-age bucket.
- **Why dropped:** WHOIS/RDAP lookups were not run for this release.
- **Effect:** results are adjusted for vertical only. Older sites may differ systematically in both schema use and citation, so associations may be confounded.

## 2026-10-12: analysis details not specified in advance
- Standard errors are not clustered by query (the same site can appear in several rows), so intervals are optimistic.
- Feature detection is a homepage heuristic (JSON-LD parse; FAQ = FAQPage schema, a details element, or an FAQ heading).
- "Aggregator" exclusion list (directories, review platforms, social, news, .gov/.edu/.org) is in `scripts/features.mjs`.
