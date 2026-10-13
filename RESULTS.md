# AI Visibility Index: results (run of 2026-10-12)

Engine: Gemini with Google Search grounding. 300 queries collected (5 verticals x 10 US metros x 6 templates). The cited-vs-control comparison uses a seeded random sample of 100 of those queries (20 per vertical; see `DEVIATIONS.md`).

## Headline
Neither pre-registered feature predicted being cited. Sites cited by Gemini and organic-top-10 sites that were not cited look the same on both:

| Hypothesis | Feature | Cited sites with it | Control sites with it | Odds ratio (95% CI) | Adjusted for vertical (95% CI) |
|---|---|---|---|---|---|
| H1 | LocalBusiness-type or Organization schema | 75.3% | 76.2% | 0.96 (0.70-1.31) | 1.01 (0.72-1.41) |
| H2 | FAQ block (schema, details element or FAQ heading) | 46.5% | 46.2% | 1.01 (0.77-1.33) | 1.08 (0.81-1.45) |
| H3 | Name/address/phone consistency | not tested | | | |

Rows: 857 (query x site) across 532 reachable business sites; 454 cited rows, 403 control rows. The null (no association) is not rejected for H1 or H2.

## Descriptive finding (all 300 queries)
Citations are dominated by source types other than business websites. Reddit appeared in 285 of 300 answers, followed by consumeraffairs.com (94), angi.com (74), serviceagent.ai (43), houzz.com (41) and bbb.org (37). Answers averaged 9.0 cited sources; 823 distinct domains were cited. This is descriptive, not a tested hypothesis.

## Limitations
- Standard errors are not clustered by query; the same site can appear in several rows, so intervals are optimistic.
- The schema feature is broad (Organization counts), and about three quarters of sites in both groups have it, so it separates little. A narrower LocalBusiness-only feature was not pre-registered and is not reported here.
- FAQ and schema detection read the homepage only.
- One engine, US metros, five local-service verticals, one collection window (2026-10-12).
- Control set = organic top-10 results (Firecrawl search) that Gemini did not cite for that query; organic rankings are not personalized or localized to a device.
- Correlational, not causal. Domain-age control and H3 were not run (see `DEVIATIONS.md`).

## Reproduce
`node scripts/collect.mjs`, `node scripts/controls.mjs`, `node scripts/features.mjs`, `node scripts/analyze.mjs`. Needs a Gemini key and a Firecrawl key. Raw data: `data/raw/`. Output: `data/results.json`.

Data: CC BY 4.0. Code: MIT.
