#!/usr/bin/env python3
"""Separate diarized debate transcript into per-candidate files."""

import json
import os

DATA_DIR = "data/transcripts"
OUTPUT_DIR = "data/debate-band"

CANDIDATES = {
    "CAIADO": "caiado",
    "RENAN": "renan",
    "CURY": "cury",
}


def format_timestamp(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(f"{DATA_DIR}/debate-band-diarized.json") as f:
        segments = json.load(f)

    # Group consecutive segments by speaker
    candidate_segments = {name: [] for name in CANDIDATES}

    current_speaker = None
    current_block = None

    for seg in segments:
        speaker = seg["speaker"]
        if speaker in CANDIDATES:
            if speaker != current_speaker:
                # New speaker block
                if current_block:
                    candidate_segments[current_speaker].append(current_block)
                current_speaker = speaker
                current_block = {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"],
                }
            else:
                # Continue current block
                current_block["end"] = seg["end"]
                current_block["text"] += " " + seg["text"]
        else:
            # Not a candidate - save any pending block
            if current_block:
                candidate_segments[current_speaker].append(current_block)
                current_speaker = None
                current_block = None

    # Don't forget the last block
    if current_block:
        candidate_segments[current_speaker].append(current_block)

    # Write per-candidate files
    for speaker, slug in CANDIDATES.items():
        blocks = candidate_segments[speaker]

        # Write JSON with timestamps
        json_path = f"{OUTPUT_DIR}/{slug}.json"
        with open(json_path, "w") as f:
            json.dump(blocks, f, ensure_ascii=False, indent=2)

        # Write readable text file
        txt_path = f"{OUTPUT_DIR}/{slug}.txt"
        with open(txt_path, "w") as f:
            for block in blocks:
                ts = format_timestamp(block["start"])
                f.write(f"[{ts}] {block['text']}\n\n")

        # Stats
        total_time = sum(b["end"] - b["start"] for b in blocks)
        total_blocks = len(blocks)
        print(f"{speaker:12s}: {total_blocks:3d} blocos, {int(total_time//60):2d}:{int(total_time%60):02d}")

    # Also create a version suitable for the prompt (continuous text with timestamps)
    for speaker, slug in CANDIDATES.items():
        blocks = candidate_segments[speaker]
        prompt_path = f"{OUTPUT_DIR}/{slug}-prompt.txt"
        with open(prompt_path, "w") as f:
            f.write(f"FALAS DE {speaker} NO DEBATE DA BAND (05/08/2026)\n")
            f.write(f"Formato: [timestamp] fala do candidato\n\n")
            for block in blocks:
                ts = format_timestamp(block["start"])
                f.write(f"[{ts}] {block['text']}\n\n")

    print(f"\nArquivos salvos em {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
