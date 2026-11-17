# Map boundaries: sources and licences

Built by `scripts/build-geo.mjs` (`npm run geo:build`) from the DataMeet India community's
[maps repository](https://github.com/datameet/maps), pinned to commit
`b3fbbde595310b397a55d718e0958ce249a4fa1f` (11 May 2022). Simplified for the web; the
geometry is not otherwise changed.

| File | Source | Licence |
| :--- | :--- | :--- |
| `india.geojson` | `Country/india-soi.geojson`: national outline dissolved from the Survey of India / Census 2011 boundaries, following the official boundary of India | CC BY-SA 2.5 / ODbL |
| `states.geojson` | `States/Admin2.shp`: 36 states and union territories | CC BY 4.0 |
| `districts.geojson` | `Districts/Census_2011/2011_Dist.shp`: 641 districts as of Census 2011 | CC BY 2.5 India |

Attribution: *India boundaries by the [DataMeet India community](http://datameet.org/).*

Notes:

- **Districts are 2011 boundaries.** Districts created since 2011 are not shown separately. Each 2011
  district is assigned to its current state by location (so Hyderabad is in Telangana, Leh in Ladakh).
  `census2011Code` is the Census 2011 district code.
- **No basemap is used.** Third-party basemaps draw their own international borders, which may not
  follow the Survey of India boundary that maps published in India are required to show.
- These files are not part of the ODbL-licensed data.ftw database; they keep the licences above.
- To replace them with current boundaries, use the Survey of India's administrative boundary
  release (district and sub-district, keyed by LGD code) once downloaded, and update `build-geo.mjs`.
