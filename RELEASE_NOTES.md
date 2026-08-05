# Release Notes

## 0.6.1 — 2026-08-05

- Sidebar banner above the dataset section: app version and a © line whose
  hover popup carries the full ownership/licensing statement (TPMR Group ·
  UPV/EHU, MIT app / CC-BY-4.0 dataset, authors); clicking it opens Help.


## 0.6.0 — 2026-08-05

### Added

- **Precision atlas** — Natural Earth 10m map units, Douglas-Peucker
  simplified (~1 km tolerance, 200k vertices, 3.3 MB bundled): coastlines and
  borders remain true at the new 120× zoom, down to city scale.
- **Label hygiene** — city labels cull collisions greedily (largest count
  first) and flip anchor at the map edge; no more labels drifting over the
  wrong country.
- **Interactive country bars** — hover any bar for the full list
  (instruments · records · groups, ↩ marking updates of an earlier record);
  click to open those records in the Library under a dismissable country
  filter, integrated with back/forward history. From each record, Open
  paper ↗ reaches the DOI.


## 0.5.0 — 2026-08-05

### Changed — counts mean instruments now

- **Atlas counts instruments, not records.** Country shading, bars
  (instruments / records), and location-dot labels collapse lineage-linked
  records: Spain 5 records → **4 instruments** (the HAIRL counted once),
  China 53 → 48. Tooltips carry all three honest tiers:
  **instruments · records · research groups**.
- **Research-group tier** (same city + ≥2 shared author surnames): globally
  139 records → ≤128 lineage instruments → **99 group clusters**. China: 23
  groups for 53 records — Xinxiang's 18 records all belong to one group.
  The true instrument count lies between the two bounds; resolving it is
  curation (the planned instrument_key). Health shows both numbers.

### Added

- **High-resolution map** — Natural Earth 50m map units (2-decimal
  precision): coastlines and borders remain true at 40× zoom, so the
  location dots sit on recognizable geography.
- **Sidebar icons** (as in the original design), with a Settings option:
  icons · labels · both.


## 0.4.0 — 2026-08-05

### Changed — records vs instruments, made explicit

The dataset counts *publications* (new instruments **or substantial
modifications** — its own scope statement), not distinct emissometers. The
canonical example: the HAIRL at UPV/EHU Leioa is one emissometer with two
records (its 2006 instrument paper and its 2020 uncertainty-budget update).
The app now says so:

- Map and dot tooltips say **records**, and country tooltips list them.
- **Instrument lineage** in the inspector: a record citing an earlier
  in-corpus record from the same affiliation city is flagged as a likely
  update ("Updates / Updated by" chips, both directions).
- **Health** estimates distinct instruments: **≤128 of 139** — 6 same-city
  citation lineages cover 17 records (Braunschweig/PTB ×5 and ×2, Xinxiang ×4,
  Harbin ×2, Nanjing ×2, Leioa ×2). Clicking the tile opens all 17 for review.
  A conservative upper bound: true instrument identity needs curation
  (the planned Phase 2 instrument_key).

### Added

- Map zoom extended to 40×; city · record-count labels appear beyond 5×,
  showing the actual instrument locations when zoomed in.
- BibTeX escapes in names/titles now render as unicode ("Ballestr{\'\i}n" →
  Ballestrín). Note: one source record truncates that very name mid-escape —
  now caught by the Health name-damage scanner (extended to TeX remnants).


## 0.3.1 — 2026-08-05

### Fixed

- **French Guiana no longer shaded as France.** The map now uses Natural Earth
  110m *map units* instead of admin-0 countries, which separates overseas
  territories from their metropole — a choropleth must not paint a territory
  with data that belongs 7000 km away. France keeps only the metropole and
  Corsica; French Guiana renders as its own (data-less) unit.


## 0.3.0 — 2026-08-04

### Added

- **Zoomable Atlas with instrument locations** — country outlines now clearly
  visible; scroll-to-zoom toward the cursor, drag-to-pan, double-click or ⤢ to
  reset (+/− buttons too). The 66 instrument locations (corresponding-author
  affiliation cities, geocoded once via OpenStreetMap Nominatim and bundled —
  no network at runtime) are plotted as dots sized by record count; hover for
  the instruments there, click to open them in the Library with the city
  pre-filled in search.
- **Navigation history** — ‹ › toolbar buttons and ⌘[ / ⌘] walk back/forward
  through every place you've been (view + selected record + active filter),
  browser-style: new navigation clears the forward stack.
- Search now also matches affiliation cities.

### Verified

- 12-assertion in-DOM self-test: dot count and click-through with search
  prefill, zoom in/reset via buttons, back/forward via buttons and keyboard.


## 0.2.0 — 2026-08-04

### Added

- **Atlas world map** — choropleth of records per corresponding country
  (Natural Earth 110m outlines bundled, no network; √ scale; violet sequential
  ramp kept deliberately outside the categorical geometry palette). Hover a
  country for its instrument families; click to open its records in the
  Library. Count bars remain below the map.
- **Technical tooltips** — hover tooltips now carry the physics: IR band names
  (NIR / SWIR / MWIR / LWIR / FIR), the Wien-displacement peak for the
  instrument's temperature range (λ_max = 2898 µm·K / T) with an *in band ✓ /
  outside band ✗* verdict against its spectral range, optional wavenumbers
  (cm⁻¹, FTIR convention), detection methods and temperature metrology.
- **Settings** (⌘,) — theme override (system/light/dark), temperature unit
  (K/°C, applied everywhere including fingerprint axes), wavenumbers, Wien
  check, tooltip verbosity, fingerprint corpus-shadow, and view-on-launch.
  Stored locally, applied immediately.

### Verified

- 14-assertion in-DOM self-test: map rendering, country click-through to
  Library, tooltip physics content, Celsius relabeling, settings persistence,
  theme stamping, wavenumber toggle.


## 0.1.0 — 2026-08-04

First release: the read-only reader (Phase 1 of the design in
`DESIGN_PROPOSAL.md`).

### Added

- **Library** — searchable, faceted list of all 139 records with per-row λ/T
  micro-previews against the corpus width.
- **Inspector** — instrument fingerprint (capability spans over corpus-coverage
  shadow + geometry glyph), bibliography, citation freshness tag, raw →
  normalized method chips, clickable in-corpus cites/cited-by, append-only
  changelog, Open-paper-by-DOI.
- **Capability plane** — wavelength × temperature rectangles for the whole
  corpus, colorblind-validated geometry palette, partial records as axis
  strips, per-mark tooltips, click-to-inspect, class toggles.
- **Timeline** — instruments per year stacked by geometry, 1917–2026.
- **Atlas** — records per corresponding country.
- **Health** — live data-quality tiles (incomplete ranges, missing geometry,
  encoding damage, vocabulary size, citation edges); tiles open filtered views.
- **Vocabulary** — raw method strings grouped by collapsed key: the Phase 2
  normalization queue.
- **⌘K command palette**, ⌘1–⌘6 view switching, tooltips throughout, in-app
  Help/manual, native light/dark.
- **Dataset handling** — full dataset bundled in the app; **Open dataset…**
  points at any live checkout (repo root, `data/`, or `data/papers/`); stale
  paths fall back to the bundled copy.

### Known limitations

- Read-only: editing, changelog automation, git integration, vocabulary
  mapping, and DOI intake are Phase 2.
- Citation graph view not yet implemented (data is loaded; UI pending).
- Measurement spectra (SiC / FER / EKHI) are Phase 3.
- Unsigned build: on first launch, right-click → Open, or clear the quarantine
  flag (`xattr -dr com.apple.quarantine /Applications/Emissary.app`).
