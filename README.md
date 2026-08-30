# Contrafatos Não Existem Argumentos

Verificação de fatos das entrevistas e debates dos candidatos à Presidência da República nas eleições de 2026 — Brasil.

> **Aviso**: Este projeto é uma análise técnica de fatos apresentados em entrevistas públicas. Não constitui endereçamento, apoio ou oposição a qualquer candidato.

## Objetivo

Fornecer informações verificáveis para que o eleitor tome suas próprias decisões de forma informada, sem recomendar ou endereçar candidato algum. Conforme proibição do TSE, não fazemos ranking de candidatos nem sugerimos quem é melhor ou pior.

## Princípios

- **Transparência total** — Transcrição, prompt, resposta e modelo são públicos e verificáveis
- **Neutralidade** — IA verificadora sem vieses políticos
- **Sem ranking** — Não fazemos comparação entre candidatos (proibido pelo TSE)
- **Dados abertos** — Todos os dados estão disponíveis para download e reutilização

## Candidatos Analisados

### Entrevistas Jornal Nacional (24-29/ago/2026)

| Candidato | Partido | Data |
|-----------|---------|------|
| Romeu Zema | Novo | 24/ago |
| Ronaldo Caiado | PSD | 25/ago |
| Renan Santos | Missão | 26/ago |
| Lula | PT | 27/ago |
| Flávio Bolsonaro | PL | 28/ago |
| Augusto Cury | Avante | 29/ago |

### Debate Band (05/08/2026)

| Candidato | Partido |
|-----------|---------|
| Ronaldo Caiado | PSD |
| Renan Santos | Missão |
| Augusto Cury | Avante |

## Tecnologias

| Etapa | Ferramenta |
|-------|-----------|
| Download do áudio | yt-dlp (Globoplay/Globo) |
| Transcrição | Whisper large-v3-turbo (OpenAI, local) |
| Verificação de fatos | MiMo 2.5 (via opencode) |
| Diarização de falantes | Script personalizado (Python) |
| Site | HTML/CSS/JS puro + Tailwind CSS |
| Hospedagem | GitHub Pages |

## Estrutura do Projeto

```
contrafatosnaoexistemargumentos/
├── pipeline.py              # Download + transcrição paralela
├── generate-data.py         # Gera data.json a partir das análises
├── add-timestamps.py        # Adiciona timestamps + detecção de tópicos
├── diarize.py               # Diarização de falantes (debates)
├── split-debate.py          # Separa falas por candidato
├── prompts/
│   └── fact-check-v1.txt    # Prompt de verificação
├── data/
│   ├── raw/                 # Áudios baixados (temporário)
│   ├── transcripts/         # Transcrições .txt, .srt, -segments.json
│   ├── analyses/            # Análises .txt + metadados .json
│   └── debate-band/         # Falas separadas por candidato
└── site/                    # Site estático
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── data.json         # Dados consolidados
    │   ├── app.js           # SPA router + rendering
    │   └── charts.js        # Gráficos (Canvas)
    └── dados/               # Arquivos para download
```

## Como Executar

### Pré-requisitos

- Python 3.14+
- yt-dlp
- openai-whisper (com PyTorch + MPS/CUDA)

### 1. Download e Transcrição

```bash
# Ativar ambiente virtual
source venv/bin/activate

# Baixar e transcrever uma entrevista
python pipeline.py "URL_GLOBO" -o data/raw -j 2

# Exemplo: entrevista do Zema
python pipeline.py "https://g1.globo.com/jornal-nacional/noticia/2026/08/24/romeu-zema-novo-e-entrevistado-na-globo-veja-integra.ghtml" -o data/raw -j 2
```

### 2. Gerar Dados do Site

```bash
# Gerar data.json a partir das análises
python generate-data.py

# Adicionar timestamps e detecção de tópicos
python add-timestamps.py
```

### 3. Rodar o Site Localmente

```bash
cd site
python3 -m http.server 8080
# Acesse http://localhost:8080
```

## Metodologia de Verificação

### Pipeline

1. **Download** — Áudio baixado do Globoplay via yt-dlp
2. **Transcrição** — Modelo Whisper large-v3-turbo rodando localmente (Apple Silicon MPS)
3. **Verificação** — Cada afirmação factual é verificada contra fontes oficiais por IA
4. **Publicação** — Todos os dados são publicados para verificação independente

### Classificações

| Classificação | Significado |
|---------------|-------------|
| **Verdadeiro** | Confirmada por fontes oficiais e verificáveis |
| **Impreciso** | Contém elementos verdadeiros, mas distorce ou omite informações |
| **Falso** | Contradita por evidências oficiais disponíveis |
| **Não verificável** | Sem dados oficiais suficientes para confirmar ou refutar |
| **Opinião** | Opinião pessoal ou juízo de valor, não um fato verificável |

### Fontes Utilizadas

- IBGE (Instituto Brasileiro de Geografia e Estatística)
- TSE (Tribunal Superior Eleitoral)
- Banco Central do Brasil
- IPEA (Instituto de Pesquisa Econômica Aplicada)
- Veículos jornalísticos: G1, Folha de S.Paulo, O Globo, Valor Econômico

### Detecção de Tópicos

As afirmações são automaticamente categorizadas por tema:

- Economia
- Segurança
- Educação
- Saúde
- Infraestrutura
- Política
- Agricultura
- Relações Exteriores
- Tecnologia

## Funcionalidades do Site

- **Visão por candidato** — Todas as afirmações de um candidato (entrevistas + debates)
- **Visão por evento** — Afirmações agrupadas por entrevista ou debate
- **Gráficos** — Distribuição de classificações (barra + rosca) e temas citados (radar)
- **Filtros** — Filtrar afirmações por classificação
- **Dark mode** — Tema claro/escuro com persistência
- **Downloads** — Transcrições, análises e prompt disponíveis para download
- **Responsivo** — Funciona em desktop e mobile

## Dados

Todos os dados estão disponíveis na pasta `site/dados/` para download direto:

- Transcrições completas (`.txt`)
- Análises de verificação (`.txt`)
- Prompt utilizado (`.txt`)

## Licença

Todos os dados estão disponíveis sob licença Creative Commons. Você pode baixar, redistribuir e adaptar os dados, desde que cite a fonte.

## Aviso Legal

Esta verificação é uma análise técnica de fatos apresentados em entrevista pública. Não constitui endereçamento, apoio ou oposição a qualquer candidato. As entrevistas analisadas foram transmitidas pela TV Globo e Band no âmbito de entrevistas e debates com presidenciáveis de 2026.
