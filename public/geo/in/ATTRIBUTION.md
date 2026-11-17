# Map boundaries: sources and licences

Built by `scripts/build-geo.mjs` (`npm run geo:build`) from the DataMeet India community's
[maps repository](https://github.com/datameet/maps), pinned to commit
`b3fbbde595310b397a55d718e0958ce249a4fa1f` (11 May 2022).

All four files are cut from **one set of polygons**, the Census 2011 districts, simplified once, so
a border shared by two layers is exactly the same line in both.

| File | How it is made | Source | Licence |
| :--- | :--- | :--- | :--- |
| `districts.geojson` | 640 districts as of Census 2011, simplified | `Districts/Census_2011/2011_Dist.shp` | CC BY 2.5 India |
| `states.geojson` | 36 states and union territories: the 2011 districts merged by the state each one is in today | same district file; `States/Admin2.shp` (CC BY 4.0) decides which state each district is in, supplies the state names, and supplies one line (see below) | CC BY 2.5 India, CC BY 4.0 |
| `india.geojson` | national outline: all of the above merged | same district file | CC BY 2.5 India |
| `labels.geojson` | one point inside each state and each district, with its area in km², for placing names | derived from the files above | as above |

Attribution: *India boundaries by the [DataMeet India community](http://datameet.org/).*

Notes:

- **Districts are 2011 boundaries.** Districts created since 2011 are not shown separately.
  `census2011Code` is the Census 2011 district code.
- **States are 2011 districts grouped by today's state, not today's state boundaries.** Each 2011
  district is placed whole in the state it lies in now (Hyderabad in Telangana, Leh and Kargil in
  Ladakh, the 2011 union territories of Dadra & Nagar Haveli and Daman & Diu in the merged one). Where a
  state line has moved *through* a 2011 district since then, the map does not show it:
  - **Andhra Pradesh / Telangana.** About 2,800 km² of the 2011 district of Khammam lies in Andhra
    Pradesh in DataMeet's current state polygons (this is presumably the transfer of mandals made when
    Telangana was formed in 2014; we have not checked it against the Act). Khammam is shown whole in
    Telangana, so against those polygons Telangana is drawn about 2.3% too large and Andhra Pradesh
    about 1.8% too small.
  - Small territories differ from DataMeet's state polygons by a few percent because the two files
    were digitised separately (Puducherry about 5% smaller, Chandigarh about 4% larger).
  - **Lakshadweep** is drawn in the district file as atolls with their lagoons and reefs (about
    600 km²), not as land only (about 30 km²). The `areaKm2` of its label reflects that.
- **The area where the Census was not taken.** The district file has a 641st polygon, "Data Not
  Available" (about 86,000 km², census code 0): the part of the former state of Jammu & Kashmir west
  and north of the districts that were enumerated. It is mostly the area under Pakistani
  administration (Muzaffarabad and Gilgit fall inside it); spot checks suggest it also takes in the
  Shaksgam valley north of the Karakoram and the Siachen glacier area, which we have not verified
  against another source. It is inside the boundary of India as the Survey of India draws it, so it is part
  of the national outline and of the states, but it is not a district and has no data. It lies partly
  in today's Jammu & Kashmir (about 14,300 km²) and partly in Ladakh (about 71,700 km²), so it is cut
  along the Jammu & Kashmir / Ladakh line of `States/Admin2.shp`. That is the only line on the map
  that does not come from the district file. Aksai Chin is not a separate polygon: the district
  file includes it in Leh.
- **The national outline is the Survey of India one.** Merging the district file reproduces
  DataMeet's `Country/india-soi.geojson` (the outline following the official boundary of India as per
  the Survey of India) to within 0.1 km² before simplification, so that file is no longer downloaded.
- **Simplified for the web** (6.5% of the original points kept, coordinates to 0.001°). Small islands
  and enclaves are kept but coarsened. The simplified outline differs from the unsimplified one by
  about 0.1% of the area each way, and its easternmost point is about 1.6 km short.
- **No basemap is used.** Third-party basemaps draw their own international borders, which could
  contradict this outline. The legal requirements for publishing maps of India are on the list for
  legal review (PLAN.md).
- These files are not part of the ODbL-licensed data.ftw database; they keep the licences above.
- To replace them with current boundaries, use the Survey of India's administrative boundary
  release (district and sub-district, keyed by LGD code) once downloaded, and update `build-geo.mjs`.
