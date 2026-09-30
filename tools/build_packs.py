#!/usr/bin/env python3
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

LANGS = {
    "de": {"panlex": ["de", "deu"], "freq": "de"},
    "fr": {"panlex": ["fr", "fra"], "freq": "fr"},
    "it": {"panlex": ["it", "ita"], "freq": "it"},
    "ru": {"panlex": ["ru", "rus"], "freq": "ru"},
    "zh": {"panlex": ["cmn", "zh", "zho"], "freq": "zh"},
}
TOP_FREQ = 20000
MAX_PAIRS = 18000
MAX_KEYS = 12000
MAX_TRANSLATIONS = 4

literal_re = re.compile(r'^"(.*)"@([A-Za-z0-9_-]+)$')

def norm(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip().casefold()

def decode_literal(field: str, lang: str):
    m = literal_re.match(field.strip())
    if not m or m.group(2) != lang:
        return None
    value = m.group(1)
    return value.replace('\\\"', '"')

def load_freq(path: Path):
    ranks = {}
    with path.open("r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            if len(ranks) >= TOP_FREQ:
                break
            line = line.rstrip("\n")
            if not line:
                continue
            try:
                word, _count = line.rsplit(" ", 1)
            except ValueError:
                continue
            key = norm(word)
            if not key or len(key) > 64 or key in ranks:
                continue
            ranks[key] = len(ranks) + 1
    return ranks

def pair_score(en_key, tgt_key, en_rank, tgt_rank):
    e = en_rank.get(en_key, TOP_FREQ * 4)
    t = tgt_rank.get(tgt_key, TOP_FREQ * 4)
    return (min(e, t), e + t)

def build_pair(target: str, root: Path, out_dir: Path):
    info = LANGS[target]
    tsv = None
    panlex_lang = None
    reverse_file = False
    for candidate in info["panlex"]:
        forward = root / "panlex" / "en" / f"en-{candidate}.tsv"
        reverse = root / "panlex" / candidate / f"{candidate}-en.tsv"
        if forward.exists():
            tsv = forward
            panlex_lang = candidate
            reverse_file = False
            break
        if reverse.exists():
            tsv = reverse
            panlex_lang = candidate
            reverse_file = True
            break
    if tsv is None:
        raise FileNotFoundError(f"No PanLex pair file for {target}; tried codes {info['panlex']}")
    en_freq = load_freq(root / "freq" / "en_50k.txt")
    tgt_freq = load_freq(root / "freq" / f"{info['freq']}_50k.txt")

    candidates = []
    seen_pairs = set()

    with tsv.open("r", encoding="utf-8", errors="ignore", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        for row in reader:
            if not row:
                continue
            if reverse_file:
                target_value = decode_literal(row[0], panlex_lang)
                if not target_value:
                    continue
                source = None
                for field in reversed(row):
                    source = decode_literal(field, "en")
                    if source:
                        break
                if not source:
                    continue
            else:
                source = decode_literal(row[0], "en")
                if not source:
                    continue
                target_value = None
                for field in reversed(row):
                    target_value = decode_literal(field, panlex_lang)
                    if target_value:
                        break
                if not target_value:
                    continue

            sk = norm(source)
            tk = norm(target_value)
            if not sk or not tk:
                continue
            if sk not in en_freq and tk not in tgt_freq:
                continue
            if len(source) > 80 or len(target_value) > 80:
                continue
            pair = (sk, tk)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            candidates.append((pair_score(sk, tk, en_freq, tgt_freq), source, target_value, sk, tk))

    candidates.sort(key=lambda x: x[0])

    grouped = defaultdict(list)
    canonical_source = {}
    translations = 0
    for _score, source, target_value, sk, tk in candidates:
        if translations >= MAX_PAIRS:
            break
        if sk not in grouped and len(grouped) >= MAX_KEYS:
            continue
        bucket = grouped[sk]
        if any(norm(v) == tk for v in bucket):
            continue
        if len(bucket) >= MAX_TRANSLATIONS:
            continue
        canonical_source.setdefault(sk, source)
        bucket.append(target_value)
        translations += 1

    entries = [[canonical_source[k], grouped[k]] for k in grouped]
    payload = {
        "v": "panlex-2019-freq-2026.09",
        "source": "en",
        "target": target,
        "license": "PanLex CC0; FrequencyWords CC BY-SA 4.0 used for ranking",
        "entries": entries,
        "stats": {
            "keys": len(entries),
            "translations": translations,
            "sourceFrequencyPool": len(en_freq),
            "targetFrequencyPool": len(tgt_freq),
        },
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"en-{target}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{target}: {len(entries)} keys, {translations} translations, {out.stat().st_size/1024:.1f} KiB")

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_packs.py <work-root> <output-dir>")
    root = Path(sys.argv[1])
    out = Path(sys.argv[2])
    for target in LANGS:
        build_pair(target, root, out)

if __name__ == "__main__":
    main()
