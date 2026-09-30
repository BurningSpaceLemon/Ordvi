(() => {
  "use strict";

  const LANGUAGES = {
    auto: { label: "Auto", short: "AUTO" },
    de: { label: "Deutsch", short: "DE", tatoeba: "deu" },
    en: { label: "Englisch", short: "EN", tatoeba: "eng" },
    fr: { label: "Französisch", short: "FR", tatoeba: "fra" },
    it: { label: "Italienisch", short: "IT", tatoeba: "ita" },
    ru: { label: "Russisch", short: "RU", tatoeba: "rus" },
    zh: { label: "Chinesisch", short: "ZH", tatoeba: "cmn" }
  };

  const STORAGE = {
    settings: "ordvi.settings.v1",
    history: "ordvi.history.v1",
    cache: "ordvi.cache.v1",
    wordKb: "ordvi.wordkb.v1",
    details: "ordvi.details.v1"
  };

  const STOPWORDS = {
    de: ["der","die","das","und","ist","ich","wir","mit","für","nicht","eine","einen","sich","zu","von","auf","im","den"],
    en: ["the","and","is","i","we","with","for","not","a","an","to","of","on","in","this","that"],
    fr: ["le","la","les","et","est","je","nous","avec","pour","pas","un","une","de","des","dans","ce"],
    it: ["il","lo","la","gli","le","e","è","io","noi","con","per","non","un","una","di","nel","questo"]
  };

  const coreLexicon = Array.isArray(window.ORDVI_CORE_KB) ? window.ORDVI_CORE_KB : [];
  const customLexicon = Array.isArray(window.ORDVI_LEXICON) ? window.ORDVI_LEXICON : [];
  const lexicon = [...coreLexicon, ...customLexicon];
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
    updateButton: document.getElementById("updateButton"),
    versionLabel: document.getElementById("versionLabel"),
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
    debounce: null,
    waitingWorker: null,
    reloadingForUpdate: false
  };

  init();

  function init() {
    populateLanguageSelects();
    restoreSettings();
    bindEvents();
    updateNetworkState();
    updateInputMeta();
    renderHistory();
    renderVersion();
    registerServiceWorker();
    setTimeout(warmSelectedPacks, 0);
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

  function warmSelectedPacks() {
    const packs = globalThis.ORDVI_PACKS;
    if (!packs) return;
    const source = els.sourceLanguage.value === "auto" ? state.detected?.code : els.sourceLanguage.value;
    const target = els.targetLanguage.value;
    if (!source || source === "auto" || !target || source === target) return;
    packs.ensurePair(source, target)
      .then(() => renderSuggestions())
      .catch(() => {});
  }

  function bindEvents() {
    els.sourceLanguage.addEventListener("change", () => { saveSettings(); detectAndRender(); renderSuggestions(); warmSelectedPacks(); });
    els.targetLanguage.addEventListener("change", () => { saveSettings(); warmSelectedPacks(); });
    els.swapButton.addEventListener("click", swapLanguages);
    els.sourceText.addEventListener("input", onInput);
    els.sourceText.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        translateCurrent();
        return;
      }
      if (event.key === "Escape") hideSuggestions();
    });
    els.clearButton.addEventListener("click", clearInput);
    els.translateButton.addEventListener("click", translateCurrent);
    els.useDetectedButton.addEventListener("click", () => {
      if (state.detected?.code) {
        els.sourceLanguage.value = state.detected.code;
        saveSettings();
        detectAndRender();
        warmSelectedPacks();
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

  function detectAndRender() {
    const text = els.sourceText.value.trim();
    if (!text) {
      els.detectedLanguage.textContent = "Sprache automatisch erkennen";
      els.useDetectedButton.hidden = true;
      return;
    }

    const detection = detectLanguageLocal(text);
    state.detected = detection;
    if (!detection) {
      els.detectedLanguage.textContent = "Sprache wird beim Übersetzen erkannt";
      els.useDetectedButton.hidden = true;
      return;
    }
    els.detectedLanguage.textContent = `Erkannt: ${LANGUAGES[detection.code]?.label || detection.code}${detection.confidence ? ` · ${Math.round(detection.confidence * 100)}%` : ""}`;
    els.useDetectedButton.hidden = els.sourceLanguage.value !== "auto" || detection.code === "auto";
    if (els.sourceLanguage.value === "auto") warmSelectedPacks();
  }

    function detectLanguageLocal(text) {
    const normalized = normalize(text);
    const exact = byTerm.get(normalized) || [];
    const exactLanguages = [...new Set(exact.map(entry => entry.lang))];
    if (exactLanguages.length === 1) return { code: exactLanguages[0], confidence: 0.99, source: "lexicon" };
    const packDetected = globalThis.ORDVI_PACKS?.detectSync?.(text);
    if (packDetected) return { code: packDetected, confidence: 0.96, source: "offline pack" };
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

    const learned = getWordKb();
    Object.values(learned).forEach(item => {
      if (!item?.query || !item?.source) return;
      if (normalize(item.query).startsWith(query) && (sourceHint === "auto" || item.source === sourceHint)) {
        suggestions.push({ text: item.query, lang: item.source });
      }
    });

    const packSuggestions = globalThis.ORDVI_PACKS?.suggestSync?.(raw.trim(), sourceHint, 7) || [];
    suggestions.push(...packSuggestions);

    const unique = [...new Map(suggestions.map(item => [`${item.lang}:${normalize(item.text)}`, item])).values()].slice(0, 7);
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
    detectAndRender();

    let source = resolveSourceLanguage(text);
    const target = els.targetLanguage.value;

    if (!source && els.sourceLanguage.value === "auto") {
      const quickDetection = await withTimeout(detectWithBrowserAI(text), 700).catch(() => null);
      source = quickDetection?.code || null;
      if (quickDetection) {
        state.detected = quickDetection;
        els.detectedLanguage.textContent = `Erkannt: ${LANGUAGES[quickDetection.code]?.label || quickDetection.code}`;
      }
    }

    if (!source) return renderStatus("Die Ausgangssprache konnte bei diesem kurzen Text nicht sicher erkannt werden. Wähle sie oben einmal manuell aus.");
    if (source === target) return renderStatus("Ausgangs- und Zielsprache sind identisch. Tausche die Sprachen oder wähle eine andere Zielsprache.");

    const cacheKey = `${source}|${target}|${normalize(text)}`;
    const local = getLocalTranslation(text, source, target);
    const learned = isSingleWord(text) ? getLearnedWordTranslation(text, source, target) : null;
    const packLocal = isSingleWord(text) ? globalThis.ORDVI_PACKS?.lookupSync?.(text, source, target) : null;
    const cached = getTranslationCache()[cacheKey];

    // Anything we already know renders synchronously.
    if (local || learned || packLocal || cached) {
      const result = local || learned || packLocal || { ...cached, provider: "lokaler Cache", cached: true };
      result.source = source;
      result.target = target;
      result.query = text;
      state.latestResult = result;
      renderResult(result);
      saveHistory(result);
      return;
    }

    if (isSingleWord(text) && globalThis.ORDVI_PACKS) {
      const packResult = await withTimeout(globalThis.ORDVI_PACKS.lookup(text, source, target), 1800).catch(() => null);
      if (packResult) {
        packResult.source = source;
        packResult.target = target;
        packResult.query = text;
        state.latestResult = packResult;
        renderResult(packResult);
        saveHistory(packResult);
        return;
      }
    }

    if (!navigator.onLine) {
      renderStatus("Dieses Wort ist offline noch nicht in den installierten Sprachpaketen. Öffne Ordvi einmal online mit diesem Sprachpaar, damit das Paket lokal gespeichert wird.");
      return;
    }

    els.translateButton.disabled = true;
    els.translateButton.textContent = "Übersetze …";
    try {
      const result = await fastTranslate(text, source, target);
      if (!result) throw new Error("No translation result");

      result.source = source;
      result.target = target;
      result.query = text;
      state.latestResult = result;
      renderResult(result);
      saveTranslationCache(cacheKey, result);
      if (isSingleWord(text)) saveLearnedWord(result);
      saveHistory(result);
    } catch (error) {
      console.error(error);
      renderStatus("Die Online-Übersetzung reagiert gerade nicht schnell genug. Lokale und bereits gelernte Wörter bleiben sofort verfügbar.");
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
    const candidates = byTerm.get(normalize(text)) || [];
    const entry = candidates.find(item => item.lang === source && item.translations?.[target]);
    if (!entry) return null;
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

  async function fastTranslate(text, source, target) {
    const valid = promise => Promise.resolve(promise).then(value => {
      if (!value) throw new Error("empty result");
      return value;
    });

    try {
      return await Promise.any([
        withTimeout(valid(translateWithMyMemory(text, source, target)), 2600),
        withTimeout(valid(translateWithBrowserAI(text, source, target)), 2200)
      ]);
    } catch (_) {
      return await withTimeout(valid(translateWithMyMemory(text, source, target)), 4200).catch(() => null);
    }
  }

  function getWordKb() {
    return safeJsonParse(localStorage.getItem(STORAGE.wordKb), {});
  }

  function getLearnedWordTranslation(text, source, target) {
    const key = `${source}|${target}|${normalize(text)}`;
    const item = getWordKb()[key];
    return item ? {
      provider: "lokale Wissensbasis",
      variants: item.variants || []
    } : null;
  }

  function saveLearnedWord(result) {
    if (!result?.query || !result?.source || !result?.target || !result?.variants?.length) return;
    const kb = getWordKb();
    const key = `${result.source}|${result.target}|${normalize(result.query)}`;
    kb[key] = {
      query: result.query,
      source: result.source,
      target: result.target,
      variants: result.variants.slice(0, 6).map(v => ({
        text: v.text,
        label: v.label,
        pos: v.pos || "",
        note: v.note || "",
        examples: v.examples || []
      })),
      savedAt: Date.now()
    };
    const entries = Object.entries(kb).sort((a,b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 750);
    localStorage.setItem(STORAGE.wordKb, JSON.stringify(Object.fromEntries(entries)));
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

      // Every result can be opened. Missing details are fetched only after the tap.
      word.setAttribute("aria-expanded", "false");
      word.title = "Verwendung und Beispiele anzeigen";
      word.addEventListener("click", async () => {
        const opening = details.hidden;
        details.hidden = !opening;
        word.setAttribute("aria-expanded", String(opening));
        if (opening && !details.dataset.loaded) {
          details.dataset.loaded = "loading";
          renderDetailShell(details, variant);
          await enrichVariantDetails(details, variant, result);
        }
      });

      els.resultContent.appendChild(card);
    });
    els.resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderDetailShell(container, variant) {
    container.innerHTML = "";

    if (variant.pos || variant.note) {
      const usage = document.createElement("div");
      usage.className = "detail-block";
      usage.innerHTML = `<p class="detail-title">Verwendung</p>${variant.pos ? `<div><span class="pos-chip">${escapeHtml(variant.pos)}</span></div>` : ""}${variant.note ? `<p class="detail-text">${escapeHtml(variant.note)}</p>` : ""}`;
      container.appendChild(usage);
    }

    fillDetails(container, variant);

    const loading = document.createElement("div");
    loading.className = "detail-block detail-loading";
    loading.innerHTML = `<p class="detail-title">Zusatzinfos</p><p class="detail-text">${navigator.onLine ? "Beispiele und Wortinformationen werden ergänzt …" : "Offline – lokale Informationen werden angezeigt."}</p>`;
    container.appendChild(loading);
  }

  async function enrichVariantDetails(container, variant, result) {
    const detailKey = `${result.target}|${result.source}|${normalize(variant.text)}`;
    let details = getDetailsCache()[detailKey] || null;

    if (!details && navigator.onLine) {
      const jobs = [fetchTatoebaExamples(variant.text, result.target, result.source)];
      if (result.target === "en" && isSingleWord(variant.text)) jobs.push(fetchEnglishDictionary(variant.text));
      const settled = await Promise.allSettled(jobs);
      details = {
        examples: settled[0]?.status === "fulfilled" ? settled[0].value : [],
        dictionary: settled[1]?.status === "fulfilled" ? settled[1].value : [],
        savedAt: Date.now()
      };
      saveDetailsCache(detailKey, details);
    }

    container.querySelector(".detail-loading")?.remove();

    const existingExamples = new Set((variant.examples || []).map(pair => normalize(Array.isArray(pair) ? pair[0] : pair?.source)));
    if (details?.dictionary?.length) appendDictionaryDetails(container, details.dictionary);
    if (details?.examples?.length) {
      const freshExamples = details.examples.filter(pair => !existingExamples.has(normalize(pair?.[0])));
      appendExamples(container, freshExamples, "Beispiele aus echten Sätzen");
    }

    const hasAny = Boolean(
      variant.pos || variant.note ||
      variant.examples?.length ||
      variant.dictionary?.length ||
      details?.dictionary?.length ||
      details?.examples?.length
    );
    if (!hasAny) {
      const empty = document.createElement("div");
      empty.className = "detail-block";
      empty.innerHTML = '<p class="detail-title">Beispiele</p><p class="detail-text">Für diese Variante wurden noch keine verlässlichen Zusatzinfos gefunden.</p>';
      container.appendChild(empty);
    }
    container.dataset.loaded = "true";
  }

  async function fetchEnglishDictionary(word) {
    try {
      const response = await withTimeout(fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`), 1800);
      if (!response.ok) return [];
      const entries = await response.json();
      return entries.flatMap(entry => (entry.meanings || []).flatMap(meaning =>
        (meaning.definitions || []).slice(0, 2).map(def => ({
          pos: meaning.partOfSpeech || "",
          definition: def.definition || "",
          example: def.example || ""
        }))
      )).filter(item => item.definition).slice(0, 5);
    } catch (_) {
      return [];
    }
  }

  async function fetchTatoebaExamples(term, lang, translationLang) {
    const sourceCode = LANGUAGES[lang]?.tatoeba;
    const translationCode = LANGUAGES[translationLang]?.tatoeba;
    if (!sourceCode || !translationCode) return [];

    try {
      const url = new URL("https://api.tatoeba.org/v1/sentences");
      url.searchParams.set("lang", sourceCode);
      url.searchParams.set("q", term);
      url.searchParams.set("trans:lang", translationCode);
      url.searchParams.set("trans:is_direct", "yes");
      url.searchParams.set("trans:is_unapproved", "no");
      url.searchParams.set("trans:is_orphan", "no");
      url.searchParams.set("is_unapproved", "no");
      url.searchParams.set("is_orphan", "no");
      url.searchParams.set("showtrans", "matching");
      url.searchParams.set("sort", "relevance");
      url.searchParams.set("limit", "6");

      const response = await withTimeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), 2200);
      if (!response.ok) return [];
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      const examples = [];

      for (const row of rows) {
        if (!row?.text) continue;
        const translations = Array.isArray(row.translations) ? row.translations.flat(Infinity).filter(Boolean) : [];
        const translated = translations.find(item => item?.lang === translationCode && item?.text);
        if (!translated) continue;
        examples.push([row.text, translated.text]);
        if (examples.length >= 3) break;
      }
      return examples;
    } catch (_) {
      return [];
    }
  }

  function appendDictionaryDetails(container, dictionary) {
    const pos = [...new Set(dictionary.map(d => d.pos).filter(Boolean))];
    if (pos.length) {
      const block = document.createElement("div");
      block.className = "detail-block";
      block.innerHTML = `<p class="detail-title">Wortarten</p><div>${pos.map(p => `<span class="pos-chip">${escapeHtml(p)}</span>`).join("")}</div>`;
      container.appendChild(block);
    }
    dictionary.slice(0, 3).forEach(item => {
      const block = document.createElement("div");
      block.className = "detail-block";
      block.innerHTML = `<p class="detail-title">${escapeHtml(item.pos || "Bedeutung")}</p><p class="detail-text">${escapeHtml(item.definition || "")}</p>${item.example ? `<div class="example-pair"><p class="example-source">${escapeHtml(item.example)}</p></div>` : ""}`;
      container.appendChild(block);
    });
  }

  function appendExamples(container, examples, title) {
    if (!examples?.length) return;
    const block = document.createElement("div");
    block.className = "detail-block";
    block.innerHTML = `<p class="detail-title">${escapeHtml(title)}</p>`;
    examples.slice(0, 4).forEach(([source, target]) => {
      if (!source) return;
      const pair = document.createElement("div");
      pair.className = "example-pair";
      pair.innerHTML = `<p class="example-source">${escapeHtml(source)}</p>${target ? `<p class="example-target">${escapeHtml(target)}</p>` : ""}`;
      block.appendChild(pair);
    });
    container.appendChild(block);
  }

  function getDetailsCache() {
    return safeJsonParse(localStorage.getItem(STORAGE.details), {});
  }

  function saveDetailsCache(key, details) {
    const cache = getDetailsCache();
    cache[key] = details;
    const entries = Object.entries(cache).sort((a,b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 400);
    localStorage.setItem(STORAGE.details, JSON.stringify(Object.fromEntries(entries)));
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
    warmSelectedPacks();
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
    const add = (term, entry) => {
      const key = normalize(term);
      if (!key) return;
      const bucket = map.get(key) || [];
      if (!bucket.includes(entry)) bucket.push(entry);
      map.set(key, bucket);
    };
    entries.forEach(entry => {
      add(entry.key, entry);
      (entry.forms || []).forEach(form => add(form, entry));
    });
    return map;
  }

  function isSingleWord(text) {
    return /^\s*[\p{L}\p{M}'’-]+\s*$/u.test(text || "");
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase().normalize("NFKC");
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), ms);
      Promise.resolve(promise).then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
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

  function renderVersion() {
    if (!els.versionLabel) return;
    const version = globalThis.ORDVI_VERSION || "dev";
    const build = globalThis.ORDVI_BUILD || "";
    const kbCount = Number(globalThis.ORDVI_CORE_CONCEPT_COUNT || 0);
    els.versionLabel.textContent = `v${version}${build ? ` · ${build}` : ""}${kbCount ? ` · Core ${kbCount}` : ""}`;
  }

  function showUpdateAvailable(worker) {
    if (!worker || !els.updateButton) return;
    state.waitingWorker = worker;
    els.updateButton.hidden = false;
    els.updateButton.disabled = false;
    els.updateButton.textContent = "Update verfügbar";
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
      try {
        const version = globalThis.ORDVI_VERSION || "dev";
        const build = globalThis.ORDVI_BUILD || "dev";
        const registration = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(version)}&b=${encodeURIComponent(build)}`);

        if (registration.waiting) showUpdateAvailable(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateAvailable(worker);
            }
          });
        });

        els.updateButton?.addEventListener("click", async () => {
          els.updateButton.disabled = true;
          els.updateButton.textContent = "Aktualisiere …";
          if (state.waitingWorker) {
            state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
          } else {
            await registration.update().catch(() => {});
            if (!registration.waiting) {
              els.updateButton.disabled = false;
              els.updateButton.textContent = "Neu prüfen";
            }
          }
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (state.reloadingForUpdate) return;
          state.reloadingForUpdate = true;
          window.location.reload();
        });

        // Check on resume and periodically, but never block normal translation.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        });
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      } catch (_) {}
    });
  }
})();
