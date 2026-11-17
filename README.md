# data.ftw

An open, cited record of Indian governance data, by [ForThisWorld](https://forthis.world). It starts with toll roads:
for each one, who built it, what it cost, who sanctioned it, how much it has earned, and why it is still tolled.
Every number carries a source. Anything unknown becomes an RTI request that the platform files and tracks.

Status and next steps: [PLAN.md](PLAN.md).

## What's here

| Path | What |
| :--- | :--- |
| `src/` | The website (Next.js 15, shadcn/ui, Tailwind, MapLibre): a zoomable, searchable map of India, state pages, toll roads, people, the RTI tracker |
| `data/in/` | The published record: reviewed JSON, each fact with its citation. Schema in `src/types/index.ts` |
| `public/geo/in/` | Map boundaries (India outline per Survey of India, states, 2011 districts) built from DataMeet by `npm run geo:build`; licences in its ATTRIBUTION.md |
| `scripts/scrapers/` | Source adapters (NHAI TIS, data.gov.in, Gazette, MCA); they write overlays for review, never the published files. See its README |
| `mcp-server/` | MCP server so AI clients can search the record, list data gaps, draft RTIs and submit contributions to a review queue (`data/_contributions/`, not published) |

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run data:validate   # every fact must cite a source it was read from (data/SOURCING.md)
```

There is no database. The site reads the published record in `data/` through a module generated at build time (`npm run data:index`, run automatically by `dev`, `build` and `npm install`), so the same build runs on Node and on Cloudflare Workers.

## Contributing data

Copy a file in `data/in/toll-roads/`, fill in only what you can cite, and put unknowns in `analysis.openQuestions`.
Run `--validate` and open a pull request. Every change to the record is reviewed.

## Licence

- **Code:** [MIT](LICENSE).
- **Data:** [Open Database License (ODbL) 1.0](LICENSE-DATA). You can use it for anything, including commercial use,
  with attribution. If you publish a changed copy of the database, it must also be ODbL. See
  [data/LICENSE.md](data/LICENSE.md). Cited source documents keep their own terms.
