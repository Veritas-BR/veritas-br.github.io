# ARQUITETURA.md

> Guia rápido para IAs e desenvolvedores. Este documento mapeia a estrutura do projeto para que você não precise ler tudo.

## O que é este projeto

Verificador de fatos para as eleições brasileiras de 2026. Analisa falas de candidatos em entrevistas (Jornal Nacional) e debates (Band), classificando afirmações como VERDADEIRO, FALSO, IMPRECISO, NAO_VERIFICAVEL ou OPINIAO. Publica resultados em site estático com total transparência.

**Neutralidade política é obrigatória** — sem rankings, sem endossos (regras TSE).

## Fluxo de Dados

```
Áudio (Globoplay)
       ↓
[pipeline.py] ─── yt-dlp download + Whisper transcrição (local, Apple Silicon MPS)
       ↓
Transcrições (.txt, .srt, -segments.json)
       ↓
[LLM] ─── MiMo 2.5 fact-check via prompts/
       ↓
Análises (.txt) + Metadados (-meta.json)
       ↓
[add-timestamps.py] ─── Mapeia timestamps + detecta temas
       ↓
[generate-data.py] ─── Consolida em site/js/data.json
       ↓
Site Estático (GitHub Pages)
```

## Estrutura de Diretórios

| Caminho | Conteúdo |
|---------|----------|
| `data/raw/` | Áudios MP3 baixados |
| `data/transcripts/` | Transcrições: `.txt`, `.srt`, `-segments.json`, `-formatado.txt` |
| `data/analyses/` | Resultados do fact-check: `.txt` + `-meta.json` |
| `data/debate-band/` | Debates divididos por candidato |
| `data/meta/` | Metadados dos candidatos (JSON) |
| `site/` | Site estático completo |
| `site/js/` | `app.js` (SPA), `charts.js`, `data.json`, `widget.js` |
| `site/css/` | `style.css` |
| `site/dados/` | Arquivos para download (análises, transcrições, prompts) |
| `prompts/` | Prompts de fact-checking (v1, v2, v3-revision) |
| `venv/` | Ambiente Python com Whisper + PyTorch |

## Scripts Principais

| Script | Função | Quando usar |
|--------|--------|-------------|
| `pipeline.py` | Download de áudio + transcrição com Whisper | Processar novo vídeo |
| `generate-data.py` | Consolida análises em `data.json` | Após análises prontas |
| `add-timestamps.py` | Mapeia afirmações a timestamps + detecta temas | Após análises prontas |
| `diarize.py` | Diarização de debate (regex por moderador/candidato) | Debates Band |
| `split-debate.py` | Divide debate diarizado por candidato | Após diarize.py |
| `merge-revisions.py` | Aplica reclassificações de classificação | Ajustes pontuais (raro) |

## Site Estático (`site/`)

- **SPA com hash routing**: `#/candidato/...`, `#/evento/...`, `#/busca`, `#/estatisticas`
- **App principal**: `site/js/app.js` (~1.470 linhas) — roteamento, renderização, filtros, share cards
- **Gráficos**: `site/js/charts.js` — Canvas puro (barra, donut, radar por tema)
- **Dados**: `site/js/data.json` — gerado por `add-timestamps.py`
- **Estilo**: Tailwind CSS via CDN + `site/css/style.css`
- **Cache**: localStorage com TTL de 1 hora para data.json
- **Sem build step** — arquivos estáticos puros, servidos direto

## Tecnologias-Chave

| Componente | Tecnologia |
|------------|------------|
| Transcrição | OpenAI Whisper `large-v3-turbo` (local, MPS Apple Silicon) |
| Fact-checking | MiMo 2.5 (via opencode) |
| Download | yt-dlp |
| Frontend | HTML + Tailwind CSS + JS vanilla |
| Gráficos | Canvas API (sem biblioteca) |
| Hospedagem | GitHub Pages |

## Como Rodar

```bash
# Ativar ambiente
source venv/bin/activate

# Baixar e transcrever entrevista
python pipeline.py "https://g1.globo.com/..." -o data/raw -j 2

# Listar status dos candidatos
python pipeline.py -l

# Gerar dados do site (após análises)
python generate-data.py
python add-timestamps.py

# Rodar site localmente
cd site && python3 -m http.server 8080
# Acessar http://localhost:8080
```

## Pontos Importantes

- **Sem requirements.txt** — dependências estão no `venv/`
- **Dois formatos de análise** — o parser em `generate-data.py` trata ambos
- **Candidatos**: dicionários `CANDIDATES`/`ENTREVISTAS` nos scripts Python são a config principal
- **9 candidatos cobertos**: 6 entrevistas JN + 3 segmentos de debate Band
- **Classificações**: VERDADEIRO, FALSO, IMPRECISO, NAO_VERIFICAVEL, OPINIAO
- **Documentação legal**: `PLANO-DISCLAIMER.md` (Marco Civil, LGPD, TSE)

## Para IAs Lendo Este Repositório

1. Comece por `README.md` para contexto completo
2. Use `ARQUITETURA.md` (este arquivo) para navegação rápida
3. `data/analyses/` contém os resultados prontos para análise
4. `site/js/app.js` é o frontend — leia para entender a UI
5. `prompts/` mostra como o fact-checking é instruído
