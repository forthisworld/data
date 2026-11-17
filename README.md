# data.ftw

An open, cited record of Indian governance data, by [ForThisWorld](https://forthis.world). It starts with toll roads:
for each one, who built it, what it cost, who sanctioned it, how much it has earned, and why it is still tolled.
Every number carries a source. Anything unknown becomes an RTI request that the platform files and tracks.

Status and next steps: [PLAN.md](PLAN.md).

## What's here

| Path | What |
| :--- | :--- |
| `src/` | The website (Next.js 15, shadcn/ui, Tailwind): country, state and region pages, toll roads, people, infrastructure, the RTI tracker |
| `data/in/` | The published record: reviewed JSON, each fact with its citation. Schema in `src/types/index.ts` |
| `scripts/scrapers/` | Source adapters (NHAI TIS, data.gov.in, Gazette, MCA); they write overlays for review, never the published files. See its README |
| `mcp-server/` | MCP server so AI clients can search the record, list data gaps, draft RTIs and submit contributions for review |

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npx tsx scripts/scrapers/run-toll-roads.ts --validate
```

Some pages (entities, regions, search) still read from MongoDB through `src/lib/repositories`. That database has
been retired, and these reads are moving to the JSON in `data/` (see PLAN.md). Toll roads, RTI and overviews already
read the files directly.

## Contributing data

Copy a file in `data/in/toll-roads/`, fill in only what you can cite, and put unknowns in `analysis.openQuestions`.
Run `--validate` and open a pull request. Every change to the record is reviewed.

## Licence

- **Code:** [MIT](LICENSE).
- **Data:** [Open Database License (ODbL) 1.0](LICENSE-DATA). You can use it for anything, including commercial use,
  with attribution. If you publish a changed copy of the database, it must also be ODbL. See
  [data/LICENSE.md](data/LICENSE.md). Cited source documents keep their own terms.
