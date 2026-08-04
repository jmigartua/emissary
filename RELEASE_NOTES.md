# Release Notes

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
