#!/usr/bin/env python3
"""Merge reclassifications from revision files into main analysis files.
Uses claim header matching to locate and update classification lines safely."""

import re
from pathlib import Path

BASE = Path(__file__).parent
ANALYSES_DIR = BASE / "data" / "analyses"

# (analysis_file, claim_id_pattern, new_classification)
# claim_id_pattern matches both "### N" and "### [N]"
CHANGES = [
    ("romeu-zema-2026.txt", 1, "IMPRECISO"),
    ("romeu-zema-2026.txt", 14, "VERDADEIRO"),
    ("romeu-zema-2026.txt", 19, "IMPRECISO"),
    ("ronaldo-caiado-2026.txt", 11, "VERDADEIRO"),
    ("ronaldo-caiado-2026.txt", 12, "IMPRECISO"),
    ("ronaldo-caiado-2026.txt", 16, "VERDADEIRO"),
    ("ronaldo-caiado-2026.txt", 22, "IMPRECISO"),
    ("renan-santos-2026.txt", 13, "IMPRECISO"),
    ("renan-santos-2026.txt", 25, "VERDADEIRO"),
    ("lula-2026.txt", 4, "FALSO"),
    ("lula-2026.txt", 8, "VERDADEIRO"),
    ("flavio-bolsonaro-2026.txt", 5, "IMPRECISO"),
    ("flavio-bolsonaro-2026.txt", 14, "IMPRECISO"),
    ("augusto-cury-2026.txt", 13, "VERDADEIRO"),
    ("augusto-cury-2026.txt", 19, "VERDADEIRO"),
    ("renan-debate-band.txt", 4, "IMPRECISO"),
    ("renan-debate-band.txt", 10, "VERDADEIRO"),
    ("renan-debate-band.txt", 15, "IMPRECISO"),
    ("cury-debate-band.txt", 1, "IMPRECISO"),
]


def normalize(raw):
    raw = raw.strip().upper()
    m = {
        "VERDADEIRO": "VERDADEIRO", "VERDADEIRAS": "VERDADEIRO",
        "FALSO": "FALSO", "FALSAS": "FALSO",
        "IMPRECISO": "IMPRECISO", "IMPRECISAS": "IMPRECISO",
        "NÃO VERIFICÁVEL": "NAO_VERIFICAVEL", "NAO VERIFICÁVEL": "NAO_VERIFICAVEL",
        "OPINIÃO": "OPINIAO", "OPINIAO": "OPINIAO",
    }
    return m.get(raw, raw)


def update_claim_classification(text, claim_id, new_class):
    """Find the claim block by header number and update its classification line.
    Returns (new_text, changed) tuple."""
    # Split into claim blocks by header patterns
    # Match both "### 12" and "### [12]" at start of line
    header_pattern = re.compile(r'^(###\s*\[?\d+\]?)\s*$', re.MULTILINE)
    
    headers = list(header_pattern.finditer(text))
    
    for i, hdr in enumerate(headers):
        # Extract the number from this header
        num_match = re.search(r'\d+', hdr.group(0))
        if not num_match:
            continue
        num = int(num_match.group(0))
        
        if num != claim_id:
            continue
        
        # Found the header. Get the block (from this header to next header or end)
        start = hdr.start()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        block = text[start:end]
        
        # Find the classification line within this block
        class_match = re.search(r'(\*\*Classificação:\*\*\s*)(.+)', block)
        if not class_match:
            continue
        
        old_class_raw = class_match.group(2).strip()
        old_class = normalize(old_class_raw)
        
        if old_class == normalize(new_class):
            return text, False
        
        # Replace the classification value in the block
        old_text = class_match.group(2)
        new_block = block[:class_match.start(2)] + new_class + block[class_match.end(2):]
        
        new_text = text[:start] + new_block + text[end:]
        return new_text, True
    
    return text, False


def main():
    total = 0
    
    for filename, claim_id, new_class in CHANGES:
        filepath = ANALYSES_DIR / filename
        if not filepath.exists():
            print(f"SKIP: {filename} not found")
            continue
        
        text = filepath.read_text(encoding="utf-8")
        new_text, changed = update_claim_classification(text, claim_id, new_class)
        
        if changed:
            filepath.write_text(new_text, encoding="utf-8")
            print(f"  {filename} #{claim_id}: → {new_class}")
            total += 1
        else:
            print(f"  {filename} #{claim_id}: no change needed")
    
    print(f"\nTotal changes: {total}")


if __name__ == "__main__":
    main()
