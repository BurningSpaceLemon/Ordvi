# Ordvi offline language packs

These files are generated automatically by `tools/build_packs.py`.

Current architecture uses English as a hub:

- `en-de.json`
- `en-fr.json`
- `en-it.json`
- `en-ru.json`
- `en-zh.json`

The client builds a reverse index at runtime, so each file supports both
directions. For translations between two non-English languages Ordvi can pivot
through English when both relevant packs are installed.

Packs are downloaded only when a selected language pair needs them and are
stored in the browser Cache Storage under the current knowledge-base version.
The bundled Common Core remains available without downloading a pack.

See `THIRD_PARTY_NOTICES.md` for data licensing and attribution.
