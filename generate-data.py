#!/usr/bin/env python3
"""
Generate data.js from analysis files for the static site.
Reads meta.json + analysis .txt files and produces a single JS data module.
"""

import json
import re
import os
from pathlib import Path

BASE = Path(__file__).parent
ANALYSES_DIR = BASE / "data" / "analyses"
OUTPUT = BASE / "site" / "js" / "data.js"

CANDIDATES = [
    {
        "slug": "romeu-zema",
        "meta_file": "romeu-zema-2026-meta.json",
        "analysis_file": "romeu-zema-2026.txt",
        "color": "#3B82F6",
    },
    {
        "slug": "ronaldo-caiado",
        "meta_file": "ronaldo-caiado-2026-meta.json",
        "analysis_file": "ronaldo-caiado-2026.txt",
        "color": "#10B981",
    },
    {
        "slug": "renan-santos",
        "meta_file": "renan-santos-2026-meta.json",
        "analysis_file": "renan-santos-2026.txt",
        "color": "#8B5CF6",
    },
    {
        "slug": "lula",
        "meta_file": "lula-2026-meta.json",
        "analysis_file": "lula-2026.txt",
        "color": "#EF4444",
    },
    {
        "slug": "flavio-bolsonaro",
        "meta_file": "flavio-bolsonaro-2026-meta.json",
        "analysis_file": "flavio-bolsonaro-2026.txt",
        "color": "#F59E0B",
    },
    {
        "slug": "augusto-cury",
        "meta_file": "augusto-cury-2026-meta.json",
        "analysis_file": "augusto-cury-2026.txt",
        "color": "#06B6D4",
    },
    # Entrevistas Domingo Espetacular - Record
    {
        "slug": "lula-domingo-espetacular",
        "meta_file": "lula-domingo-espetacular-2026-meta.json",
        "analysis_file": "lula-domingo-espetacular-2026.txt",
        "color": "#EF4444",
    },
    {
        "slug": "flavio-bolsonaro-domingo-espetacular",
        "meta_file": "flavio-bolsonaro-domingo-espetacular-2026-meta.json",
        "analysis_file": "flavio-bolsonaro-domingo-espetacular-2026.txt",
        "color": "#F59E0B",
    },
    # Debate da Band - 05/08/2026
    {
        "slug": "caiado-debate-band",
        "meta_file": "caiado-debate-band-meta.json",
        "analysis_file": "caiado-debate-band.txt",
        "color": "#10B981",
    },
    {
        "slug": "renan-debate-band",
        "meta_file": "renan-debate-band-meta.json",
        "analysis_file": "renan-debate-band.txt",
        "color": "#8B5CF6",
    },
    {
        "slug": "cury-debate-band",
        "meta_file": "cury-debate-band-meta.json",
        "analysis_file": "cury-debate-band.txt",
        "color": "#06B6D4",
    },
]

# Event name mapping
EVENT_NAMES = {
    "caiado-debate-band": "Debate Band",
    "renan-debate-band": "Debate Band",
    "cury-debate-band": "Debate Band",
    "lula-domingo-espetacular": "Domingo Espetacular",
    "flavio-bolsonaro-domingo-espetacular": "Domingo Espetacular",
}

def get_event_name(slug):
    if slug in EVENT_NAMES:
        return EVENT_NAMES[slug]
    if "debate" in slug:
        return "Debate Band"
    return "Entrevista JN"


def load_meta(slug_info):
    path = ANALYSES_DIR / slug_info["meta_file"]
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_classification(raw):
    """Normalize classification strings to consistent keys."""
    raw = raw.strip().upper()
    mapping = {
        "VERDADEIRO": "VERDADEIRO",
        "VERDADEIRAS": "VERDADEIRO",
        "FALSO": "FALSO",
        "FALSAS": "FALSO",
        "IMPRECISO": "IMPRECISO",
        "IMPRECISAS": "IMPRECISO",
        "NÃO VERIFICÁVEL": "NAO_VERIFICAVEL",
        "NAO VERIFICÁVEL": "NAO_VERIFICAVEL",
        "NÃO VERIFICÁVEIS": "NAO_VERIFICAVEL",
        "NAO VERIFICÁVEIS": "NAO_VERIFICAVEL",
        "OPINIÃO": "OPINIAO",
        "OPINIAO": "OPINIAO",
        "OPINIÃO/NÃO VERIFICÁVEL": "OPINIAO",
    }
    return mapping.get(raw, raw)


def parse_analysis_format1(text):
    """Parse [AFIRMAÇÃO]: style (Zema, Flavio)."""
    claims = []

    # Split into blocks by numbered entries (### N. or just N.)
    # Match: "### N. TITLE" or "N. TITLE" at start of line
    blocks = re.split(r'(?=(?:^|\n)(?:###?\s*)?\d+\.)', text)

    for block in blocks:
        # Extract number from header
        num_m = re.match(r'(?:###?\s*)?(\d+)\.\s*(.*)', block.strip())
        if not num_m:
            continue

        num = int(num_m.group(1))
        title = num_m.group(2).strip()

        # Extract fields
        quote_m = re.search(r'\[AFIRMAÇÃO\]:\s*"(.*?)"', block, re.DOTALL)
        if not quote_m:
            # Some entries (like 53-57 in Flavio) have quote as title
            quote_m = re.search(r'\[AFIRMAÇÃO\]:\s*(.*?)(?=\n)', block, re.DOTALL)

        class_m = re.search(r'\[CLASSIFICAÇÃO\]:\s*(.+)', block)
        verif_m = re.search(r'\[VERIFICAÇÃO\]:\s*(.*?)(?=\n\s*\[FONTES\]|\Z)', block, re.DOTALL)
        sources_m = re.search(r'\[FONTES\]:\s*(.*?)(?=\n\s*\[OBSERVAÇÕES\]|\Z)', block, re.DOTALL)
        notes_m = re.search(r'\[OBSERVAÇÕES\]:\s*(.*?)$', block, re.DOTALL)

        if not class_m:
            continue

        # Skip entries after "FONTES PRINCIPAIS" section (sources list)
        if num > 100:
            continue

        # For entries without [AFIRMAÇÃO], use the title as quote
        quote = ""
        if quote_m:
            quote = quote_m.group(1).strip()
        elif title:
            # Title itself is the quote (e.g. entries 53-57)
            quote = title.strip()

        # Clean up quote
        quote = quote.strip('"').strip('"').strip('"')
        quote = re.sub(r'\s+', ' ', quote)

        # Handle combined classifications like "OPINIÃO/FALSO"
        raw_class = class_m.group(1).strip()
        # Take first classification if combined
        if "—" in raw_class:
            raw_class = raw_class.split("—")[0].strip()
        if "/" in raw_class and "NÃO" not in raw_class:
            raw_class = raw_class.split("/")[0].strip()

        claims.append({
            "id": num,
            "title": title if title and not quote_m else "",
            "quote": quote,
            "classification": normalize_classification(raw_class),
            "verification": verif_m.group(1).strip() if verif_m else "",
            "sources": sources_m.group(1).strip() if sources_m else "",
            "notes": notes_m.group(1).strip() if notes_m else "",
        })

    return claims


def parse_analysis_format2(text):
    """Parse **Afirmação do candidato:** style (Caiado, Renan, Lula)."""
    claims = []
    # Split by ### N or ### [N] headers
    blocks = re.split(r'(?=^###\s*\[?\d+\]?)', text, flags=re.MULTILINE)

    for block in blocks:
        header_m = re.match(r'###\s*\[?(\d+)\]?\s*(.*)', block)
        if not header_m:
            continue

        num = int(header_m.group(1))
        title = header_m.group(2).strip()

        quote_m = re.search(r'\*\*Afirmação(?:\s+do candidato)?:\*\*\s*"(.*?)"', block, re.DOTALL)
        if not quote_m:
            quote_m = re.search(r'\*\*Afirmação(?:\s+do candidato)?:\*\*\s*(.*?)(?=\n)', block, re.DOTALL)

        class_m = re.search(r'\*\*Classificação:\*\*\s*(.+)', block)
        verif_m = re.search(r'\*\*Verificação:\*\*\s*\n(.*?)(?=\n\*\*Fonte)', block, re.DOTALL)
        sources_m = re.search(r'\*\*Fonte\(s\):\*\*\s*\n(.*?)(?=\n\*\*Observa)', block, re.DOTALL)
        notes_m = re.search(r'\*\*Observações:\*\*\s*\n(.*?)$', block, re.DOTALL)
        timestamp_m = re.search(r'\*\*Timestamp:\*\*\s*\[?(\d+:\d+(?::\d+)?)\]?', block)

        if not quote_m or not class_m:
            continue

        quote = quote_m.group(1).strip()
        # Clean up multi-line quotes
        quote = re.sub(r'\s+', ' ', quote)

        claim = {
            "id": num,
            "title": title,
            "quote": quote,
            "classification": normalize_classification(class_m.group(1)),
            "verification": verif_m.group(1).strip() if verif_m else "",
            "sources": sources_m.group(1).strip() if sources_m else "",
            "notes": notes_m.group(1).strip() if notes_m else "",
        }
        if timestamp_m:
            claim["timestamp"] = timestamp_m.group(1)

        claims.append(claim)

    return claims


def parse_summary(text):
    """Extract summary stats from the analysis text - only from the RESUMO section."""
    summary = {}
    # Extract only the RESUMO/summary section (first ~30 lines)
    lines = text.split('\n')
    summary_text = ""
    in_summary = False
    for line in lines[:40]:
        if re.match(r'^(RESUMO|SUMMARY|## Resumo)', line, re.IGNORECASE):
            in_summary = True
        if in_summary:
            summary_text += line + "\n"
        if in_summary and line.strip() == "---":
            break

    if not summary_text:
        # Fallback: use first 20 lines
        summary_text = "\n".join(lines[:20])

    patterns = [
        (r'TOTAL DE (?:AFIRMAÇÕES|ALEGAÇÕES):\s*(\d+)', "total"),
        (r'VERDADEIR[AO]S?:\s*(\d+)', "VERDADEIRO"),
        (r'FALS[AO]S?:\s*(\d+)', "FALSO"),
        (r'IMPRECIS[AO]S?:\s*(\d+)', "IMPRECISO"),
        (r'N[ÃA]O VERIFIC[ÁA]VEL(?:/OPINIÃO)?:\s*(\d+)', "NAO_VERIFICAVEL"),
        (r'OPINI[ÃA]O(?:/N[ÃA]O VERIFIC[ÁA]VEL)?:\s*(\d+)', "OPINIAO"),
    ]
    for pattern, key in patterns:
        m = re.search(pattern, summary_text, re.IGNORECASE)
        if m:
            summary[key] = int(m.group(1))
    return summary


def extract_title_from_header(text):
    """Extract candidate name and party from analysis header."""
    # Try various header patterns
    patterns = [
        r'Entrevistado:\s*(.+?)\s*\((.+?)\)',
        r'Candidato:\s*(.+?)\s*\((.+?)\)',
        r'Verificação de Fatos.*?[-—]\s*(?:Entrevista com\s*)?(.+?)\s*\((.+?)\)',
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1).strip(), m.group(2).strip()
    return None, None


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    candidates_data = []

    for cand_info in CANDIDATES:
        meta = load_meta(cand_info)
        if not meta:
            print(f"SKIP: {cand_info['slug']} - no meta.json")
            continue

        analysis_path = ANALYSES_DIR / cand_info["analysis_file"]
        if not analysis_path.exists():
            print(f"SKIP: {cand_info['slug']} - no analysis file")
            continue

        with open(analysis_path, "r", encoding="utf-8") as f:
            analysis_text = f.read()

        # Detect format
        if "[AFIRMAÇÃO]:" in analysis_text:
            claims = parse_analysis_format1(analysis_text)
        else:
            claims = parse_analysis_format2(analysis_text)

        summary = parse_summary(analysis_text)

        # Extract from meta - handle different schemas
        if "candidato" in meta:
            candidate_name = meta["candidato"]
            party = meta["partido"]
            interview_date = meta.get("data_entrevista", "")
        else:
            candidate_name = meta.get("candidate", "")
            party = meta.get("party", "")
            interview_date = meta.get("interview_date", "")

        # Compute summary directly from parsed claims (more reliable than regex)
        computed_summary = {"total": len(claims)}
        for c in claims:
            cls = c["classification"]
            if cls not in computed_summary:
                computed_summary[cls] = 0
            computed_summary[cls] += 1

        cand_data = {
            "slug": cand_info["slug"],
            "event_name": get_event_name(cand_info["slug"]),
            "name": candidate_name,
            "party": party,
            "interview_date": interview_date,
            "color": cand_info["color"],
            "summary": computed_summary,
            "claims": claims,
        }
        candidates_data.append(cand_data)
        print(f"OK: {candidate_name} ({party}) - {len(claims)} claims")

    # Sort by interview date
    candidates_data.sort(key=lambda x: x["interview_date"])

    # Generate JS
    js_content = "// Auto-generated by generate-data.py - DO NOT EDIT\n"
    js_content += f"// Generated from {len(candidates_data)} candidate analyses\n\n"
    js_content += "const CANDIDATES = " + json.dumps(candidates_data, ensure_ascii=False, indent=2) + ";\n"

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\nGenerated {OUTPUT} with {len(candidates_data)} candidates")


if __name__ == "__main__":
    main()
