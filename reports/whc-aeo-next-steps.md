# WHC AEO implementation status and measurement

## Implemented in source
- Prerendered public content and route-specific metadata for Home, Pricing, IRA, FAQ, and Buy.
- Standardized core canonical URLs and sitemap entries to the observed live www hostname; added Buy to the sitemap.
- Kept FAQ answers in native HTML disclosures, with structured data derived from the same answer source.
- Added a plain-language pricing glossary, a clearly hypothetical commission-versus-premium example, and a verified CFTC/FINRA source.
- Added IRA dealer/custodian/depository role definitions, transfer-versus-rollover distinctions, costs and risks, and verified IRS and CFTC/FINRA references.
- Replaced universal tax-free-rollover and non-commingled-storage assertions with account- and provider-dependent qualifications.
- Updated the source robots.txt sitemap directive to the preferred host. Cloudflare may override the live response; this source change does not prove the live directive changed.

These are implementation results, not claims that a production deployment or indexing update has occurred. Both Replit services were left stopped.

## Owner-confirmed policies now reflected in source
1. Both self-serve online and representative-assisted phone purchases are supported.
2. Every non-IRA purchase requires staffed FedEx pickup, including phone-assisted orders; residential delivery is not an alternative.
3. For self-serve purchases, the price stated in the agreement becomes binding when the buyer signs. Requesting a signing link is not a commitment, and payment clearance does not reprice the signed order.

Updated Home, FAQ and its structured data, Buy, Pricing, About, Radio, Terms, Disclosures, and the staff notification wording. IRA custodial delivery and funding requirements remain separate. No fee amounts, funding deadlines, trading integrations, or signature mechanics were changed.

The checkout shipping explanation now says orders meeting either existing threshold qualify, matching the existing greater-than-or-equal calculation; the thresholds themselves were not changed.

## Signing-template review required before release
Git also contains the purchase-agreement PDF generator, blank-template exporter, and mapped two-page package source. Those sources have now been aligned with the approved signing-price and staffed-pickup policies. Generated sample, blank, and mapped PDFs were checked for the approved clauses and page bounds; the blank and signature-page layouts were visually reviewed.

The separately stored live Docuplete package was not replaced. Source alignment and a Git push do not prove an existing package's stored PDF changed. Use `whc-docuplete-policy-handoff.txt` for the live-package checks. No real signing sessions, supplier trades, database updates, or package replacements were performed.

## Technical work still open
- Real HTTP 404 handling: preserve valid static and database-backed content, private/signing routes, API routing, and intentional 410 responses. Do not replace the SPA catch-all with an indiscriminate 404 rule.
- Confirm the deployed site serves the prerendered files and inspect Google's selected canonicals in Search Console after release.
- Review Cloudflare's actual search-bot access and live robots response without broadly unblocking training crawlers.
- Complete sitemap coverage and accurate modification dates, including database articles and depository/learning hub routes.
- Add verifiable full author/reviewer identities and a genuine company/review-profile reference. Do not invent credentials, review counts, or ratings.

## AI-visibility baseline
Use `whc-aeo-visibility-baseline.csv` as a blank recording sheet. No engine tests or rankings are represented by its empty results.

For each of the 12 prompts:
1. Create one row per engine tested: ChatGPT with search enabled, Perplexity, and Google when an AI answer actually appears.
2. Record the date, geography, exact engine/mode, whether WHC is mentioned, whether a clickable WHC citation appears, the cited URL, and answer notes. Keep the exact answer or a screenshot in separate evidence.
3. Use `yes`/`no` only for completed observations; record `no_ai_answer` or `unavailable` rather than counting an absent AI answer as a failed citation. Never count a Google blue-link result as an AI citation.
4. Mark completed rows `measured`. Keep `not_measured` for untouched rows.
5. Repeat the same prompts monthly under comparable conditions. Record brand and discovery results separately.

Mention rate = completed answer observations mentioning WHC / completed answer observations.
Citation rate = completed answer observations linking to WHC / completed answer observations.
Report sample sizes, engine, and measurement dates with either percentage. A single response is not a stable ranking.

GA4 can measure consented visits from identifiable AI referrers, not every citation or unclicked mention. Keep private signing data and query parameters out of analytics.

## Primary references verified during this pass
- IRS rollover and transfer rules: https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions
- IRS metals/collectibles exceptions: https://www.irs.gov/retirement-plans/investments-in-collectibles-in-individually-directed-qualified-plan-accounts
- CFTC/FINRA physical-metals buyer checklist: https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/Metals10Things.html

The older IRS collectibles URL and CFTC precious-metals URL suggested in the original audit returned not-found pages during verification. The public copy uses the working references above.
