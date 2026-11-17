# Toll Road Data Pipeline

Answers one question per toll road: **who funded it, how much money went in,
how much came out, and why is it still a toll road?**

## Layout

```
scripts/scrapers/
├── run-toll-roads.ts          # CLI orchestrator + validation + merge
├── lib/
│   ├── http.ts                # fetch w/ retry, HTML table extraction
│   └── format.ts              # "Rs 2,300 crore" -> number, date parsing
└── sources/
    ├── nhai-tis.ts            # NHAI Toll Information System (rates/plazas)
    ├── data-gov-in.ts         # data.gov.in dataset API client
    ├── gazette-india.ts       # Central + state gazette deep-links & scraping
    └── mca-company.ts         # MCA company filings lookup links
```

Curated (human-reviewed, cited) data lives in `data/in/toll-roads/*.json`.
Scrapers never overwrite curated files; they write `_overlays/` and `_merged/`
for review first.

## Sources, ranked by authority

| Source | What it gives | Access |
|---|---|---|
| **Concession Agreement** | The contract: toll end condition, cost-recovery formula, extensions | Court records, RTI, legislative questions |
| **Gazette notifications** (egazette.gov.in, state gazettes) | Official toll notification + every rate change/extension | Free, brittle portals |
| **MCA company filings** (mca.gov.in) | Audited revenue, debt, reserves of the concessionaire | Master data free; documents ~Rs100 each. Listed cos (NTBCL) free via BSE/NSE |
| **NHAI TIS** (tis.nhai.gov.in) | Plaza list + official rates for NHAI roads only | Free HTML, scrapeable |
| **RTI responses** | The missing numbers: cumulative collections, claimed project cost | Rs10/request — this platform's own RTI module |
| **Court orders** | e.g., Allahabad HC 2016 DND toll-free order | Free on court websites |
| **data.gov.in** | Aggregate toll/revenue datasets (MoRTH, NHAI) | Free API key |

**Coverage note:** NICE Road and DND Flyway are NOT in NHAI TIS — they are
state PPP concessions. For those, the concession agreement + MCA filings +
RTI are the real sources. TIS/data.gov.in matter when expanding to the ~850+
NHAI toll plazas.

## Usage

```bash
npx tsx scripts/scrapers/run-toll-roads.ts --validate          # schema check
npx tsx scripts/scrapers/run-toll-roads.ts --source all        # deep-links + lookups
npx tsx scripts/scrapers/run-toll-roads.ts --source nhai-tis   # scrape TIS plazas
npx tsx scripts/scrapers/run-toll-roads.ts --source data-gov --resource <id>
```

Set `DATA_GOV_IN_API_KEY` in `.env.local` (free registration at data.gov.in).

## Adding a new toll road

1. Copy an existing JSON in `data/in/toll-roads/`, fill what you can verify.
2. Every non-obvious number needs a `SourceCitation`. Estimates must say so in `note`.
3. Put unknowns into `analysis.openQuestions` — these drive RTI filing targets.
4. Run `--validate`, then the app picks it up automatically.
