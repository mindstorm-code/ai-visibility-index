# AI Visibility Index — Pre-registration

Author: Jeffrey Jenson (Mindstorm Labs). Status: **pre-registered before any data collection.** This commit's timestamp is the registration.

## Research question
How often do AI answer engines cite small-business websites for local-service queries, and which site features predict being cited?

## Hypotheses (declared in advance)
- **H1:** Sites with valid LocalBusiness (or Organization) schema are cited more often than sites without.
- **H2:** Sites with a direct-answer FAQ block are cited more often than sites without.
- **H3:** Sites whose name/address/phone match across third-party directories are cited more often.
- **Null:** none of these features is associated with citation rate after controlling for domain-age bucket.

## Sample (fixed now)
- **Verticals (5):** plumbing, dental, HVAC, personal-injury law, landscaping.
- **Metros (10):** Phoenix, Dallas, Atlanta, Denver, Salt Lake City, Charlotte, Nashville, Tampa, Columbus, Sacramento.
- **Queries:** 5 verticals x 10 metros x 6 templates = **300 queries per engine**, built from `query-templates.txt` (committed with this registration; no query is added or removed after collection starts).
- **Engines (primary):** Gemini with Google Search grounding. Any additional web-grounded engine run later is reported as **exploratory**, with the date it was added.

## Method
1. Run every query on each engine inside a single collection window; log the full answer text and every cited URL (`data/raw/`).
2. Treat a business website as "cited" if its domain appears in the engine's citations or answer. Exclude directories, aggregators, news and review platforms from the site sample.
3. For each cited site, plus a matched random control set of non-cited sites ranking in the organic results for the same query, record: schema types present, FAQ block present, NAP consistency across directories (yes/no), domain-age bucket.
4. Compute citation rate by feature; fit a logistic regression for the null above. Report effect sizes with 95% confidence intervals, not only significance.

## Bias controls
- Queries and analysis plan are frozen by this commit.
- Raw logs, features and the analysis script are published (data CC BY 4.0, code MIT).
- Mindstorm Labs customers, if any appear, are flagged and reported separately (disclosed conflict of interest).
- Deviations from this plan are listed in `DEVIATIONS.md` with dates.

## Limitations (stated up front)
Engines change answers over time; US-only; correlational, not causal; local-service verticals only; one primary engine.

## Outputs
Report, CSV, methodology page, Dataset schema, and a named framework with a one-sentence definition, published at https://mindstormlabs.dev/jeffrey once data is in.

## Licenses
Data: CC BY 4.0. Code: MIT.
