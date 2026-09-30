# Ordvi

A small mobile-first translation PWA focused on fast word lookup, translation variants and examples without accounts or tracking.

https://burningspacelemon.github.io/Ordvi/

## Features

- Languages: German, English, French, Italian, Russian and Simplified Chinese
- Automatic language detection with manual override
- Prefix autocomplete from the bundled + learned offline lexicon
- Rich word results with multiple translations and parts of speech
- Click/tap results for definitions and usage examples
- Sentence translation with alternative matches when available
- Enter translates immediately; Shift+Enter inserts a new line
- One-tap copy
- Local history and translation cache
- PWA install support and offline app shell
- No user account and no analytics

## Translation strategy

1. Bundled Ordvi Common Core: 303 curated concepts across all 6 languages (1,818 language entries) for instant first-use lookup.
2. Optional PanLex offline packs: EN↔DE/FR/IT/RU/ZH with 90,000 compact translation pairs in ~1.6 MB total. Packs load automatically only when needed and remain cached for offline use.
3. Non-English pairs can translate offline through English as a pivot when both relevant packs are installed.
4. Custom lexicon for nuanced translations and examples.
5. Learned local knowledge base: online single-word results are stored on-device and become instant/offline afterwards.
6. Translation cache for previously translated words and sentences.
7. Chrome Translator API and MyMemory race within short time budgets for unknown online content.
8. Usage details load only after tapping a result; Tatoeba examples and English dictionary definitions are cached locally.

Public free APIs can rate-limit or change availability. For production/high traffic, replace the fallback in `app.js` with a self-hosted LibreTranslate/Argos endpoint or another provider.

## Run locally

Because service workers require HTTP(S), serve the directory instead of opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Versioning and updates

Release metadata lives in `version.js`.

- `ORDVI_VERSION`: semantic app version, e.g. `0.3.0`.
- `ORDVI_BUILD`: unique build identifier for every deployed asset change.
- `ORDVI_KB_VERSION`: version of the bundled core and optional offline pack cache.

The service worker uses version + build as its cache key. New releases install into a fresh cache and show an **Update verfügbar** button in the app. The new worker becomes active only after the user accepts the update, then Ordvi reloads once with the new assets. Old Ordvi shell caches are deleted automatically.

For every release that changes cached files, bump at least `ORDVI_BUILD`. Bump `ORDVI_VERSION` for user-visible feature/fix releases.

## Deploy

The project is static and can be deployed directly to GitHub Pages, Cloudflare Pages, Netlify or any static host. No app build step is required. The included GitHub Action regenerates the smaller PWA icon assets whenever `icons/icon-512.png` changes.

## License

MIT for the app code. External APIs and translation data remain subject to their own terms.
