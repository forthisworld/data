# Sourcing standard

The published record (`data/<country>/`) only holds facts we can cite. Nothing is published on memory or "common
knowledge".

## Rules

1. **Every record has sources.** Toll roads use `sources[]`. Every other entity also uses `sources[]`, with at least
   one source to be published.
2. **Every number points to its source** (`sourceId`) and says how firmly it is established (`basis`):

   | basis | Meaning | Used in calculations |
   | :--- | :--- | :--- |
   | `court_finding` | Stated as a finding by a court | yes |
   | `audit_finding` | CAG or another statutory auditor | yes |
   | `official_record` | Gazette, census, legislature, government record | yes |
   | `company_filing` | The company's own audited or legal disclosure | yes |
   | `reported` | Press report not yet confirmed by a primary source | no, shown with attribution |
   | `claim` | Asserted by a named party (politician, company, litigant) | no, shown as a claim |

3. **What a litigant argued is not a finding.** A party's submission quoted in a judgment is a `claim` by that
   party.
4. **Claims about named people need a primary source** (an order, a gazette notice, a filing, an official page) or
   a dated report from an established outlet. Allegations are recorded as `claims[]`, with who made them and when.
5. **The original URL always comes first.** `archiveUrl` (our R2 copy) and `sha256` are added once the archive is
   live. Record `retrievedAt` when you check a source, and `locator` (paragraph or page) where possible.
6. **Unknowns are questions, not guesses.** Put them in `analysis.openQuestions`; they become RTI targets.
7. **Analysis cites too.** Each `reasonsStillTolled` point lists the `sourceIds` it rests on.

Run `npx tsx scripts/scrapers/run-toll-roads.ts --validate` before every PR. It enforces rules 1, 2, 5 and 7.

## Backlog: removed on 17 Nov 2026 until sourced

These were in the seed data without sources, and some were wrong. Re-add each one only with a citation.

- **Infrastructure:** NH 48, Mumbai-Pune Expressway, Delhi-Mumbai Expressway, Chennai Metro, Namma Metro, JNPT,
  Delhi IGI Airport, Bharatmala Pariyojana. All costs were stored in crore but labelled as rupees.
- **People:**
  - Former CMs Mamata Banerjee, M.K. Stalin and Pinarayi Vijayan: their governments were replaced in May 2026.
  - Mukesh Ambani and Gautam Adani: net worth had no source.
  - Ratan Tata: died in October 2024.
- **India overview:** GDP, Union Budget, national highway km, toll plaza count, the number of states and UTs, and
  Lok Sabha and Rajya Sabha strength. Infrastructure highlights from Budget 2024-25.
- **Maharashtra overview:** GSDP, area, district count, Lok Sabha and Vidhan Sabha seats, highway km; the Samruddhi
  and Metro highlights.
- **States:** areas (not in the Census PCA table; source from the Census A-1 table or Survey of India), and
  Telangana's population (formed in 2014; source from the Telangana government).
- **RTI tracker:** four example requests and their totals were invented (the platform had filed none). They were
  replaced with real targets from the NICE open questions.
- **DND Flyway:** length (9.2 km) and the equity/debt split had no source; the old file also wrongly said tolling
  continued.
- **NICE:** lengths, toll rates, plaza list, traffic (8 lakh vehicles/day) and the funding split had no primary
  source.
- **Toll road CINs:** confirm on the MCA portal before re-adding.
