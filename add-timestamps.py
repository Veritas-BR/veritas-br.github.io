#!/usr/bin/env python3
"""
add-timestamps.py - Maps claims to transcript timestamps and detects context/topics.
Reads segments.json + analysis files, outputs updated data.js with timestamp and context fields.
"""

import json
import re
import os
from pathlib import Path

BASE = Path(__file__).parent
TRANSCRIPTS_DIR = BASE / "data" / "transcripts"
DEBATE_DIR = BASE / "data" / "debate-band"
ANALYSES_DIR = BASE / "data" / "analyses"
OUTPUT = BASE / "site" / "js" / "data.json"

CANDIDATES = [
    {"slug": "romeu-zema", "segments_file": "zema-segments.json", "analysis_file": "romeu-zema-2026.txt",
     "meta_file": "romeu-zema-2026-meta.json", "color": "#3B82F6"},
    {"slug": "ronaldo-caiado", "segments_file": "caiado-segments.json", "analysis_file": "ronaldo-caiado-2026.txt",
     "meta_file": "ronaldo-caiado-2026-meta.json", "color": "#10B981"},
    {"slug": "renan-santos", "segments_file": "renan-segments.json", "analysis_file": "renan-santos-2026.txt",
     "meta_file": "renan-santos-2026-meta.json", "color": "#8B5CF6"},
    {"slug": "lula", "segments_file": "lula-segments.json", "analysis_file": "lula-2026.txt",
     "meta_file": "lula-2026-meta.json", "color": "#EF4444"},
    {"slug": "flavio-bolsonaro", "segments_file": "flavio-bolsonaro-2026-segments.json",
     "analysis_file": "flavio-bolsonaro-2026.txt",
     "meta_file": "flavio-bolsonaro-2026-meta.json", "color": "#F59E0B"},
    {"slug": "augusto-cury", "segments_file": "augusto-cury-segments.json",
     "analysis_file": "augusto-cury-2026.txt",
     "meta_file": "augusto-cury-2026-meta.json", "color": "#06B6D4"},
    # Entrevistas Domingo Espetacular - Record
    {"slug": "lula-domingo-espetacular", "segments_file": "lula-domingo-espetacular-segments.json",
     "analysis_file": "lula-domingo-espetacular-2026.txt",
     "meta_file": "lula-domingo-espetacular-2026-meta.json", "color": "#EF4444"},
    {"slug": "flavio-bolsonaro-domingo-espetacular", "segments_file": "flavio-bolsonaro-domingo-espetacular-segments.json",
     "analysis_file": "flavio-bolsonaro-domingo-espetacular-2026.txt",
     "meta_file": "flavio-bolsonaro-domingo-espetacular-2026-meta.json", "color": "#F59E0B"},
    # Debate da Band - 05/08/2026
    {"slug": "caiado-debate-band", "segments_file": "debate-band/caiado.json",
     "analysis_file": "caiado-debate-band.txt",
     "meta_file": "caiado-debate-band-meta.json", "color": "#10B981"},
    {"slug": "renan-debate-band", "segments_file": "debate-band/renan.json",
     "analysis_file": "renan-debate-band.txt",
     "meta_file": "renan-debate-band-meta.json", "color": "#8B5CF6"},
    {"slug": "cury-debate-band", "segments_file": "debate-band/cury.json",
     "analysis_file": "cury-debate-band.txt",
     "meta_file": "cury-debate-band-meta.json", "color": "#06B6D4"},
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

# Topic detection keywords
TOPIC_KEYWORDS = {
    "Economia": ["PIB", "inflação", "dívida", "Selic", "juros", "imposto", "tribut", "fiscal",
                 "orçamento", "superávit", "déficit", "câmbio", "dólar", "moeda", "Banco Central",
                 "taxa", "receita", "arrecadação", "crescimento econômico", "emprego", "desemprego",
                 "salário", "renda", "pobreza", "desigualdade", "Gini", "IBGE"],
    "Segurança": ["segurança", "policia", "policiais", "crime", "crimes", "homicídio", "homicídios",
                  "violência", "violento", "morte", "mortes", "tráfico", "traficante", "facção",
                  "facções", "Comando Vermelho", "PCC", "milícia", "milícias", "encarceramento",
                  "prisão", "presídio", "sistema penitenciário", "lei de drogas"],
    "Educação": ["educação", "escola", "escolas", "professor", "professores", "aluno", "alunos",
                 "universidade", "universidades", "IF", "federal", "ENEM", "IDEB", "SAEB",
                 "currículo", "salário docente", "merenda", "transporte escolar"],
    "Saúde": ["saúde", "hospitais", "hospital", "SUS", "médico", "médicos", "enfermeiro",
              "enfermeiros", "vacina", "vacinação", "epidemia", "pandemia", "COVID", "UBS",
              "atenção primária", "farmácia", "medicamento", "doença"],
    "Infraestrutura": ["infraestrutura", "estrada", "estradas", "rodovia", "rodovias", "saneamento",
                       "água", "esgoto", "coleta", "Luz para Todos", "Casa Verde Amarela",
                       "habitação", "moradia", "concessão", "rodovias concessionadas"],
    "Política": ["governo", "presidente", "senado", "Câmara", "Deputado", "Senador", "Prefeito",
                 "Governador", "eleição", "eleições", "candidato", "candidatos", "partido",
                 "partidos", "coligação", "base aliada", "oposição", "golpe", "8 de janeiro",
                 "STF", "Supremo", "TSE", "Congresso", "reforma", "PEC", "PL", "PT", "PSD",
                 "Novo", "Missão", "Avante"],
    "Agricultura": ["agro", "agropecuária", "agronegócio", "soja", "milho", "carne", "boi",
                    "gado", "fazenda", "fazendeiro", "rural", "ruralista", "CNA", "CNAI",
                    "exportação", "produção agrícola", "safra"],
    "Relações Exteriores": ["EUA", "Estados Unidos", "China", "Rússia", "Ucrânia", "OTAN",
                            "ONU", "Brics", "Mercosul", "Argentina", "diplomacia", "internacional",
                            "comércio exterior", "exportação", "importação"],
    "Meio Ambiente": ["meio ambiente", "ambiental", "desmatamento", "Amazônia", "Cerrado",
                      "floresta", "incêndio", "queimada", "clima", "mudança climática",
                      "sustentabilidade", "energia renovável", "eólica", "solar"],
    "Tecnologia": ["tecnologia", "digital", "internet", "inteligência artificial", "IA",
                   "Bitcoin", "criptomoeda", "Pix", "fiscalização digital", "big tech",
                   "redes sociais", "regulação digital"],
}


def normalize(text):
    """Normalize text for matching: lowercase, remove punctuation, collapse spaces."""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def find_longest_match(quote_norm, segments_norm, min_len=25):
    """Find the longest substring match between quote and any segment."""
    best_match = None
    best_len = 0
    best_seg_idx = -1

    for i, seg_norm in enumerate(segments_norm):
        # Try to find the longest matching substring
        for length in range(min(min_len, len(quote_norm)), len(quote_norm) + 1):
            for start in range(len(quote_norm) - length + 1):
                substring = quote_norm[start:start + length]
                if substring in seg_norm and length > best_len:
                    best_len = length
                    best_match = substring
                    best_seg_idx = i

    return best_seg_idx, best_len


def find_quote_segment(quote, segments, threshold=0.3):
    """Find which segment(s) contain the claim quote. Returns (segment_index, match_length)."""
    quote_norm = normalize(quote)
    segments_norm = [normalize(s["text"]) for s in segments]

    # Strategy 1: Direct substring match
    for i, seg_norm in enumerate(segments_norm):
        if quote_norm in seg_norm or seg_norm in quote_norm:
            return i, len(quote_norm)

    # Strategy 2: Find longest common substring
    best_idx, best_len = find_longest_match(quote_norm, segments_norm)
    if best_len >= len(quote_norm) * threshold:
        return best_idx, best_len

    # Strategy 3: Check consecutive segments (quote may span multiple)
    for i in range(len(segments) - 2):
        combined = segments_norm[i] + " " + segments_norm[i + 1]
        if quote_norm[:30] in combined:
            return i, 30

    return -1, 0


def detect_context(segments, match_idx, window=8):
    """Detect topic by examining segments around the match."""
    if match_idx < 0:
        return "Geral"

    start = max(0, match_idx - window)
    end = min(len(segments), match_idx + window + 1)
    context_text = " ".join(s["text"] for s in segments[start:end])
    context_norm = context_text.lower()

    scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in context_norm)
        if score > 0:
            scores[topic] = score

    if scores:
        return max(scores, key=scores.get)
    return "Geral"


def format_timestamp(seconds):
    """Format seconds to MM:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"


def load_segments(slug_info):
    """Load segments.json for a candidate."""
    segments_file = slug_info["segments_file"]
    if segments_file.startswith("debate-band/"):
        path = DEBATE_DIR / segments_file.replace("debate-band/", "")
    else:
        path = TRANSCRIPTS_DIR / segments_file
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_meta(slug_info):
    """Load meta.json for a candidate."""
    path = ANALYSES_DIR / slug_info["meta_file"]
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_classification(raw):
    """Normalize classification strings."""
    raw = raw.strip().upper()
    mapping = {
        "VERDADEIRO": "VERDADEIRO", "VERDADEIRAS": "VERDADEIRO",
        "FALSO": "FALSO", "FALSAS": "FALSO",
        "IMPRECISO": "IMPRECISO", "IMPRECISAS": "IMPRECISO",
        "NÃO VERIFICÁVEL": "NAO_VERIFICAVEL", "NAO VERIFICÁVEL": "NAO_VERIFICAVEL",
        "NÃO VERIFICÁVEIS": "NAO_VERIFICAVEL", "NAO VERIFICÁVEIS": "NAO_VERIFICAVEL",
        "OPINIÃO": "OPINIAO", "OPINIAO": "OPINIAO",
        "OPINIÃO/NÃO VERIFICÁVEL": "OPINIAO",
        "NÃO VERIFICADO": "NAO_VERIFICAVEL",
    }
    return mapping.get(raw, raw)


def parse_analysis_format1(text):
    """Parse [AFIRMAÇÃO]: style (Zema, Flavio)."""
    claims = []
    blocks = re.split(r'(?=(?:^|\n)(?:###?\s*)?\d+\.)', text)

    for block in blocks:
        num_m = re.match(r'(?:###?\s*)?(\d+)\.\s*(.*)', block.strip())
        if not num_m:
            continue

        num = int(num_m.group(1))
        title = num_m.group(2).strip()

        quote_m = re.search(r'\[AFIRMAÇÃO\]:\s*"(.*?)"', block, re.DOTALL)
        if not quote_m:
            quote_m = re.search(r'\[AFIRMAÇÃO\]:\s*(.*?)(?=\n)', block, re.DOTALL)

        class_m = re.search(r'\[CLASSIFICAÇÃO\]:\s*(.+)', block)
        verif_m = re.search(r'\[VERIFICAÇÃO\]:\s*(.*?)(?=\n\s*\[FONTES\]|\Z)', block, re.DOTALL)
        sources_m = re.search(r'\[FONTES\]:\s*(.*?)(?=\n\s*\[OBSERVAÇÕES\]|\Z)', block, re.DOTALL)
        notes_m = re.search(r'\[OBSERVAÇÕES\]:\s*(.*?)$', block, re.DOTALL)

        if not class_m:
            continue
        if num > 100:
            continue

        quote = ""
        if quote_m:
            quote = quote_m.group(1).strip()
        elif title:
            quote = title.strip()

        quote = quote.strip('"').strip('"').strip('"')
        quote = re.sub(r'\s+', ' ', quote)

        raw_class = class_m.group(1).strip()
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

        if not quote_m or not class_m:
            continue

        quote = quote_m.group(1).strip()
        quote = re.sub(r'\s+', ' ', quote)

        claims.append({
            "id": num,
            "title": title,
            "quote": quote,
            "classification": normalize_classification(class_m.group(1)),
            "verification": verif_m.group(1).strip() if verif_m else "",
            "sources": sources_m.group(1).strip() if sources_m else "",
            "notes": notes_m.group(1).strip() if notes_m else "",
        })

    return claims


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    candidates_data = []

    for cand_info in CANDIDATES:
        meta = load_meta(cand_info)
        if not meta:
            print(f"SKIP: {cand_info['slug']} - no meta")
            continue

        analysis_path = ANALYSES_DIR / cand_info["analysis_file"]
        if not analysis_path.exists():
            print(f"SKIP: {cand_info['slug']} - no analysis")
            continue

        with open(analysis_path, "r", encoding="utf-8") as f:
            analysis_text = f.read()

        # Parse claims
        if "[AFIRMAÇÃO]:" in analysis_text:
            claims = parse_analysis_format1(analysis_text)
        else:
            claims = parse_analysis_format2(analysis_text)

        # Load segments
        segments = load_segments(cand_info)
        print(f"{cand_info['slug']}: {len(claims)} claims, {len(segments)} segments")

        # Map each claim to timestamp and context
        matched = 0
        for claim in claims:
            if not claim["quote"]:
                claim["timestamp"] = None
                claim["context"] = "Geral"
                continue

            seg_idx, match_len = find_quote_segment(claim["quote"], segments)

            if seg_idx >= 0:
                claim["timestamp"] = format_timestamp(segments[seg_idx]["start"])
                claim["context"] = detect_context(segments, seg_idx)
                matched += 1
            else:
                claim["timestamp"] = None
                claim["context"] = "Geral"

        print(f"  Matched {matched}/{len(claims)} claims to timestamps")

        # Get candidate info from meta
        if "candidato" in meta:
            candidate_name = meta["candidato"]
            party = meta["partido"]
            interview_date = meta.get("data_entrevista", "")
        else:
            candidate_name = meta.get("candidate", "")
            party = meta.get("party", "")
            interview_date = meta.get("interview_date", "")

        # Compute summary
        summary = {"total": len(claims)}
        for c in claims:
            cls = c["classification"]
            summary[cls] = summary.get(cls, 0) + 1

        candidates_data.append({
            "slug": cand_info["slug"],
            "event_name": get_event_name(cand_info["slug"]),
            "name": candidate_name,
            "party": party,
            "interview_date": interview_date,
            "color": cand_info["color"],
            "summary": summary,
            "claims": claims,
        })

    candidates_data.sort(key=lambda x: x["interview_date"])

    # Generate JSON
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(candidates_data, f, ensure_ascii=False, indent=2)

    print(f"\nGenerated {OUTPUT}")


if __name__ == "__main__":
    main()
