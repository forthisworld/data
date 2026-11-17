# Contributing to data.ftw

data.ftw is an open atlas of public money in India: who built what, what it cost, who sanctioned it and what it
earned, with every fact linked to its source. There are four ways to help, and you don't need to write code for
three of them.

| | You have | You do |
| :--- | :--- | :--- |
| [Add or correct data](#1-add-or-correct-data) | a document that proves a fact | send a sourced change; it becomes a pull request |
| [File an RTI](#2-file-an-rti-and-share-the-reply) | a question the government can answer | file it, then share the reply |
| [Improve the code](#3-improve-the-code) | time and a laptop | pick an issue, open a pull request |
| [Fund the work](#4-fund-the-work) | money | not open yet; see below |

Every change is reviewed by a person before it is published. By contributing you agree that your data
contributions are published under the [ODbL](LICENSE-DATA) and your code under the [MIT licence](LICENSE).

---

## 1. Add or correct data

The record only holds facts we can cite. Read **[data/SOURCING.md](data/SOURCING.md)** first; in short:

- Every number has a source (`sourceId`) and a grade (`basis`): court finding, audit finding, official record,
  company filing, press report, or a named person's claim. Claims and press reports are shown with attribution and
  never used in calculations.
- Every source has its original URL and the date you read it (`retrievedAt`). Read it before you cite it.
- Allegations about named people need a primary source, or are recorded as someone's claim.

Three ways to send a change, all ending in a pull request against the **`data`** branch:

1. **Through your AI assistant.** Connect it to data.ftw (see the site's *Use with AI* page, `/connect`) and ask it
   to submit a contribution. The `submit_contribution` tool checks your change against the sourcing rules and, if it
   passes, opens the pull request for you.
2. **On GitHub.** Edit the JSON under `data/in/` (toll roads are `data/in/toll-roads/<slug>.json`), then open a pull
   request against `data`. To add a toll road, copy an existing file and fill in only what you can cite; put unknowns
   in `analysis.openQuestions`.
3. **Not sure how?** Open an issue with the document link and what it shows; a maintainer will turn it into a change.

Before opening a PR from a clone, run `npm run data:validate`. It fails if any fact lacks a source.

## 2. File an RTI and share the reply

The Right to Information Act, 2005 lets anyone ask a public authority for records. Most of the gaps in the record
(year-by-year toll collected, audited project costs, concession agreements) are answerable this way.

1. Pick a gap: every toll road page lists its open questions with a ready-made RTI draft, and the RTI page lists
   our current targets.
2. File it: central authorities at [rtionline.gov.in](https://rtionline.gov.in); state authorities usually by post
   to the Public Information Officer with the prescribed fee.
3. When the reply comes, share it: open a pull request (or ask your AI assistant to) that adds the reply as a source
   of type `rti_response`, with the authority, the RTI registration number and the date, and attach the scanned
   reply to the PR. Redact your personal details (address, phone, signature) before sharing.

## 3. Improve the code

The site is Next.js with MapLibre for the atlas; the published record is JSON in `data/`, bundled at build time.

```bash
npm install          # also generates the data index
npm run dev          # http://localhost:3000/in
npm run typecheck
npm run data:validate
npm run build
```

- Map boundaries are built from DataMeet's open data by `npm run geo:build`; toll roads are drawn from OpenStreetMap
  by `npm run geo:routes` (to draw a new road, add its OSM ways to `scripts/routes.json`). See
  `public/geo/in/ATTRIBUTION.md`.
- The atlas is `src/components/atlas/`: `Atlas.tsx` (map, search, URL state), `PanelViews.tsx` (what the panel shows),
  `Sheet.tsx` (side panel / phone drawer). Colours are the `--ftw-*` tokens in `src/app/globals.css` (light and dark).
- The MCP endpoint is `src/app/api/mcp`; a local stdio server lives in `mcp-server/` (`cd mcp-server && npm install
  && npx tsc`, then run `node dist/index.js`; set `FTW_SITE_URL` to send contributions).
- Contributions open pull requests through `src/lib/contrib/contribute.ts`; the server needs `GITHUB_CONTRIB_TOKEN`.

**Branches.** Until the site is live, everything goes to `main`. After launch: `develop` for code, `data` for data,
`main` for the live site (a merge to `main` deploys). Open code PRs against `develop` and data PRs against `data`.

Keep pull requests small and say what you checked. Don't add a number to the UI that isn't in `data/` with a source.

## 4. Fund the work

Filing RTIs, buying company filings from the MCA portal and running the site cost a little money. We don't accept
donations yet: we want a channel where every rupee in and out is public before we take any. Until then, the most
useful thing you can fund is your own RTI on one of our open questions, and share the reply (section 2).

---

Questions: open an issue on [github.com/forthisworld/data](https://github.com/forthisworld/data/issues).
