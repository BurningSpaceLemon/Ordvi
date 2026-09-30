/* Ordvi optional offline language packs.
 * PanLex-based packs are fetched only when needed, cached by KB version, and
 * indexed in memory for instant word lookup during the current session.
 */
(() => {
  const VERSION = globalThis.ORDVI_KB_VERSION || "dev";
  const CACHE_NAME = `ordvi-packs-${VERSION}`;
  const SUPPORTED = new Set(["de", "fr", "it", "ru", "zh"]);
  const memory = new Map();
  const loading = new Map();

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
  }

  function packLanguage(code) {
    return SUPPORTED.has(code) ? code : null;
  }

  function requiredForPair(source, target) {
    const result = [];
    for (const code of [source, target]) {
      const lang = packLanguage(code);
      if (lang && !result.includes(lang)) result.push(lang);
    }
    return result;
  }

  async function cleanupOldCaches() {
    if (!("caches" in globalThis)) return;
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("ordvi-packs-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
  }

  function addUnique(map, key, value, limit = 8) {
    const bucket = map.get(key) || [];
    if (!bucket.some(item => normalize(item) === normalize(value)) && bucket.length < limit) {
      bucket.push(value);
      map.set(key, bucket);
    }
  }

  function lowerBound(items, query) {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].key < query) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function prefixMatches(items, query, limit = 7) {
    if (!query) return [];
    const out = [];
    for (let i = lowerBound(items, query); i < items.length && out.length < limit; i++) {
      if (!items[i].key.startsWith(query)) break;
      out.push(items[i]);
    }
    return out;
  }

  function indexPack(data) {
    const forward = new Map();
    const reverse = new Map();
    const forwardDisplay = new Map();
    const reverseDisplay = new Map();

    for (const row of data.entries || []) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const source = row[0];
      const targets = Array.isArray(row[1]) ? row[1] : [];
      const sk = normalize(source);
      if (!sk) continue;

      forwardDisplay.set(sk, source);
      for (const target of targets) {
        const tk = normalize(target);
        if (!tk) continue;
        addUnique(forward, sk, target, 6);
        addUnique(reverse, tk, source, 6);
        if (!reverseDisplay.has(tk)) reverseDisplay.set(tk, target);
      }
    }

    const forwardTerms = [...forwardDisplay].map(([key, text]) => ({ key, text })).sort((a,b) => a.key.localeCompare(b.key));
    const reverseTerms = [...reverseDisplay].map(([key, text]) => ({ key, text })).sort((a,b) => a.key.localeCompare(b.key));

    return {
      target: data.target,
      forward,
      reverse,
      forwardTerms,
      reverseTerms,
      stats: data.stats || {},
      version: data.v || "",
      license: data.license || ""
    };
  }

  async function load(language) {
    const lang = packLanguage(language);
    if (!lang) return null;
    if (memory.has(lang)) return memory.get(lang);
    if (loading.has(lang)) return loading.get(lang);

    const promise = (async () => {
      const url = new URL(`./packs/en-${lang}.json?v=${encodeURIComponent(VERSION)}`, location.href);
      let response = null;

      if ("caches" in globalThis) {
        const cache = await caches.open(CACHE_NAME);
        response = await cache.match(url.toString());
        if (!response && navigator.onLine) {
          const fresh = await fetch(url.toString(), { cache: "no-store" });
          if (fresh.ok) {
            await cache.put(url.toString(), fresh.clone());
            response = fresh;
          }
        }
      } else if (navigator.onLine) {
        response = await fetch(url.toString(), { cache: "force-cache" });
      }

      if (!response?.ok) return null;
      const data = await response.json();
      const indexed = indexPack(data);
      memory.set(lang, indexed);
      return indexed;
    })().finally(() => loading.delete(lang));

    loading.set(lang, promise);
    return promise;
  }

  async function ensurePair(source, target) {
    const langs = requiredForPair(source, target);
    if (!langs.length) return [];
    return Promise.all(langs.map(load));
  }

  function resultFrom(values, provider = "Offline-Sprachpaket") {
    const unique = [...new Map(values.filter(Boolean).map(value => [normalize(value), value])).values()].slice(0, 6);
    if (!unique.length) return null;
    return {
      provider,
      variants: unique.map((text, index) => ({
        text,
        label: index === 0 ? "Offline-Paket" : `Alternative ${index + 1}`,
        pos: "",
        note: "PanLex-Wortschatz"
      }))
    };
  }

  function lookupSync(text, source, target) {
    const key = normalize(text);
    if (!key || source === target) return null;

    if (source === "en" && SUPPORTED.has(target)) {
      return resultFrom(memory.get(target)?.forward.get(key) || []);
    }

    if (target === "en" && SUPPORTED.has(source)) {
      return resultFrom(memory.get(source)?.reverse.get(key) || []);
    }

    if (SUPPORTED.has(source) && SUPPORTED.has(target)) {
      const sourcePack = memory.get(source);
      const targetPack = memory.get(target);
      if (!sourcePack || !targetPack) return null;
      const englishPivots = sourcePack.reverse.get(key) || [];
      const translated = [];
      for (const english of englishPivots) {
        const values = targetPack.forward.get(normalize(english)) || [];
        translated.push(...values);
        if (translated.length >= 8) break;
      }
      return resultFrom(translated, "Offline-Sprachpaket · via Englisch");
    }

    return null;
  }

  async function lookup(text, source, target) {
    await ensurePair(source, target);
    return lookupSync(text, source, target);
  }

  function suggestSync(query, sourceHint = "auto", limit = 7) {
    const q = normalize(query);
    if (!q) return [];
    const results = [];
    const seen = new Set();

    const push = (text, lang) => {
      const id = `${lang}:${normalize(text)}`;
      if (!text || seen.has(id) || results.length >= limit) return;
      seen.add(id);
      results.push({ text, lang });
    };

    if (sourceHint === "en") {
      for (const pack of memory.values()) {
        for (const item of prefixMatches(pack.forwardTerms, q, limit)) push(item.text, "en");
        if (results.length >= limit) break;
      }
      return results;
    }

    if (SUPPORTED.has(sourceHint)) {
      const pack = memory.get(sourceHint);
      if (!pack) return [];
      prefixMatches(pack.reverseTerms, q, limit).forEach(item => push(item.text, sourceHint));
      return results;
    }

    for (const [lang, pack] of memory) {
      prefixMatches(pack.reverseTerms, q, limit).forEach(item => push(item.text, lang));
      if (results.length >= limit) break;
    }
    if (results.length < limit) {
      for (const pack of memory.values()) {
        prefixMatches(pack.forwardTerms, q, limit).forEach(item => push(item.text, "en"));
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  function detectSync(text) {
    const key = normalize(text);
    if (!key) return null;
    const matches = new Set();
    for (const [lang, pack] of memory) {
      if (pack.reverse.has(key)) matches.add(lang);
      if (pack.forward.has(key)) matches.add("en");
    }
    return matches.size === 1 ? [...matches][0] : null;
  }

  function loadedLanguages() {
    return [...memory.keys()];
  }

  function stats() {
    const out = {};
    for (const [lang, pack] of memory) out[lang] = pack.stats;
    return out;
  }

  cleanupOldCaches().catch(() => {});

  globalThis.ORDVI_PACKS = {
    load,
    ensurePair,
    lookup,
    lookupSync,
    suggestSync,
    detectSync,
    loadedLanguages,
    stats,
    supported: [...SUPPORTED]
  };
})();
