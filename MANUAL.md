# Emissary — User Manual

*Version 0.2.0 · also available inside the app under **Help***

Emissary is a macOS-native reader and curation instrument for the
[radiometric-emissometers-db](https://github.com/jongablop/radiometric-emissometers-db)
dataset: 139 published radiometric emissometer designs (1917–2026), one JSON
record per paper. The dataset's files remain the source of truth — the app never
hides them behind a private format.

## Getting started

The app opens on the **Library** with a bundled copy of the dataset. To work
against a live checkout (e.g. to see your own edits), press **Open dataset…**
in the sidebar and pick the repo folder — the repo root, its `data/` folder, or
`data/papers/` all work. The choice is remembered; if the folder disappears the
app falls back to the bundled copy.

## The Library

- **Rows.** Each record shows first-author + year, venue, title, and two
  micro-bars: the instrument's spectral span (top, log scale 0.2–1000 µm) and
  temperature span (bottom, 0–3100 K), drawn against the full corpus width. The
  colored dot is the measurement geometry; a dashed ring means the paper doesn't
  state it.
- **Search** matches title, authors, venue, methods, and country.
- **Facets** (sidebar): geometry and family chips are additive toggles.
  Filters never recolor marks — color always follows the geometry class.
- **Sort** by year, citations, or author.

## The Inspector (right panel)

The whole record in one column:

1. **Fingerprint** — both capability spans plotted over a gray *corpus-coverage
   shadow* (how many of the 139 instruments cover each wavelength /
   temperature), plus a geometry glyph: single arrow = normal, fan =
   directional, dome = hemispherical.
2. **Bibliography** — authors, venue, spectral flag.
3. **Citations** — Scopus total with a freshness tag. *Stale* means the count
   was last refreshed before the record's own last edit.
4. **Open paper ↗** — opens `https://doi.org/<doi>` in your browser.
5. **Methods, raw → normalized** — dashed chips are the strings exactly as
   published (including typos — they are data); the solid chip is the
   normalized instrument family.
6. **In-corpus citations** — cites / cited-by chips that jump to those records.
7. **History** — the record's append-only changelog.

## Capability plane

Every instrument as a rectangle in wavelength × temperature space, colored by
geometry (colorblind-validated palette). The crowded 2–20 µm / 300–1500 K block
is where the field lives; the empty regions are the research gaps. Records
missing one range are drawn as strips along the matching axis; the top-right
caption counts every group — nothing is silently dropped. Click a mark to
inspect it; toggle classes in the legend.

## Timeline · Atlas

One column per year stacked by geometry (hover for the year's records). The
Atlas is a world map — countries shaded by records per corresponding country
(√ scale), bundled Natural Earth outlines, no network needed. Hover a country
for its instrument-family breakdown; click it to open its records in the
Library. The exact count bars sit below the map.

## Health

Live data-quality tiles computed from the loaded dataset: incomplete ranges,
missing geometry, encoding-damaged author names, vocabulary size, citation-graph
edges. Amber/red tiles are clickable — they open the offending records as a
filtered Library view; dismiss with the ✕ chip in the sidebar.

## Vocabulary

All raw method strings (detection, temperature measurement, temperature
control) grouped by collapsed key so case variants and typos surface together
("electic heater" beside "electric heater"). This is the normalization queue
that Phase 2's mapping workbench will consume.

## Keyboard

| Keys | Action |
|---|---|
| ⌘K | Command palette — jump to any record or view |
| ⌘1 … ⌘6 | Library · Plane · Timeline · Atlas · Health · Vocabulary |
| ⌘, | Settings |
| ↑ ↓ ⏎ / Esc | Navigate / close the palette |

## Settings (⌘,)

Theme (system / light / dark), temperature unit (Kelvin / Celsius — applied to
tooltips and fingerprint axes alike), wavenumbers (show spectral ranges also in
cm⁻¹), the Wien-peak check, tooltip verbosity, the fingerprint corpus-shadow,
and the view that opens on launch. Stored locally; applied immediately.

## Tooltip physics

Hover tooltips name the covered IR bands (NIR 0.7–1.4 µm, SWIR 1.4–3 µm, MWIR
3–8 µm, LWIR 8–15 µm, FIR beyond), and state the blackbody emission peak for
the instrument's temperature range via Wien's displacement law
(λ_max = 2898 µm·K / T) together with whether that peak falls inside the
instrument's spectral band — a one-glance sanity check of the design.

## Data semantics worth knowing

- **Geometry**: `normal` (single angle near 0°), `directional`
  (angle-scanning), `hemispherical` (integrated). Unspecified = the paper
  doesn't say.
- **Spectral = no** means a *total* (wavelength-integrated) measurement — such
  records legitimately have no spectral range.
- Raw method strings are never destroyed or corrected in place; normalization
  is a mapping layered on top (Phase 2).
