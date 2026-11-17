# data.ftw

An open atlas of public money in India, by [ForThisWorld](https://forthis.world). It starts with toll roads: for
each one, who built it, what it cost, who sanctioned it, how much it has earned, and why it is still tolled. Every
number links to its source, and claims are kept apart from findings. Anything unknown becomes an RTI question.

The home screen is a map of India: zoom in for districts, search for any state, district, toll road or person at
the bottom, and select a place to see what is published for it. It installs as an app (PWA) and works offline once
visited.

Status and next steps: [PLAN.md](PLAN.md).

## Ways to contribute

Add or correct sourced data, file an RTI and share the reply, improve the code, or (later) fund the work.
See **[CONTRIBUTING.md](CONTRIBUTING.md)**. Every change is reviewed by a person before it is published.

## Use it from your AI assistant

data.ftw is an MCP server at `https://<site>/api/mcp` (`http://localhost:3000/api/mcp` in development). Add it as
a custom connector in Claude, with `claude mcp add --transport http data-ftw <url>` in Claude Code, or as a `url`
entry in Cursor's `mcp.json`. The site's `/connect` page has the details and starter prompts. Tools: `search`,
`get_entity`, `list_toll_roads`, `get_data_gaps`, `draft_rti`, `submit_contribution` (opens a pull request).

## What's here

| Path | What |
| :--- | :--- |
| `src/` | The website (Next.js 15, Tailwind, MapLibre): the atlas, state pages, toll roads, people, the RTI tracker, `/connect` |
| `src/app/api/` | `search`, `mcp` (MCP over HTTP), `contributions` (sourced change → pull request), `research` (read-only, token) |
| `data/in/` | The published record: reviewed JSON, each fact with its citation. Rules in [data/SOURCING.md](data/SOURCING.md) |
| `public/geo/in/` | Map boundaries built from DataMeet by `npm run geo:build`; licences in its ATTRIBUTION.md |
| `scripts/scrapers/` | Source adapters (NHAI TIS, data.gov.in, Gazette, MCA); they write overlays for review, never the published files |
| `mcp-server/` | A local (stdio) MCP server over a clone's `data/`; contributions go to the site's `/api/contributions` |

## Running it

```bash
npm install             # also generates the data index
npm run dev             # http://localhost:3000/in
npm run data:validate   # every fact must cite a source it was read from
npm run build
```

There is no database. The site reads the published record in `data/` through a module generated at build time
(`npm run data:index`, run automatically by `dev`, `build` and `npm install`), so nothing reads the filesystem or a
database at request time. That is meant to let the same build run on Cloudflare Workers; not yet tested there.

To let the site open pull requests for contributions, set `GITHUB_CONTRIB_TOKEN` (contents and pull-request write
access to the repository). Without it, contributions are still checked and the contributor is told how to open the
pull request by hand.

## Licence

- **Code:** [MIT](LICENSE).
- **Data:** [Open Database License (ODbL) 1.0](LICENSE-DATA). You can use it for anything, including commercial use,
  with attribution. If you publish a changed copy of the database, it must also be ODbL. See
  [data/LICENSE.md](data/LICENSE.md). Cited source documents keep their own terms. Map boundaries keep DataMeet's
  licences (`public/geo/in/ATTRIBUTION.md`).
