# Release Notes

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
