# Contrafatos Não Existem Argumentos

Fact-checking analysis of presidential candidates' interviews and debates in Brazil's 2026 elections.

> **Disclaimer**: This project is a technical analysis of facts presented in public interviews. It does not constitute endorsement, support, or opposition to any candidate.

## Goal

To provide verifiable information so voters can make their own informed decisions, without recommending or endorsing any candidate. Per TSE (Brazilian Electoral Court) rules, we do not rank candidates or suggest who is better or worse.

## Principles

- **Full transparency** — Transcript, prompt, response, and model are all public and verifiable
- **Neutrality** — Fact-checking AI is free from political bias
- **No rankings** — We do not compare candidates (prohibited by TSE)
- **Open data** — All data is available for download and reuse

## Candidates Analyzed

### Jornal Nacional Interviews (Aug 24–29, 2026)

| Candidate | Party | Date |
|-----------|-------|------|
| Romeu Zema | Novo | Aug 24 |
| Ronaldo Caiado | PSD | Aug 25 |
| Renan Santos | Missão | Aug 26 |
| Lula | PT | Aug 27 |
| Flávio Bolsonaro | PL | Aug 28 |
| Augusto Cury | Avante | Aug 29 |

### Band Debate (Aug 5, 2026)

| Candidate | Party |
|-----------|-------|
| Ronaldo Caiado | PSD |
| Renan Santos | Missão |
| Augusto Cury | Avante |

## Tech Stack

| Step | Tool |
|------|------|
| Audio download | yt-dlp (Globoplay/Globo) |
| Transcription | Whisper large-v3-turbo (OpenAI, local) |
| Fact-checking | MiMo 2.5 (via opencode) |
| Speaker diarization | Custom Python script |
| Website | Pure HTML/CSS/JS + Tailwind CSS |
| Hosting | GitHub Pages |

## Project Structure

```
contrafatosnaoexistemargumentos/
├── pipeline.py              # Parallel download + transcription
├── generate-data.py         # Generates data.json from analysis files
├── add-timestamps.py        # Adds timestamps + topic detection
├── diarize.py               # Speaker diarization (debates)
├── split-debate.py          # Splits debate by candidate
├── prompts/
│   └── fact-check-v1.txt    # Fact-checking prompt
├── data/
│   ├── raw/                 # Downloaded audio (temporary)
│   ├── transcripts/         # Transcripts .txt, .srt, -segments.json
│   ├── analyses/            # Analysis .txt + metadata .json
│   └── debate-band/         # Debate speech split by candidate
└── site/                    # Static site
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── data.json         # Consolidated data
    │   ├── app.js           # SPA router + rendering
    │   └── charts.js        # Charts (Canvas)
    └── dados/               # Downloadable files
```

## How to Run

### Prerequisites

- Python 3.14+
- yt-dlp
- openai-whisper (with PyTorch + MPS/CUDA)

### 1. Download and Transcription

```bash
# Activate virtual environment
source venv/bin/activate

# Download and transcribe an interview
python pipeline.py "GLOBE_URL" -o data/raw -j 2

# Example: Zema's interview
python pipeline.py "https://g1.globo.com/jornal-nacional/noticia/2026/08/24/romeu-zema-novo-e-entrevistado-na-globo-veja-integra.ghtml" -o data/raw -j 2
```

### 2. Generate Site Data

```bash
# Generate data.json from analysis files
python generate-data.py

# Add timestamps and topic detection
python add-timestamps.py
```

### 3. Run Site Locally

```bash
cd site
python3 -m http.server 8080
# Open http://localhost:8080
```

## Verification Methodology

### Pipeline

1. **Download** — Audio downloaded from Globoplay via yt-dlp
2. **Transcription** — Whisper large-v3-turbo model running locally (Apple Silicon MPS)
3. **Fact-checking** — Each factual claim is verified against official sources by AI
4. **Publication** — All data is published for independent verification

### Classifications

| Classification | Meaning |
|----------------|---------|
| **Verdadeiro** (True) | Confirmed by official and verifiable sources |
| **Impreciso** (Imprecise) | Contains true elements, but distorts or omits information |
| **Falso** (False) | Contradicted by available official evidence |
| **Não verificável** (Unverifiable) | Insufficient official data to confirm or refute |
| **Opinião** (Opinion) | Personal opinion or value judgment, not a verifiable fact |

### Sources Used

- IBGE (Brazilian Institute of Geography and Statistics)
- TSE (Superior Electoral Court)
- Central Bank of Brazil
- IPEA (Institute for Applied Economic Research)
- News outlets: G1, Folha de S.Paulo, O Globo, Valor Econômico

### Topic Detection

Claims are automatically categorized by topic:

- Economy
- Security
- Education
- Healthcare
- Infrastructure
- Politics
- Agriculture
- Foreign Relations
- Technology

## Website Features

- **By-candidate view** — All claims from a candidate across all events
- **By-event view** — Claims grouped by interview or debate
- **Charts** — Classification distribution (bar + donut) and topic radar
- **Filters** — Filter claims by classification
- **Dark mode** — Light/dark theme with persistence
- **Downloads** — Transcripts, analyses, and prompt available for download
- **Responsive** — Works on desktop and mobile

## Data

All data is available in the `site/dados/` directory for direct download:

- Full transcripts (`.txt`)
- Verification analyses (`.txt`)
- Prompt used (`.txt`)

## License

All data is available under a Creative Commons license. You may download, redistribute, and adapt the data, provided you cite the source.

## Legal Notice

This verification is a technical analysis of facts presented in public interviews. It does not constitute endorsement, support, or opposition to any candidate. The interviews analyzed were broadcast by TV Globo and Band as part of 2026 presidential candidate interviews and debates.
