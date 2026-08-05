# Emissary

A macOS-native browser and curation instrument for the
[radiometric-emissometers-db](https://github.com/jongablop/radiometric-emissometers-db)
dataset (Gabirondo-López, Arredondo & Igartua, UPV/EHU · Zenodo DOI
10.5281/zenodo.21762418 · CC-BY-4.0).

Built with Tauri 2 (Rust backend, dependency-free ES-module frontend). The
dataset's files remain the source of truth: the app reads `data/papers/*.json`
and `graph.json` directly — a bundled copy ships inside the app, and
**Open dataset…** points it at any live checkout.

## Views

- **Library** — searchable, faceted record list with λ/T micro-previews per row,
  plus a persistent inspector: instrument fingerprint, bibliography,
  raw → normalized method chips, in-corpus cites/cited-by (clickable),
  citation-count staleness, append-only changelog.
- **Capability plane** — every instrument as a rectangle in wavelength × temperature
  space, colored by measurement geometry (colorblind-validated palette).
  Records missing a range appear as strips on the matching axis; nothing is
  silently dropped.
- **Timeline** — instruments per year, stacked by geometry.
- **Atlas** — records per corresponding country.
- **Health** — live data-quality tiles (incomplete ranges, missing geometry,
  encoding damage, vocabulary size); click a tile to open the offending records.
- **Vocabulary** — raw method strings grouped by collapsed key so case variants
  and typos surface together (the Phase 2 mapping queue).
- **⌘K** — command palette: jump to any record or view.

## Develop

```sh
npx @tauri-apps/cli dev      # run against src/ (no bundler, no node_modules)
```

## Build

```sh
npx @tauri-apps/cli build    # → src-tauri/target/release/bundle/{macos,dmg}/
```

## Layout

```
src/            frontend (index.html, style.css, main.js — plain ES modules)
src-tauri/      Rust backend: load_dataset command, bundled dataset resource
website/        landing page (self-contained, includes the live demo)
```

## Authorship, ownership & license

Conceived jointly by **Jon Gabirondo-López** (corpus compilation, sorting, and
manual inspection of every article) and **Josu M. Igartua** (creator of the
app) — the database's intellectual authors and maintainers, with instrument
measurement data planned as the next layer. Compilation and app are owned by
the **Thermophysical Properties of Materials Research Group** (UPV/EHU), also
owner of the HAIRL emissometer. App: [MIT](LICENSE) · dataset: CC-BY-4.0.
See [AUTHORS.md](AUTHORS.md) and [CITATION.cff](CITATION.cff).

## Roadmap

Phase 1 (this app): read-only reader over the canonical dataset.
Phase 2: schema-validated editing, changelog automation, git integration,
vocabulary mapping workbench, DOI intake. Phase 3: FER-format measurement
spectra (SiC first), EKHI cross-linking. See `../DESIGN_PROPOSAL.md`.
