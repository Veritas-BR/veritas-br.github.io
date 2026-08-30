#!/usr/bin/env python3
"""
Baixa e transcreve entrevistas presidenciais da Globo (Eleições 2026).
Rodagem em paralelo (download + transcrição).

Uso:
    python3 pipeline.py                    # Todas as pendentes
    python3 pipeline.py -c zema            # Um candidato
    python3 pipeline.py -l                 # Listar status
    python3 pipeline.py -j 3               # 3 threads de download
    python3 pipeline.py -s                 # Só baixar áudio
"""

import subprocess
import sys
import json
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = Path(__file__).parent
VENV_PYTHON = BASE_DIR / "venv" / "bin" / "python3"

ENTREVISTAS = {
    "zema": {
        "candidato": "Romeu Zema",
        "partido": "Novo",
        "data": "2026-08-24",
        "url": "https://g1.globo.com/jornal-nacional/noticia/2026/08/24/romeu-zema-novo-e-entrevistado-na-globo-veja-integra.ghtml",
    },
    "caiado": {
        "candidato": "Ronaldo Caiado",
        "partido": "PSD",
        "data": "2026-08-25",
        "url": "https://g1.globo.com/jornal-nacional/noticia/2026/08/25/ronaldo-caiado-psd-e-entrevistado-na-globo-veja-integra.ghtml",
    },
    "renan": {
        "candidato": "Renan Santos",
        "partido": "Missão",
        "data": "2026-08-26",
        "url": "https://g1.globo.com/jornal-nacional/noticia/2026/08/26/renan-santos-missao-e-entrevistado-na-globo-veja-integra.ghtml",
    },
    "lula": {
        "candidato": "Lula",
        "partido": "PT",
        "data": "2026-08-27",
        "url": "https://g1.globo.com/jornal-nacional/noticia/2026/08/27/lula-pt-e-entrevistado-na-globo-veja-integra.ghtml",
    },
    "augusto-cury": {
        "candidato": "Augusto Cury",
        "partido": "Avante",
        "data": "2026-08-29",
        "url": "https://g1.globo.com/jornal-nacional/noticia/2026/08/29/augusto-cury-avante-e-entrevistado-na-globo-veja-integra.ghtml",
    },
}


def log(slug, msg, level="INFO"):
    cores = {"INFO": "\033[36m", "OK": "\033[32m", "ERRO": "\033[31m", "AVISO": "\033[33m"}
    tag = f"{cores.get(level, '')}[{level}]\033[0m"
    print(f"{tag} [{slug}] {msg}", flush=True)


def verificar_deps():
    erros = []
    try:
        subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True)
    except Exception:
        erros.append("yt-dlp (brew install yt-dlp)")
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except Exception:
        erros.append("ffmpeg (brew install ffmpeg)")
    if not VENV_PYTHON.exists():
        erros.append("venv (python3 -m venv venv && source venv/bin/activate && pip install openai-whisper)")
    return erros


def baixar(slug, info):
    audio_dir = BASE_DIR / "data" / "raw"
    audio_dir.mkdir(parents=True, exist_ok=True)
    output = audio_dir / f"{slug}.mp3"

    if output.exists():
        log(slug, f"Áudio já existe: {output.name}", "AVISO")
        return output

    log(slug, f"Baixando {info['candidato']}...")
    r = subprocess.run(
        [
            "yt-dlp",
            "-x", "--audio-format", "mp3", "--audio-quality", "0",
            "--playlist-items", "1",
            "-o", str(audio_dir / f"{slug}.%(ext)s"),
            info["url"],
        ],
        capture_output=True, text=True, timeout=1800,
    )
    if r.returncode != 0:
        log(slug, f"Falha no download: {r.stderr[-200:]}", "ERRO")
        return None

    if not output.exists():
        log(slug, "Arquivo não criado", "ERRO")
        return None

    size = output.stat().st_size / 1024 / 1024
    log(slug, f"Salvo: {output.name} ({size:.1f}MB)", "OK")
    return output


def transcrever(slug, info):
    tx_dir = BASE_DIR / "data" / "transcripts"
    tx_dir.mkdir(parents=True, exist_ok=True)
    txt = tx_dir / f"{slug}.txt"
    srt = tx_dir / f"{slug}.srt"
    seg = tx_dir / f"{slug}-segments.json"
    fmt = tx_dir / f"{slug}-formatado.txt"

    if txt.exists() and srt.exists():
        log(slug, f"Transcrição já existe", "AVISO")
        return txt

    audio = BASE_DIR / "data" / "raw" / f"{slug}.mp3"
    if not audio.exists():
        log(slug, f"Áudio não encontrado", "ERRO")
        return None

    log(slug, f"Transcrevendo (leva ~7min)...")

    script = f'''
import whisper, json, time

start = time.time()
model = whisper.load_model("large-v3-turbo", device="mps")
print(f"Modelo carregado em {{time.time()-start:.1f}}s")

start = time.time()
result = model.transcribe("{audio}", language="pt", verbose=False)
print(f"Transcrito em {{time.time()-start:.1f}}s")

with open("{txt}", "w") as f:
    f.write(result["text"])

segs = [{{"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"]}} for s in result["segments"]]
with open("{seg}", "w") as f:
    json.dump(segs, f, ensure_ascii=False, indent=2)

with open("{srt}", "w") as f:
    for s in result["segments"]:
        sh,sm,ss = int(s["start"]//3600), int(s["start"]%3600//60), int(s["start"]%60)
        eh,em,es = int(s["end"]//3600), int(s["end"]%3600//60), int(s["end"]%60)
        f.write(f"{{s['id']+1}}\\n{{sh:02d}}:{{sm:02d}}:{{ss:02d}},000 --> {{eh:02d}}:{{em:02d}}:{{es:02d}},000\\n{{s['text'].strip()}}\\n\\n")

with open("{fmt}", "w") as f:
    f.write("# Transcrição: {info['candidato']} ({info['partido']}) - Globo {info['data']}\\n")
    f.write("# Modelo: Whisper large-v3-turbo\\n\\n")
    block = []
    for s in segs:
        block.append(s["text"].strip())
        if len(block) >= 3 or s["text"].strip().endswith((".", "!", "?", ":")):
            f.write(f"[{{int(s['start']//60):02d}}:{{int(s['start']%60):02d}}] {{' '.join(block)}}\\n\\n")
            block = []
    if block:
        f.write(f"[{{int(segs[-1]['start']//60):02d}}:{{int(segs[-1]['start']%60):02d}}] {{' '.join(block)}}\\n")

print(f"OK: {{len(result['text'])}} chars, {{len(segs)}} segmentos")
'''
    r = subprocess.run(
        [str(VENV_PYTHON), "-c", script],
        capture_output=True, text=True, cwd=str(BASE_DIR), timeout=3600,
    )
    print(r.stdout, end="")
    if r.returncode != 0:
        log(slug, f"Erro na transcrição: {r.stderr[-300:]}", "ERRO")
        return None

    log(slug, f"Transcrição salva", "OK")
    return txt


def processar(slug, info, skip_transcription=False):
    audio = baixar(slug, info)
    if not audio:
        return slug, False

    if not skip_transcription:
        tx = transcrever(slug, info)
        if not tx:
            return slug, False

    return slug, True


def listar():
    print(f"{'slug':20s} | {'candidato':20s} | {'partido':8s} | áudio | transc")
    print("-" * 75)
    for slug, info in ENTREVISTAS.items():
        a = "✓" if (BASE_DIR / "data" / "raw" / f"{slug}.mp3").exists() else "✗"
        t = "✓" if (BASE_DIR / "data" / "transcripts" / f"{slug}.txt").exists() else "✗"
        print(f"{slug:20s} | {info['candidato']:20s} | {info['partido']:8s} |   {a}   |   {t}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("-c", "--candidato", help="Processar um candidato (slug)")
    p.add_argument("-l", "--list", action="store_true", help="Listar status")
    p.add_argument("-s", "--skip-transcription", action="store_true", help="Só baixar áudio")
    p.add_argument("-j", "--jobs", type=int, default=2, help="Threads paralelas (default: 2)")
    args = p.parse_args()

    if args.list:
        listar()
        return

    erros = verificar_deps()
    if erros:
        print("Dependências faltantes:")
        for e in erros:
            print(f"  - {e}")
        sys.exit(1)

    candidatos = ENTREVISTAS
    if args.candidato:
        if args.candidato not in ENTREVISTAS:
            print(f"Slug '{args.candidato}' não existe. Use -l")
            sys.exit(1)
        candidatos = {args.candidato: ENTREVISTAS[args.candidato]}

    print(f"\nProcessando {len(candidatos)} entrevista(s) com {args.jobs} thread(s)...\n")

    resultados = {}
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {
            pool.submit(processar, slug, info, args.skip_transcription): slug
            for slug, info in candidatos.items()
        }
        for future in as_completed(futures):
            slug, ok = future.result()
            resultados[slug] = ok

    print(f"\n{'='*50}")
    print("Resultado:")
    for slug, ok in resultados.items():
        s = "\033[32m✓\033[0m" if ok else "\033[31m✗\033[0m"
        print(f"  {s} {slug}")
    print()


if __name__ == "__main__":
    main()
