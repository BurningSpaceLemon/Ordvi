(() => {
  "use strict";

  const LANGUAGES = {
    auto: { label: "Auto", short: "AUTO" },
    de: { label: "Deutsch", short: "DE" },
    en: { label: "Englisch", short: "EN" },
    fr: { label: "Französisch", short: "FR" },
    it: { label: "Italienisch", short: "IT" },
    ru: { label: "Russisch", short: "RU" },
    zh: { label: "Chinesisch", short: "ZH" }
  };

  const STORAGE = {
    settings: "ordvi.settings.v1",
    history: "ordvi.history.v1",
    cache: "ordvi.cache.v1"
  };

  const STOPWORDS = {
    de: ["der","die","das","und","ist","ich","wir","mit","für","nicht","eine","einen","sich","zu","von","auf","im","den"],
    en: ["the","and","is","i","we","with","for","not","a","an","to","of","on","in","this","that"],
    fr: ["le","la","les","et","est","je","nous","avec","pour","pas","un","une","de","des","dans","ce"],
    it: ["il","lo","la","gli","le","e","è","io","noi","con","per","non","un","una","di","nel","questo"]
  };

  const lexicon = Array.isArray(window.ORDVI_LEXICON) ? window.ORDVI_LEXICON : [];
  const byTerm = buildLexiconIndex(lexicon);

  const els = {
    sourceLanguage: document.getElementById("sourceLanguage"),
    targetLanguage: document.getElementById("targetLanguage"),
    swapButton: document.getElementById("swapButton"),
    sourceText: document.getElementById("sourceText"),
    clearButton: document.getElementById("clearButton"),
    suggestions: document.getElementById("suggestions"),
    inputMeta: document.getElementById("inputMeta"),
    translateButton: document.getElementById("translateButton"),
    detectedLanguage: document.getElementById("detectedLanguage"),
    useDetectedButton: document.getElementById("useDetectedButton"),
    networkBadge: document.getElementById("networkBadge"),
    resultSection: document.getElementById("resultSection"),
    resultHeading: document.getElementById("resultHeading"),
    resultContent: document.getElementById("resultContent"),
    copyPrimaryButton: document.getElementById("copyPrimaryButton"),
    historySection: document.getElementById("historySection"),
    historyList: document.getElementById("historyList"),
    historyToggle: document.getElementById("historyToggle"),
    clearHistoryButton: document.getElementById("clearHistoryButton"),
    resultCardTemplate: document.getElementById("resultCardTemplate")
  };

  const state = {
    detected: null,
    latestResult: null,
    historyOpen: false,
    debounce: null
  };

  init();

  function init() {
    populateLanguageSelects();
    restoreSettings();
    bindEvents();
    updateNetworkState();
    updateInputMeta();
    renderHistory();
    registerServiceWorker();
  }

  function populateLanguageSelects() {
    Object.entries(LANGUAGES).forEach(([code, item]) => {
      const option = new Option(item.label, code);
      els.sourceLanguage.add(option);
      if (code !== "auto") els.targetLanguage.add(new Option(item.label, code));
    });
  }

  function restoreSettings() {
    const saved = safeJsonParse(localStorage.getItem(STORAGE.settings), {});
    els.sourceLanguage.value = saved.source || "auto";
    els.targetLanguage.value = saved.target || "en";
  }

  function saveSettings() {
    localStorage.setItem(STORAGE.settings, JSON.stringify({ source: els.sourceLanguage.value, target: els.targetLanguage.value }));
  }

  function bindEvents() {
    els.sourceLanguage.addEventListener("change", () => { saveSettings(); detectAndRender(); renderSuggestions(); });
    els.targetLanguage.addEventListener("change", saveSettings);
    els.swapButton.addEventListener("click", swapLanguages);
    els.sourceText.addEventListener("input", onInput);
    els.sourceText.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") translateCurrent();
      if (event.key === "Escape") hideSuggestions();
    });
    els.clearButton.addEventListener("click", clearInput);
    els.translateButton.addEventListener("click", translateCurrent);
    els.useDetectedButton.addEventListener("click", () => {
      if (state.detected?.code) {
        els.sourceLanguage.value = state.detected.code;
        saveSettings();
        detectAndRender();
      }
    });
    els.copyPrimaryButton.addEventListener("click", () => {
      const text = state.latestResult?.variants?.map(v => v.text).join("\n") || "";
      if (text) copyText(text, els.copyPrimaryButton);
    });
    els.historyToggle.addEventListener("click", () => {
      state.historyOpen = !state.historyOpen;
      els.historySection.hidden = !state.historyOpen;
      els.historyToggle.textContent = state.historyOpen ? "schließen" : "Verlauf";
      if (state.historyOpen) renderHistory();
    });
    els.clearHistoryButton.addEventListener("click", () => {
      localStorage.removeItem(STORAGE.history);
      renderHistory();
    });
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);
    document.addEventListener("click", (event) => {
      if (!els.suggestions.contains(event.target) && event.target !== els.sourceText) hideSuggestions();
    });
  }

  function onInput() {
    updateInputMeta();
    els.clearButton.hidden = !els.sourceText.value;
    renderSuggestions();
    clearTimeout(state.debounce);
    state.debounce = setTimeout(detectAndRender, 160);
  }

  function updateInputMeta() {
    const text = els.sourceText.value;
    const wordMode = isSingleWord(text);
    els.inputMeta.textContent = `${text.length} / 500${text.trim() ? (wordMode ? " · Wort" : " · Satz") : ""}`;
  }

  function clearInput() {
    els.sourceText.value = "";
    els.clearButton.hidden = true;
    els.resultSection.hidden = true;
    hideSuggestions();
    state.latestResult = null;
    state.detected = null;
    updateInputMeta();
    detectAndRender();
    els.sourceText.focus();
  }

  async function detectAndRender() {
    const text = els.sourceText.value.trim();
    if (!text) {
      els.detectedLanguage.textContent = "Sprache automatisch erkennen";
      els.useDetectedButton.hidden = true;
      return;
    }

    let detection = detectLanguageLocal(text);
    if (els.sourceLanguage.value === "auto" && text.length >= 12) {
      const browserDetection = await detectWithBrowserAI(text);
      if (browserDetection && browserDetection.confidence > (detection?.confidence || 0)) detection = browserDetection;
    }

    state.detected = detection;
    if (!detection) {
      els.detectedLanguage.textContent = "Sprache noch nicht sicher erkannt";
      els.useDetectedButton.hidden = true;
      return;
    }
    els.detectedLanguage.textContent = `Erkannt: ${LANGUAGES[detection.code]?.label || detection.code}${detection.confidence ? ` · ${Math.round(detection.confidence * 100)}%` : ""}`;
    els.useDetectedButton.hidden = els.sourceLanguage.value !== "auto" || detection.code === "auto";
  }

  function detectLanguageLocal(text) {
    const normalized = normalize(text);
    const exact = byTerm.get(normalized);
    if (exact) return { code: exact.lang, confidence: 0.99, source: "lexicon" };
    if (/\p{Script=Han}/u.test(text)) return { code: "zh", confidence: 0.98, source: "script" };
    if (/\p{Script=Cyrillic}/u.test(text)) return { code: "ru", confidence: 0.96, source: "script" };

    const words = normalized.split(/[^\p{L}]+/u).filter(Boolean);
    if (!words.length) return null;
    const scores = { de: 0, en: 0, fr: 0, it: 0 };
    for (const word of words) {
      for (const [lang, stopwords] of Object.entries(STOPWORDS)) if (stopwords.includes(word)) scores[lang] += 2;
      if (/[äöüß]/i.test(word)) scores.de += 3;
      if (/[àâçéèêëîïôûùüÿœ]/i.test(word)) scores.fr += 3;
      if (/[àèéìíîòóùú]/i.test(word)) scores.it += 2;
    }
    const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
    if (sorted[0][1] > 0) {
      const confidence = Math.min(.92, .56 + sorted[0][1] / Math.max(10, words.length * 2));
      return { code: sorted[0][0], confidence, source: "heuristic" };
    }
    return null;
  }

  async function detectWithBrowserAI(text) {
    try {
      if (!("LanguageDetector" in self)) return null;
      const availability = await self.LanguageDetector.availability();
      if (availability === "unavailable") return null;
      const detector = await self.LanguageDetector.create();
      const results = await detector.detect(text);
      const supported = results.find(item => LANGUAGES[item.detectedLanguage]);
      detector.destroy?.();
      if (!supported) return null;
      return { code: supported.detectedLanguage, confidence: supported.confidence || 0, source: "browser-ai" };
    } catch (_) { return null; }
  }

  function renderSuggestions() {
    const raw = els.sourceText.value;
    const query = normalize(raw);
    if (!query || /\s/.test(raw.trim()) || query.length < 2) return hideSuggestions();

    const sourceHint = els.sourceLanguage.value;
    const suggestions = [];
    for (const entry of lexicon) {
      const allTerms = [entry.key, ...(entry.forms || [])];
      for (const term of allTerms) {
        const n = normalize(term);
        if (n.startsWith(query) && (sourceHint === "auto" || entry.lang === sourceHint)) {
          suggestions.push({ text: term, lang: entry.lang });
        }
      }
    }
    const unique = [...new Map(suggestions.map(item => [`${item.lang}:${item.text}`, item])).values()].slice(0, 6);
    if (!unique.length) return hideSuggestions();

    els.suggestions.innerHTML = "";
    unique.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-item";
      button.role = "option";
      button.innerHTML = `<span>${escapeHtml(item.text)}</span><span class="suggestion-lang">${LANGUAGES[item.lang].short}</span>`;
      button.addEventListener("click", () => {
        els.sourceText.value = item.text;
        els.clearButton.hidden = false;
        hideSuggestions();
        detectAndRender();
        updateInputMeta();
        els.sourceText.focus();
      });
      els.suggestions.appendChild(button);
    });
    els.suggestions.hidden = false;
  }

  function hideSuggestions() {
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
  }

  async function translateCurrent() {
    const text = els.sourceText.value.trim();
    if (!text) return els.sourceText.focus();
    hideSuggestions();
    await detectAndRender();

    const source = resolveSourceLanguage(text);
    const target = els.targetLanguage.value;
    if (!source) return renderStatus("Die Ausgangssprache konnte bei diesem kurzen Text nicht sicher erkannt werden. Wähle sie oben einmal manuell aus.");
    if (source === target) return renderStatus("Ausgangs- und Zielsprache sind identisch. Tausche die Sprachen oder wähle eine andere Zielsprache.");

    els.translateButton.disabled = true;
    els.translateButton.textContent = "Übersetze …";
    try {
      const cacheKey = `${source}|${target}|${normalize(text)}`;
      const cached = getTranslationCache()[cacheKey];
      const local = getLocalTranslation(text, source, target);

      let result = null;
      if (local) result = local;
      else if (navigator.onLine) {
        result = await translateWithBrowserAI(text, source, target);
        if (!result) result = await translateWithMyMemory(text, source, target);
      } else if (cached) result = { ...cached, provider: "cache", cached: true };

      if (!result && cached) result = { ...cached, provider: "cache", cached: true };
      if (!result) {
        renderStatus("Diese Übersetzung ist offline noch nicht verfügbar. Bereits geladene Übersetzungen und lokale Wörterbucheinträge funktionieren weiterhin.");
        return;
      }

      result.source = source;
      result.target = target;
      result.query = text;
      if (isSingleWord(text) && target === "en") await enrichEnglishVariants(result);
      state.latestResult = result;
      renderResult(result);
      saveTranslationCache(cacheKey, result);
      saveHistory(result);
    } catch (error) {
      console.error(error);
      renderStatus("Die Online-Übersetzung ist gerade nicht erreichbar. Prüfe die Verbindung oder versuche es erneut; lokale und gecachte Ergebnisse bleiben verfügbar.");
    } finally {
      els.translateButton.disabled = false;
      els.translateButton.textContent = "Übersetzen";
    }
  }

  function resolveSourceLanguage(text) {
    if (els.sourceLanguage.value !== "auto") return els.sourceLanguage.value;
    return state.detected?.code || detectLanguageLocal(text)?.code || null;
  }

  function getLocalTranslation(text, source, target) {
    const entry = byTerm.get(normalize(text));
    if (!entry || entry.lang !== source || !entry.translations?.[target]) return null;
    return {
      provider: "offline lexicon",
      variants: entry.translations[target].map((item, index) => ({
        text: item.text,
        label: index === 0 ? "Empfohlen" : item.pos || `Alternative ${index + 1}`,
        pos: item.pos || "",
        note: item.note || "",
        examples: item.examples || []
      }))
    };
  }

  async function translateWithBrowserAI(text, source, target) {
    try {
      if (!("Translator" in self)) return null;
      const availability = await self.Translator.availability({ sourceLanguage: source, targetLanguage: target });
      if (availability === "unavailable") return null;
      const translator = await self.Translator.create({ sourceLanguage: source, targetLanguage: target });
      const translated = await translator.translate(text);
      translator.destroy?.();
      if (!translated) return null;
      return { provider: "on-device", variants: [{ text: translated, label: "Empfohlen", note: "Lokal im Browser übersetzt" }] };
    } catch (_) { return null; }
  }

  async function translateWithMyMemory(text, source, target) {
    const query = new URLSearchParams({ q: text, langpair: `${source}|${target}`, mt: "1" });
    const response = await fetch(`https://api.mymemory.translated.net/get?${query.toString()}`, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`MyMemory ${response.status}`);
    const data = await response.json();
    const primary = cleanTranslation(data?.responseData?.translatedText);
    const candidates = [];
    if (primary) candidates.push({ text: primary, label: "Empfohlen", note: "Online-Übersetzung" });

    for (const match of (data?.matches || []).slice(0, 12)) {
      const translated = cleanTranslation(match.translation);
      if (!translated || candidates.some(v => normalize(v.text) === normalize(translated))) continue;
      candidates.push({
        text: translated,
        label: candidates.length === 0 ? "Empfohlen" : `Alternative ${candidates.length + 1}`,
        note: match.match ? `Trefferqualität ${Math.round(Number(match.match) * 100)}%` : "Alternative Formulierung",
        examples: match.segment && match.translation ? [[match.segment, match.translation]] : []
      });
      if (candidates.length >= 5) break;
    }
    return candidates.length ? { provider: "MyMemory", variants: candidates } : null;
  }

  async function enrichEnglishVariants(result) {
    const lookups = result.variants.slice(0, 4).filter(v => /^[A-Za-z][A-Za-z' -]*$/.test(v.text) && v.text.split(/\s+/).length === 1);
    await Promise.all(lookups.map(async variant => {
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(variant.text.toLowerCase())}`);
        if (!response.ok) return;
        const entries = await response.json();
        const meanings = entries.flatMap(entry => entry.meanings || []);
        const pos = [...new Set(meanings.map(m => m.partOfSpeech).filter(Boolean))].slice(0, 4);
        const definitions = meanings.flatMap(m => (m.definitions || []).map(d => ({ pos: m.partOfSpeech, definition: d.definition, example: d.example }))).slice(0, 4);
        variant.pos = pos.join(" · ") || variant.pos;
        variant.dictionary = definitions;
      } catch (_) {}
    }));
  }

  function renderResult(result) {
    els.resultContent.innerHTML = "";
    els.resultSection.hidden = false;
    els.copyPrimaryButton.hidden = result.variants.length < 2;
    els.resultHeading.textContent = isSingleWord(result.query) ? "Wortvarianten" : "Übersetzungen";

    result.variants.forEach((variant, index) => {
      const card = els.resultCardTemplate.content.firstElementChild.cloneNode(true);
      const label = card.querySelector(".result-label");
      const word = card.querySelector(".result-word");
      const note = card.querySelector(".result-note");
      const copy = card.querySelector(".copy-button");
      const details = card.querySelector(".result-details");

      label.textContent = variant.label || (index === 0 ? "Empfohlen" : `Alternative ${index + 1}`);
      word.textContent = variant.text;
      note.textContent = [variant.pos, variant.note].filter(Boolean).join(" · ");
      copy.addEventListener("click", () => copyText(variant.text, copy));

      const hasDetails = Boolean((variant.examples && variant.examples.length) || (variant.dictionary && variant.dictionary.length));
      if (hasDetails) {
        word.setAttribute("aria-expanded", "false");
        word.title = "Beispiele anzeigen";
        fillDetails(details, variant);
        word.addEventListener("click", () => {
          details.hidden = !details.hidden;
          word.setAttribute("aria-expanded", String(!details.hidden));
        });
      } else {
        word.style.cursor = "default";
      }
      els.resultContent.appendChild(card);
    });
    els.resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function fillDetails(container, variant) {
    if (variant.dictionary?.length) {
      const pos = [...new Set(variant.dictionary.map(d => d.pos).filter(Boolean))];
      if (pos.length) {
        const block = document.createElement("div");
        block.className = "detail-block";
        block.innerHTML = `<p class="detail-title">Wortarten</p><div>${pos.map(p => `<span class="pos-chip">${escapeHtml(p)}</span>`).join("")}</div>`;
        container.appendChild(block);
      }
      variant.dictionary.slice(0, 3).forEach(item => {
        const block = document.createElement("div");
        block.className = "detail-block";
        block.innerHTML = `<p class="detail-title">${escapeHtml(item.pos || "Bedeutung")}</p><p class="detail-text">${escapeHtml(item.definition || "")}</p>${item.example ? `<div class="example-pair"><p class="example-source">${escapeHtml(item.example)}</p></div>` : ""}`;
        container.appendChild(block);
      });
    }
    if (variant.examples?.length) {
      const block = document.createElement("div");
      block.className = "detail-block";
      block.innerHTML = `<p class="detail-title">Anwendungsbeispiele</p>`;
      variant.examples.slice(0, 4).forEach(([source, target]) => {
        const pair = document.createElement("div");
        pair.className = "example-pair";
        pair.innerHTML = `<p class="example-source">${escapeHtml(source)}</p><p class="example-target">${escapeHtml(target)}</p>`;
        block.appendChild(pair);
      });
      container.appendChild(block);
    }
  }

  function renderStatus(message) {
    state.latestResult = null;
    els.resultSection.hidden = false;
    els.copyPrimaryButton.hidden = true;
    els.resultHeading.textContent = "Hinweis";
    els.resultContent.innerHTML = `<div class="status-card">${escapeHtml(message)}</div>`;
  }

  function swapLanguages() {
    const source = els.sourceLanguage.value;
    const target = els.targetLanguage.value;
    const resolvedSource = source === "auto" ? (state.detected?.code || "de") : source;
    els.sourceLanguage.value = target;
    els.targetLanguage.value = resolvedSource;
    if (state.latestResult?.variants?.[0]?.text) els.sourceText.value = state.latestResult.variants[0].text;
    saveSettings();
    updateInputMeta();
    detectAndRender();
  }

  function getTranslationCache() {
    return safeJsonParse(localStorage.getItem(STORAGE.cache), {});
  }

  function saveTranslationCache(key, result) {
    const cache = getTranslationCache();
    cache[key] = {
      provider: result.provider,
      variants: result.variants.slice(0, 5).map(v => ({ text: v.text, label: v.label, pos: v.pos, note: v.note, examples: v.examples || [], dictionary: v.dictionary || [] })),
      source: result.source,
      target: result.target,
      query: result.query,
      cachedAt: Date.now()
    };
    const entries = Object.entries(cache).sort((a,b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0)).slice(0, 80);
    localStorage.setItem(STORAGE.cache, JSON.stringify(Object.fromEntries(entries)));
  }

  function saveHistory(result) {
    const history = safeJsonParse(localStorage.getItem(STORAGE.history), []);
    const item = { query: result.query, translation: result.variants[0]?.text || "", source: result.source, target: result.target, at: Date.now() };
    const filtered = history.filter(h => !(normalize(h.query) === normalize(item.query) && h.source === item.source && h.target === item.target));
    filtered.unshift(item);
    localStorage.setItem(STORAGE.history, JSON.stringify(filtered.slice(0, 20)));
    if (state.historyOpen) renderHistory();
  }

  function renderHistory() {
    const history = safeJsonParse(localStorage.getItem(STORAGE.history), []);
    els.historyList.innerHTML = "";
    if (!history.length) {
      els.historyList.innerHTML = `<div class="status-card">Noch keine Übersetzungen gespeichert.</div>`;
      return;
    }
    history.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span class="history-query">${escapeHtml(item.query)}</span><span class="history-translation">${escapeHtml(item.translation)}</span>`;
      button.addEventListener("click", () => {
        els.sourceText.value = item.query;
        els.sourceLanguage.value = item.source;
        els.targetLanguage.value = item.target;
        saveSettings();
        state.historyOpen = false;
        els.historySection.hidden = true;
        els.historyToggle.textContent = "Verlauf";
        translateCurrent();
      });
      const pair = document.createElement("span");
      pair.className = "history-pair";
      pair.textContent = `${LANGUAGES[item.source]?.short || item.source} → ${LANGUAGES[item.target]?.short || item.target}`;
      row.append(button, pair);
      els.historyList.appendChild(row);
    });
  }

  function updateNetworkState() {
    const online = navigator.onLine;
    els.networkBadge.textContent = online ? "Online" : "Offline";
    els.networkBadge.classList.toggle("offline", !online);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
    }
    const old = button.textContent;
    button.classList.add("copied");
    button.textContent = "✓";
    setTimeout(() => { button.textContent = old; button.classList.remove("copied"); }, 900);
  }

  function buildLexiconIndex(entries) {
    const map = new Map();
    entries.forEach(entry => {
      map.set(normalize(entry.key), entry);
      (entry.forms || []).forEach(form => map.set(normalize(form), entry));
    });
    return map;
  }

  function isSingleWord(text) {
    return /^\s*[\p{L}\p{M}'’-]+\s*$/u.test(text || "");
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase().normalize("NFKC");
  }

  function cleanTranslation(value) {
    if (!value) return "";
    const el = document.createElement("textarea");
    el.innerHTML = String(value);
    return el.value.trim();
  }

  function safeJsonParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
