# Changelog

## 0.5.0 — 2026-09-30

### Added
- Five on-demand PanLex offline packs for EN↔DE/FR/IT/RU/ZH.
- 90,000 compact translation pairs across roughly 49,800 English source keys.
- Automatic reverse indexes, so every hub pack works in both directions.
- Offline pivot translation between two non-English languages through English.
- Prefix autocomplete from loaded language packs.
- Offline language detection from loaded pack vocabulary.
- Automatic pack builder using PanLex CC0 data and open FrequencyWords rankings.

### Changed
- Packs are fetched only for the selected/detected language pair and cached separately from the app shell.
- Existing Common Core and learned local vocabulary stay higher-priority than broad PanLex pack results.

## 0.4.0 — 2026-09-30

### Added
- New Ordvi translation icon as the 512 px master asset.
- Automatic GitHub Action to regenerate 192 px, Apple Touch and maskable PWA icons.
- Expanded Common Core from 154 to 303 concepts across six languages (1,818 language entries).

### Changed
- Pressing Enter now translates immediately.
- Shift+Enter remains available for multi-line input.

## 0.3.0 — 2026-09-30

### Added
- Version-aware PWA update flow with visible update prompt.
- Build-specific service-worker caches and automatic cleanup of old Ordvi caches.
- Ordvi Common Core with 154 curated concepts across German, English, French, Italian, Russian and Simplified Chinese (924 language entries).
- Learned local single-word knowledge base for instant repeat/offline lookups.
- Lazy word details with cached Tatoeba usage examples and English dictionary definitions.

### Changed
- Translation results render before dictionary/detail enrichment.
- Unknown online translations race available providers within short time budgets.
- Navigation requests prefer fresh network content when online.
- Lexicon index now supports identical spellings in multiple source languages.

### Fixed
- Tapping a result without preloaded details now opens a real detail panel and attempts to load examples.
- Common words such as “Hotel”, “Bus” and “Restaurant” no longer overwrite each other in the multilingual index.

## 0.2.0 — 2026-09-30
- Initial mobile-first translation PWA with local cache, history, autocomplete and offline app shell.
