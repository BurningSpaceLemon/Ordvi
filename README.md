# Ordvi

A small mobile-first translation PWA focused on fast word lookup, translation variants and examples without accounts or tracking.

## Features

- Languages: German, English, French, Italian, Russian and Simplified Chinese
- Automatic language detection with manual override
- Prefix autocomplete from a local offline lexicon
- Rich word results with multiple translations and parts of speech
- Click/tap results for definitions and usage examples
- Sentence translation with alternative matches when available
- One-tap copy
- Local history and translation cache
- PWA install support and offline app shell
- No user account and no analytics

## Translation strategy

1. Local lexicon for instant offline results.
2. Chrome Translator / Language Detector APIs when available on the device.
3. MyMemory public API as the keyless online fallback.
4. Free Dictionary API enriches English word results with parts of speech and definitions.
5. Previously loaded translations remain available from local storage when offline.

Public free APIs can rate-limit or change availability. For production/high traffic, replace the fallback in `app.js` with a self-hosted LibreTranslate/Argos endpoint or another provider.

## Run locally

Because service workers require HTTP(S), serve the directory instead of opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

The project is static and can be deployed directly to GitHub Pages, Cloudflare Pages, Netlify or any static host. No build step is required.

## License

MIT for the app code. External APIs and translation data remain subject to their own terms.
