#!/usr/bin/env python3
"""
diarize.py - Speaker identification for debate transcript.
Uses pattern matching to identify moderator vs candidates.
"""

import json
import re
from pathlib import Path

BASE = Path(__file__).parent
SEGMENTS_FILE = BASE / "data" / "transcripts" / "debate-band-segments.json"
OUTPUT_FILE = BASE / "data" / "transcripts" / "debate-band-diarized.json"
OUTPUT_TXT = BASE / "data" / "transcripts" / "debate-band-formatado.txt"

# Candidate names and variations
CANDIDATES = {
    "CAIADO": ["Caiado", "Ronaldo Caiado", "governador", "governador Caiado", "Caiado,"],
    "RENAN": ["Renan", "Renan Santos", "candidato Renan", "senador"],
    "CURY": ["Cury", "Augusto Cury", "doutor", "doutor Cury", "Cury,"],
}

# Moderator patterns (things the moderator says)
MODERATOR_PATTERNS = [
    r"pergunta vai para o candidato",
    r"próxima pergunta.*candidato",
    r"Candidato\s+(Renan|Ronaldo|Augusto)",
    r"obrigad[ao],?\s*candidato",
    r"Vamos (?:agora|à próxima)",
    r"A pergunta.*(?:é|para)",
    r"(?:um )?minuto.*candidato",
    r"atenção ao tempo",
    r"por favor.*candidato",
    r"Boa noite.*você",
    r"A partir de agora",
    r"Em nome da Band",
    r"primeiro debate",
    r"regras desse debate",
    r"Vamos começar",
    r"confronto direto",
    r"considerações finais",
    r"Obrigada, obrigada",  # Adriana closing
]

# Patterns that indicate moderator is speaking
MODERATOR_ADDR = [
    r"A minha pergunta vai para",
    r"próxima pergunta vai para",
    r"Candidato\s+\w+,",
    r"Vamos.*próxima pergunta.*candidato",
    r"atenção ao tempo",
    r"por favor.*candidato",
]

# Patterns that indicate a candidate is speaking
CANDIDATE_SELF = [
    r"Eu (?:governei|vou|quero|proponho|defendo|sou|acredito|penso|acho)",
    r"Meu (?:governo|partido|projeto|plano)",
    r"Nós (?:vamos|fizemos|propomos|queremos)",
    r"Governador",  # Caiado is called governador
    r"senador",  # Renan is called senador
    r"doutor",  # Cury is called doutor
    r"Muito obrigado",  # Common response after being addressed
    r"Boa noite",  # Common opening
    r"Vou (?:responder|falar|dizer|mostrar)",
    r"Primeiro|Segundo|Terceiro|Quarto",  # Structured arguments
]

# Patterns that indicate someone is addressing Caiado (not Caiado himself)
ADDRESSING_CAIADO = [
    r"Caiado,.*(?:você|senhor|governador)",
    r"governador Caiado",
    r"Ronaldo Caiado",
]


def find_speaker_name(text, candidates_current_speaker):
    """Try to find who is being addressed or who is speaking."""
    text_clean = text.strip()

    # Check if this is a moderator statement first
    for pattern in MODERATOR_PATTERNS:
        if re.search(pattern, text_clean, re.IGNORECASE):
            return "MODERADOR"

    # Check if moderator is addressing a candidate
    for pattern in MODERATOR_ADDR:
        if re.search(pattern, text_clean, re.IGNORECASE):
            return "MODERADOR"

    # Check if someone is addressing Caiado (not Caiado himself)
    for pattern in ADDRESSING_CAIADO:
        if re.search(pattern, text_clean, re.IGNORECASE):
            return "MODERADOR"  # or could be another candidate

    # Check for candidate self-references
    for pattern in CANDIDATE_SELF:
        if re.search(pattern, text_clean, re.IGNORECASE):
            # Try to determine which candidate
            for cand_name, variations in CANDIDATES.items():
                for var in variations:
                    if re.search(r'\b' + re.escape(var) + r'\b', text_clean, re.IGNORECASE):
                        return cand_name
            # If we have a current speaker context, use it
            if candidates_current_speaker:
                return candidates_current_speaker

    return None


def diarize_segments(segments):
    """Assign speakers to segments based on patterns and context."""
    diarized = []
    current_speaker = None
    last_addressed_candidate = None
    moderator_speaking = False
    next_speaker = None  # Candidate to be introduced by moderator
    turn_count = 0

    for i, seg in enumerate(segments):
        text = seg["text"].strip()
        start = seg["start"]

        # Skip very short segments or repeated single words (likely noise)
        if len(text) < 5 or re.match(r'^(Um\.\s*){3,}', text):
            speaker = "SILENCIO"
            diarized.append({**seg, "speaker": speaker})
            continue

        # Try to identify speaker from text patterns
        detected = find_speaker_name(text, current_speaker if current_speaker in CANDIDATES else None)

        if detected == "MODERADOR":
            current_speaker = "MODERADOR"
            moderator_speaking = True
            turn_count = 0

            # Check if moderator is introducing a candidate
            for cand_name, variations in CANDIDATES.items():
                for var in variations:
                    if re.search(r'\b' + re.escape(var) + r'\b', text, re.IGNORECASE):
                        last_addressed_candidate = cand_name
                        # Check if this is an introduction (e.g., "a próxima pergunta vai para o candidato X")
                        if re.search(r'(?:próxima|seguinte|próxima pergunta|pergunta vai|pergunta será).*' + re.escape(var), text, re.IGNORECASE):
                            next_speaker = cand_name
                            moderator_speaking = False
                            break
                        break

        elif detected in CANDIDATES:
            current_speaker = detected
            moderator_speaking = False
            turn_count = 0

        elif detected is None:
            # No pattern match - use context
            if moderator_speaking:
                # Check if this looks like a question (ends with ?)
                if "?" in text:
                    current_speaker = "MODERADOR"
                elif turn_count > 0 and turn_count < 15:
                    # Still moderator speaking (short follow-up)
                    pass
                else:
                    # Likely candidate responding
                    if next_speaker:
                        current_speaker = next_speaker
                        next_speaker = None
                        moderator_speaking = False
                        turn_count = 0
                    elif last_addressed_candidate:
                        current_speaker = last_addressed_candidate
                        moderator_speaking = False
                        turn_count = 0
            else:
                # Candidate still speaking (continuation)
                turn_count += 1

        diarized.append({**seg, "speaker": current_speaker or "DESCONHECIDO"})
        turn_count += 1

    return diarized


def format_timestamp(seconds):
    """Format seconds to MM:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"


def merge_consecutive(diarized, max_duration=60):
    """Merge consecutive segments from same speaker, but split if too long."""
    if not diarized:
        return []

    merged = [diarized[0].copy()]
    for seg in diarized[1:]:
        last = merged[-1]
        duration = seg["end"] - last["start"]
        if seg["speaker"] == last["speaker"] and duration < max_duration:
            last["text"] = last["text"] + " " + seg["text"]
            last["end"] = seg["end"]
        else:
            merged.append(seg.copy())
    return merged


def main():
    with open(SEGMENTS_FILE, "r", encoding="utf-8") as f:
        segments = json.load(f)

    print(f"Loaded {len(segments)} segments")

    # Diarize
    diarized = diarize_segments(segments)
    print(f"Diarized {len(diarized)} segments")

    # Count speakers
    speaker_counts = {}
    for seg in diarized:
        sp = seg["speaker"]
        speaker_counts[sp] = speaker_counts.get(sp, 0) + 1
    print("Speaker distribution:")
    for sp, count in sorted(speaker_counts.items(), key=lambda x: -x[1]):
        print(f"  {sp}: {count} segments")

    # Merge consecutive segments
    merged = merge_consecutive(diarized)
    print(f"Merged to {len(merged)} turns")

    # Save diarized JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    # Save formatted text
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write("# Transcrição: Debate Band - Presidenciáveis 2026\n")
        f.write("# Fonte: https://www.youtube.com/watch?v=E6raYIQqn0Y\n")
        f.write("# Modelo: Whisper large-v3-turbo (Apple Silicon MPS)\n")
        f.write("# Participantes: Caiado (PSD), Renan Santos (Missão), Augusto Cury (Avante)\n")
        f.write("# Ausentes: Lula, Flávio Bolsonaro, Zema\n")
        f.write("# Diarização: Identificação automática por padrões de fala\n\n")
        f.write("=" * 60 + "\n\n")

        for seg in merged:
            ts = format_timestamp(seg["start"])
            speaker = seg["speaker"]
            text = seg["text"].strip()
            f.write(f"[{ts}] {speaker}:\n{text}\n\n")

    print(f"\nSaved: {OUTPUT_FILE}")
    print(f"Saved: {OUTPUT_TXT}")

    # Show sample of first 10 turns
    print("\n--- Sample (first 10 turns) ---")
    for seg in merged[:10]:
        ts = format_timestamp(seg["start"])
        print(f"[{ts}] {seg['speaker']}: {seg['text'][:80]}...")


if __name__ == "__main__":
    main()
