// app.js - SPA router and rendering

(function () {
  'use strict';

  const app = document.getElementById('app');
  const isEn = /^en/i.test(navigator.language);
  const CLASSIFICATION_MAP = {
    VERDADEIRO: { label: 'Verdadeiro', class: 'badge-verdadeiro' },
    FALSO: { label: 'Falso', class: 'badge-falso' },
    IMPRECISO: { label: 'Impreciso', class: 'badge-impreciso' },
    NAO_VERIFICAVEL: { label: 'Não verificável', class: 'badge-nao-verificavel' },
    OPINIAO: { label: 'Opinião', class: 'badge-opiniao' },
  };

  // --- Data loading with localStorage cache ---

  const CACHE_KEY = 'veritasbr_data';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async function loadData() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }

    const res = await fetch('js/data.json?' + Date.now());
    if (!res.ok) throw new Error('Failed to load data');
    const data = await res.json();

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* storage full, skip cache */ }

    return data;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
  }

  function getSummaryTotal(c) {
    const s = c.summary;
    return s.total || (s.VERDADEIRO||0) + (s.FALSO||0) + (s.IMPRECISO||0) + (s.NAO_VERIFICAVEL||0) || (s.OPINIAO||0);
  }

  function badgeHTML(classification) {
    const info = CLASSIFICATION_MAP[classification] || { label: classification, class: '' };
    return `<span class="badge ${info.class}">${info.label}</span>`;
  }

  function eventLabel(slug) {
    if (slug.includes('debate')) return 'Debate Band';
    return 'Entrevista JN';
  }

  // --- Share functionality ---

  const CLAIM_COLORS = {
    VERDADEIRO: { bg: '#dcfce7', text: '#166534', label: 'Verdadeiro' },
    FALSO: { bg: '#fee2e2', text: '#991b1b', label: 'Falso' },
    IMPRECISO: { bg: '#fef3c7', text: '#92400e', label: 'Impreciso' },
    NAO_VERIFICAVEL: { bg: '#f3f4f6', text: '#374151', label: 'Não verificável' },
    OPINIAO: { bg: '#f3e8ff', text: '#6b21a8', label: 'Opinião' },
  };

  function createShareCard(claim, candidateName, candidateParty) {
    const color = CLAIM_COLORS[claim.classification] || CLAIM_COLORS.NAO_VERIFICAVEL;
    const quote = claim.quote.length > 180 ? claim.quote.slice(0, 177) + '...' : claim.quote;
    const topic = claim.context && claim.context !== 'Geral' ? claim.context : '';

    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;height:315px;z-index:-1;';
    div.innerHTML = `
      <div style="width:600px;height:315px;background:#ffffff;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:24px;box-sizing:border-box;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;background:${color.bg};color:${color.text};">${color.label}</span>
            ${topic ? `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:500;background:#dbeafe;color:#1e40af;">${topic}</span>` : ''}
          </div>
          <div style="font-size:15px;color:#1e293b;line-height:1.5;font-style:italic;">"${quote}"</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div style="font-size:13px;font-weight:600;color:#0f172a;">${candidateName}</div>
            <div style="font-size:11px;color:#64748b;">${candidateParty}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#64748b;">Veritas BR 2026</div>
            <div style="font-size:9px;color:#94a3b8;">Verificação de fatos · Eleições 2026</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
    return div;
  }

  async function generateShareImage(claim, candidateName, candidateParty) {
    const el = createShareCard(claim, candidateName, candidateParty);
    try {
      if (window.htmlToImage) {
        const dataUrl = await window.htmlToImage.toPng(el, {
          width: 600,
          height: 315,
          pixelRatio: 2,
          cacheBust: true,
        });
        el.remove();
        return dataUrl;
      }
    } catch (e) {
      el.remove();
      console.error('Error generating share image:', e);
    }
    return null;
  }

  async function downloadShareImage(claim, candidateName, candidateParty) {
    const dataUrl = await generateShareImage(claim, candidateName, candidateParty);
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `veritas-br-${candidateName.toLowerCase().replace(/\s+/g, '-')}-${claim.id}.png`;
      link.href = dataUrl;
      link.click();
    }
  }

  function shareClaim(claim, candidateName, candidateParty, candidateSlug) {
    const url = `${window.location.origin}${window.location.pathname}#/candidato/${candidateSlug}`;
    const text = `"${claim.quote.slice(0, 100)}..." — ${candidateName} (${candidateParty}) | Veritas BR 2026`;

    if (navigator.share) {
      navigator.share({ title: text, url: url }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
    }
  }

  // Expose to global scope for onclick handlers
  window.downloadShareImage = downloadShareImage;
  window.shareClaim = shareClaim;

  function mergeCandidates(candidates) {
    const grouped = {};
    candidates.forEach(c => {
      const key = c.name + '|' + c.party;
      if (!grouped[key]) {
        grouped[key] = {
          name: c.name,
          party: c.party,
          color: c.color,
          entries: [],
          summary: {},
          totalClaims: 0,
        };
      }
      grouped[key].entries.push(c);
      // Merge summaries
      Object.keys(c.summary).forEach(k => {
        grouped[key].summary[k] = (grouped[key].summary[k] || 0) + c.summary[k];
      });
      grouped[key].totalClaims += getSummaryTotal(c);
    });
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function cardHTML(c, total, href) {
    const v = c.summary.VERDADEIRO || 0;
    const f = c.summary.FALSO || 0;
    const imp = c.summary.IMPRECISO || 0;
    const nv = c.summary.NAO_VERIFICAVEL || 0;
    const op = c.summary.OPINIAO || 0;
    const vPct = total > 0 ? ((v / total) * 100).toFixed(0) : 0;

    return `
      <a href="${href}" class="card group p-5 hover:cursor-pointer">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-foreground group-hover:text-primary transition-colors">${c.name}</h3>
            <p class="text-sm text-muted-foreground">${c.party}</p>
          </div>
          <div class="text-right shrink-0">
            <div class="text-2xl font-bold" style="color:${c.color}">${total}</div>
            <div class="text-[10px] text-muted-foreground uppercase tracking-wider">afirmações</div>
          </div>
        </div>
        <div class="bar-container mb-3">
          ${v ? `<div class="bar-segment" style="width:${v/total*100}%;background:#16a34a" title="Verdadeiro: ${v}"></div>` : ''}
          ${imp ? `<div class="bar-segment" style="width:${imp/total*100}%;background:#d97706" title="Impreciso: ${imp}"></div>` : ''}
          ${f ? `<div class="bar-segment" style="width:${f/total*100}%;background:#dc2626" title="Falso: ${f}"></div>` : ''}
          ${nv ? `<div class="bar-segment" style="width:${nv/total*100}%;background:#6b7280" title="Não verificável: ${nv}"></div>` : ''}
          ${op ? `<div class="bar-segment" style="width:${op/total*100}%;background:#9333ea" title="Opinião: ${op}"></div>` : ''}
        </div>
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-green-600"></span>${v} verdadeiro${v!==1?'s':''}</span>
            <span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-red-600"></span>${f} falso${f!==1?'s':''}</span>
            <span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-amber-600"></span>${imp} impreciso${imp!==1?'s':''}</span>
          </div>
          <span class="font-medium shrink-0" style="color:${c.color}">${vPct}% ok</span>
        </div>
      </a>`;
  }

  // --- Route handlers ---

  let homeView = 'candidate'; // 'candidate' or 'event'

  function renderHome(candidates) {
    const allClaims = [];
    candidates.forEach(c => c.claims.forEach(claim => allClaims.push(claim)));
    const totalClaims = allClaims.length;
    const byClass = { VERDADEIRO: 0, FALSO: 0, IMPRECISO: 0, NAO_VERIFICAVEL: 0, OPINIAO: 0 };
    allClaims.forEach(c => { if (byClass.hasOwnProperty(c.classification)) byClass[c.classification]++; });
    const merged = mergeCandidates(candidates);

    let html = `
      <div class="fade-in">

        <div class="mb-10 text-center">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Veritas BR 2026</h1>
          <p class="mt-2 text-lg text-muted-foreground">Contra fatos, não existem argumentos</p>
          <p class="mt-1 text-sm text-muted-foreground">Verificação de fatos dos candidatos à Presidência — por IA</p>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 mb-10">
          <a href="#/busca?class=VERDADEIRO" class="card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="hero-stat-value" style="color:#16a34a">${byClass.VERDADEIRO}</div>
            <div class="hero-stat-label">Verdadeiro</div>
            <div class="hero-stat-label">${totalClaims > 0 ? ((byClass.VERDADEIRO / totalClaims) * 100).toFixed(1) : 0}%</div>
          </a>
          <a href="#/busca?class=IMPRECISO" class="card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="hero-stat-value" style="color:#d97706">${byClass.IMPRECISO}</div>
            <div class="hero-stat-label">Impreciso</div>
            <div class="hero-stat-label">${totalClaims > 0 ? ((byClass.IMPRECISO / totalClaims) * 100).toFixed(1) : 0}%</div>
          </a>
          <a href="#/busca?class=FALSO" class="card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="hero-stat-value" style="color:#dc2626">${byClass.FALSO}</div>
            <div class="hero-stat-label">Falso</div>
            <div class="hero-stat-label">${totalClaims > 0 ? ((byClass.FALSO / totalClaims) * 100).toFixed(1) : 0}%</div>
          </a>
          <a href="#/busca?class=NAO_VERIFICAVEL" class="card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="hero-stat-value" style="color:#6b7280">${byClass.NAO_VERIFICAVEL}</div>
            <div class="hero-stat-label">Não verificável</div>
            <div class="hero-stat-label">${totalClaims > 0 ? ((byClass.NAO_VERIFICAVEL / totalClaims) * 100).toFixed(1) : 0}%</div>
          </a>
          <a href="#/busca?class=OPINIAO" class="card p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="hero-stat-value" style="color:#9333ea">${byClass.OPINIAO}</div>
            <div class="hero-stat-label">Opinião</div>
            <div class="hero-stat-label">${totalClaims > 0 ? ((byClass.OPINIAO / totalClaims) * 100).toFixed(1) : 0}%</div>
          </a>
        </div>

        <div class="mb-8 max-w-xl mx-auto">
          <form id="home-search" class="flex gap-2">
            <input type="text" id="home-search-input" placeholder="Buscar afirmações por tema ou palavra-chave..." class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <button type="submit" class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Buscar
            </button>
          </form>
        </div>

        <div class="mb-8 flex items-center justify-center">
          <div class="inline-flex items-center rounded-lg bg-muted p-1 text-sm">
            <button id="view-candidate" class="view-toggle rounded-md px-4 py-1.5 font-medium transition-colors ${homeView === 'candidate' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}">Por candidato</button>
            <button id="view-event" class="view-toggle rounded-md px-4 py-1.5 font-medium transition-colors ${homeView === 'event' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}">Por evento</button>
          </div>
        </div>

        <div id="home-content"></div>

        <div class="mt-12 card p-6">
          <h2 class="text-lg font-semibold mb-3">Como funciona</h2>
          <div class="grid gap-4 sm:grid-cols-3 text-sm text-muted-foreground">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span class="font-medium text-foreground">Download + Transcrição</span>
              </div>
              <p>Entrevistas televisivas transcritas automaticamente com Whisper large-v3-turbo.</p>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span class="font-medium text-foreground">Verificação com IA</span>
              </div>
              <p>Cada afirmação factual é verificada automaticamente contra fontes oficiais (IBGE, TSE, Banco Central, etc.). Afirmações duvidosas passam por uma segunda rodada de busca.</p>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span class="font-medium text-foreground">Publicação transparente</span>
              </div>
              <p>Transcrição, prompt e resposta publicados no GitHub para verificação independente.</p>
            </div>
          </div>
          <div class="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <strong class="text-foreground">Aviso:</strong> Todo o processo é automatizado por IA, incluindo a revisão de afirmações duvidosas. As classificações refletem a análise do modelo de linguagem e podem conter imprecisões. Consulte sempre as fontes originais.
          </div>
        </div>

        <div class="info-banner mt-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <button class="dismiss-btn" onclick="this.parentElement.style.display='none'" aria-label="Fechar">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <p>${isEn
            ? '<strong class="text-foreground">Notice:</strong> 100% AI-generated analysis. No human review. All data is open-source and verifiable. Not voter guidance — consult original sources.'
            : '<strong class="text-foreground">Aviso:</strong> Análise 100% gerada por IA. Sem revisão humana. Dados abertos e verificáveis. Não constitui orientação eleitoral — consulte as fontes originais.'
          }</p>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('home');

    // Render current view
    renderHomeContent(candidates);

    // Setup toggle
    document.getElementById('view-candidate').addEventListener('click', () => {
      homeView = 'candidate';
      document.getElementById('view-candidate').className = 'view-toggle rounded-md px-4 py-1.5 font-medium transition-colors bg-background text-foreground shadow-sm';
      document.getElementById('view-event').className = 'view-toggle rounded-md px-4 py-1.5 font-medium transition-colors text-muted-foreground hover:text-foreground';
      renderHomeContent(candidates);
    });
    document.getElementById('view-event').addEventListener('click', () => {
      homeView = 'event';
      document.getElementById('view-event').className = 'view-toggle rounded-md px-4 py-1.5 font-medium transition-colors bg-background text-foreground shadow-sm';
      document.getElementById('view-candidate').className = 'view-toggle rounded-md px-4 py-1.5 font-medium transition-colors text-muted-foreground hover:text-foreground';
      renderHomeContent(candidates);
    });
    document.getElementById('home-search').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('home-search-input').value.trim();
      if (q) window.location.hash = `#/busca?q=${encodeURIComponent(q)}`;
    });
  }

  function renderHomeContent(candidates) {
    const container = document.getElementById('home-content');

    if (homeView === 'candidate') {
      const merged = mergeCandidates(candidates);
      let html = `
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Candidatos analisados</h2>
          <span class="text-sm text-muted-foreground">${merged.length} candidatos</span>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">`;

      merged.forEach(m => {
        const slug = m.entries[0].slug.includes('debate') && m.entries.length === 1
          ? m.entries[0].slug
          : m.entries.find(e => !e.slug.includes('debate'))?.slug || m.entries[0].slug;
        html += cardHTML(m, m.totalClaims, `#/candidato/${slug}`);
      });

      html += '</div>';
      container.innerHTML = html;
    } else {
      const interviews = candidates.filter(c => !c.slug.includes('debate'));
      const debates = candidates.filter(c => c.slug.includes('debate'));

      let html = '';

      // Interviews
      html += `
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Entrevistas Jornal Nacional</h2>
          <span class="text-sm text-muted-foreground">${interviews.length} entrevistas</span>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">`;

      interviews.forEach(c => {
        html += cardHTML(c, getSummaryTotal(c), `#/candidato/${c.slug}`);
      });

      html += '</div>';

      // Debates
      html += `
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Debates</h2>
          <span class="text-sm text-muted-foreground">${debates.length} análises</span>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">`;

      debates.forEach(c => {
        html += cardHTML(c, getSummaryTotal(c), `#/candidato/${c.slug}`);
      });

      html += '</div>';
      container.innerHTML = html;
    }
  }

  function renderCandidate(slug, candidates) {
    const c = candidates.find(x => x.slug === slug);
    if (!c) { renderNotFound(); return; }

    // Find all entries for this candidate name
    const allEntries = candidates.filter(x => x.name === c.name && x.party === c.party);
    const mergedClaims = [];
    const mergedSummary = {};

    allEntries.forEach(entry => {
      entry.claims.forEach(claim => {
        mergedClaims.push({
          ...claim,
          event: entry.slug.includes('debate') ? 'Debate Band' : 'Entrevista JN',
          eventSlug: entry.slug,
        });
      });
      Object.keys(entry.summary).forEach(k => {
        mergedSummary[k] = (mergedSummary[k] || 0) + entry.summary[k];
      });
    });

    const total = getSummaryTotal({ summary: mergedSummary });
    const events = allEntries.map(e => eventLabel(e.slug));

    let html = `
      <div class="fade-in">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">${c.name}</h1>
            <p class="text-muted-foreground">${c.party} · ${events.join(' · ')}</p>
          </div>
          <div class="flex items-center gap-3 text-sm text-muted-foreground sm:text-right">
            <span class="text-2xl font-bold" style="color:${c.color}">${total}</span>
            <span class="text-xs uppercase tracking-wider">afirmações</span>
          </div>
        </div>

        <div class="card p-5 mb-8">
          <h2 class="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Distribuição das classificações</h2>
          <div id="distribution-bar"></div>
          <div class="mt-4 flex justify-center">
            <canvas id="donut-chart" class="max-w-full" width="160" height="160" style="width:160px;height:160px;max-width:100%"></canvas>
          </div>
        </div>

        <div class="card p-5 mb-8">
          <h2 class="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Temas mais citados</h2>
          <div class="flex justify-center">
            <canvas id="radar-chart" class="max-w-full" width="320" height="320" style="width:320px;height:320px;max-width:100%"></canvas>
          </div>
          <div id="radar-legend" class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1"></div>
        </div>

        <div class="flex flex-wrap gap-2 mb-6" id="filters">
          <button class="filter-btn active" data-filter="all">Todos (${total})</button>
          ${mergedSummary.VERDADEIRO ? `<button class="filter-btn" data-filter="VERDADEIRO">Verdadeiro (${mergedSummary.VERDADEIRO})</button>` : ''}
          ${mergedSummary.IMPRECISO ? `<button class="filter-btn" data-filter="IMPRECISO">Impreciso (${mergedSummary.IMPRECISO})</button>` : ''}
          ${mergedSummary.FALSO ? `<button class="filter-btn" data-filter="FALSO">Falso (${mergedSummary.FALSO})</button>` : ''}
          ${mergedSummary.NAO_VERIFICAVEL ? `<button class="filter-btn" data-filter="NAO_VERIFICAVEL">Não verificável (${mergedSummary.NAO_VERIFICAVEL})</button>` : ''}
          ${mergedSummary.OPINIAO ? `<button class="filter-btn" data-filter="OPINIAO">Opinião (${mergedSummary.OPINIAO})</button>` : ''}
        </div>

        <div id="claims-list" class="space-y-4">`;

    // Sort claims: event first, then by original id
    mergedClaims.sort((a, b) => {
      if (a.event !== b.event) return a.event === 'Entrevista JN' ? -1 : 1;
      return a.id - b.id;
    });

    let lastEvent = null;
    mergedClaims.forEach((claim, i) => {
      if (claim.event !== lastEvent) {
        html += `
          <div class="flex items-center gap-3 mt-6 mb-2 first:mt-0">
            <span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">${claim.event}</span>
            <div class="h-px flex-1 bg-border"></div>
          </div>`;
        lastEvent = claim.event;
      }

      html += `
          <div class="claim-card p-5 slide-in" data-classification="${claim.classification}" style="animation-delay:${Math.min(i * 30, 500)}ms">
            <div class="flex items-start gap-3 mb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">${claim.id}</span>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  ${badgeHTML(claim.classification)}
                  ${claim.timestamp ? `<span class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${claim.timestamp}</span>` : ''}
                  ${claim.context && claim.context !== 'Geral' ? `<span class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">${claim.context}</span>` : ''}
                  ${claim.title ? `<span class="text-xs font-medium text-muted-foreground">${claim.title}</span>` : ''}
                </div>
                <blockquote class="text-sm text-foreground italic leading-relaxed">"${claim.quote}"</blockquote>
              </div>
            </div>
            <div class="ml-10">
              <div class="prose text-sm text-muted-foreground">${formatVerification(claim.verification)}</div>
              ${claim.sources ? `<div class="mt-2 source-text"><strong>Fontes:</strong> ${claim.sources}</div>` : ''}
              ${claim.notes ? `<div class="mt-2 source-text"><strong>Observações:</strong> ${claim.notes}</div>` : ''}
              <div class="mt-3 flex items-center gap-2">
                <button onclick="downloadShareImage(${JSON.stringify(claim).replace(/"/g, '&quot;')}, '${c.name.replace(/'/g, "\\'")}', '${c.party.replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors">
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                  Baixar card
                </button>
                <button onclick="shareClaim(${JSON.stringify(claim).replace(/"/g, '&quot;')}, '${c.name.replace(/'/g, "\\'")}', '${c.party.replace(/'/g, "\\'")}', '${c.slug}')" class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors">
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>
                  Compartilhar
                </button>
              </div>
            </div>
          </div>`;
    });

    html += `
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('');

    // Render charts
    renderDistributionBar(document.getElementById('distribution-bar'), mergedSummary, total);
    renderDonutChart(document.getElementById('donut-chart'), mergedSummary, total);

    // Render radar chart
    const topicCounts = {};
    mergedClaims.forEach(claim => {
      const ctx = claim.context || 'Geral';
      topicCounts[ctx] = (topicCounts[ctx] || 0) + 1;
    });
    renderRadarChart(document.getElementById('radar-chart'), topicCounts, total);

    // Render radar legend
    const legendContainer = document.getElementById('radar-legend');
    const sortedTopics = Object.entries(topicCounts)
      .filter(([k]) => k !== 'Geral')
      .sort((a, b) => b[1] - a[1]);
    legendContainer.innerHTML = sortedTopics.map(([topic, count]) => {
      const pct = ((count / total) * 100).toFixed(0);
      return `<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span class="inline-block h-2 w-2 rounded-full" style="background:rgba(59,130,246,0.7)"></span>
        ${topic}: ${count} (${pct}%)
      </span>`;
    }).join('');

    // Setup filters
    setupFilters();
  }

  function formatVerification(text) {
    if (!text) return '';
    return text
      .replace(/\n/g, '<br>')
      .replace(/(\d{1,2}\/\d{1,2}\/\d{4})/g, '<code class="text-xs bg-muted px-1 py-0.5 rounded">$1</code>');
  }

  function setupFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    const claims = document.querySelectorAll('.claim-card');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        claims.forEach(card => {
          if (filter === 'all' || card.dataset.classification === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  function renderMethodology() {
    let html = `
      <div class="fade-in max-w-3xl">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-6">Metodologia</h1>

        <div class="space-y-6 prose text-muted-foreground text-sm">
          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Pipeline de verificação</h2>
            <p>Este projeto utiliza um pipeline automatizado por IA para verificar as afirmações factuais dos candidatos:</p>
            <ol class="mt-3 space-y-2 list-decimal list-inside">
              <li><strong class="text-foreground">Transcrição automática:</strong> O áudio das entrevistas é transcrito com o modelo <code>Whisper large-v3-turbo</code> da OpenAI, rodando localmente.</li>
              <li><strong class="text-foreground">Verificação de fatos (1ª rodada):</strong> A transcrição é enviada a um modelo de linguagem (MiMo 2.5) com um prompt especializado que instrui a verificar cada afirmação factual contra fontes oficiais.</li>
              <li><strong class="text-foreground">Revisão automatizada (2ª rodada):</strong> Afirmações classificadas como FALSO ou NÃO VERIFICÁVEL passam por uma segunda rodada de verificação via IA, com buscas adicionais para confirmar ou reclassificar (prompt: <code>fact-check-v3-revision.txt</code>).</li>
            </ol>
            <div class="mt-3 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <strong class="text-foreground">Aviso importante:</strong> Todo o processo é 100% automatizado por IA. Não há revisão humana das classificações. Resultados podem conter imprecisões.
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Classificações</h2>
            <p>Cada afirmação factual é classificada em uma das seguintes categorias:</p>
            <div class="mt-3 space-y-2">
              <div class="flex items-start gap-2">${badgeHTML('VERDADEIRO')} <span class="text-muted-foreground">Consistente com fontes oficiais disponíveis.</span></div>
              <div class="flex items-start gap-2">${badgeHTML('IMPRECISO')} <span class="text-muted-foreground">Contém elementos verdadeiros, mas distorce ou omite informações relevantes.</span></div>
              <div class="flex items-start gap-2">${badgeHTML('FALSO')} <span class="text-muted-foreground">Inconsistente com dados oficiais disponíveis.</span></div>
              <div class="flex items-start gap-2">${badgeHTML('NAO_VERIFICAVEL')} <span class="text-muted-foreground">Sem dados oficiais suficientes para avaliar.</span></div>
              <div class="flex items-start gap-2">${badgeHTML('OPINIAO')} <span class="text-muted-foreground">Opinião pessoal ou juízo de valor, não um fato verificável.</span></div>
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Fontes utilizadas</h2>
            <p>A verificação utiliza apenas fontes oficiais e jornalísticas de credibilidade comprovada:</p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${['IBGE', 'TSE', 'Banco Central', 'IPEA', 'STF', 'Senado', 'G1', 'Folha de S.Paulo', 'O Globo', 'Valor Econômico', 'UOL', 'Congresso em Foco'].map(s =>
                `<span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">${s}</span>`
              ).join('')}
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Transparência</h2>
            <p>Para garantir total transparência e reprodutibilidade:</p>
            <ul class="mt-3 space-y-1 list-disc list-inside">
              <li>A transcrição completa de cada entrevista está disponível no repositório GitHub.</li>
              <li>O prompt utilizado para a verificação é público e versionado.</li>
              <li>O modelo de IA utilizado (MiMo 2.5) é documentado.</li>
              <li>Todos os dados são armazenados em formato aberto (JSON, TXT).</li>
              <li><strong class="text-foreground">Todo o processo é 100% automatizado por IA.</strong></li>
            </ul>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Limitações</h2>
            <ul class="mt-3 space-y-1 list-disc list-inside">
              <li><strong class="text-foreground">100% automatizado:</strong> Toda a verificação é realizada por Inteligência Artificial, sem intervenção humana nas classificações.</li>
              <li>A verificação é baseada em informações disponíveis até a data da análise.</li>
              <li>Resultados gerados por IA podem conter imprecisões. Recomenda-se verificar com fontes primárias.</li>
              <li>Classificações de OPINIÃO refletem a natureza subjetiva de algumas afirmações.</li>
              <li>A análise não representa endosso ou oposição a candidato algum.</li>
            </ul>
          </div>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('methodology');
  }

  function renderAbout() {
    let html = `
      <div class="fade-in max-w-3xl">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-6">Sobre o projeto</h1>

        <div class="space-y-6 prose text-muted-foreground text-sm">
          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Objetivo</h2>
            <p><strong class="text-foreground">Veritas BR 2026</strong> é um projeto de verificação de fatos que analisa afirmações factuais de candidatos à Presidência da República nas eleições de 2026.</p>
            <p class="mt-2">O objetivo é fornecer informações verificáveis para que o eleitor tome suas próprias decisões de forma informada, sem recomendar ou endereçar candidato algum.</p>
            <p class="mt-2 text-xs text-muted-foreground"><strong class="text-foreground">Aviso:</strong> Toda a verificação é 100% automatizada por IA, sem intervenção humana nas classificações.</p>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Princípios</h2>
            <ul class="mt-3 space-y-2">
              <li><strong class="text-foreground">Neutralidade:</strong> Não emitimos juízos de valor sobre propostas ou posições políticas.</li>
              <li><strong class="text-foreground">Sem ranking:</strong> Não fazemos ranking de candidatos, conforme proibição do TSE.</li>
              <li><strong class="text-foreground">Sem recomendação de voto:</strong> Não recomendamos, sugerimos ou indicamos qualquer candidato.</li>
              <li><strong class="text-foreground">100% automatizado:</strong> Toda a verificação é realizada por IA, sem intervenção humana.</li>
              <li><strong class="text-foreground">Transparência:</strong> Transcrição, prompt e resposta são públicos e verificáveis.</li>
              <li><strong class="text-foreground">Fontes oficiais:</strong> Utilizamos apenas IBGE, TSE, Banco Central, IPEA e veículos jornalísticos confiáveis.</li>
            </ul>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Tecnologia</h2>
            <ul class="mt-3 space-y-1 list-disc list-inside">
              <li><strong class="text-foreground">Transcrição:</strong> Whisper large-v3-turbo (OpenAI, local)</li>
              <li><strong class="text-foreground">Verificação:</strong> MiMo 2.5 (via opencode) — 100% automatizado</li>
              <li><strong class="text-foreground">Site:</strong> HTML/CSS/JS puro com Tailwind CSS</li>
              <li><strong class="text-foreground">Hospedagem:</strong> GitHub Pages</li>
            </ul>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">${isEn ? 'Legal Notice' : 'Aviso legal'}</h2>
            <p>${isEn
              ? 'This is a fully automated AI analysis of statements made in publicly broadcast interviews. Results may contain inaccuracies. Consult original sources for verification.'
              : 'Esta é uma análise automatizada por IA de fatos apresentados em entrevista pública. Resultados podem conter imprecisões. Consulte as fontes originais para verificação.'
            }</p>
            <p class="mt-2">${isEn
              ? 'Does not constitute endorsement, support, or opposition to any candidate.'
              : 'Não constitui endereçamento, apoio ou oposição a qualquer candidato.'
            }</p>
          </div>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('about');
  }

  function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function highlightText(text, query) {
    if (!query) return text;
    const normalized = normalizeText(query);
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return text;
    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>');
  }

  function renderSearch(query, candidates, filters = {}) {
    const allClaims = [];
    candidates.forEach(c => {
      c.claims.forEach(claim => {
        allClaims.push({
          ...claim,
          candidateName: c.name,
          candidateParty: c.party,
          candidateSlug: c.slug,
          candidateColor: c.color,
          event: c.slug.includes('debate') ? 'Debate Band' : 'Entrevista JN',
        });
      });
    });

    // Get unique candidates and events for filters
    const uniqueCandidates = [];
    const seenCandidates = new Set();
    allClaims.forEach(c => {
      const key = c.candidateName + '|' + c.candidateParty;
      if (!seenCandidates.has(key)) {
        seenCandidates.add(key);
        uniqueCandidates.push({ name: c.candidateName, party: c.candidateParty, color: c.candidateColor });
      }
    });
    const uniqueEvents = [...new Set(allClaims.map(c => c.event))];

    let results = allClaims;
    if (query) {
      const q = normalizeText(query);
      results = allClaims.filter(c => {
        const searchFields = [c.quote, c.verification, c.context, c.candidateName, c.candidateParty, c.event]
          .filter(Boolean)
          .map(normalizeText)
          .join(' ');
        return q.split(/\s+/).some(word => word.length > 1 && searchFields.includes(word));
      });
    }

    let html = `
      <div class="fade-in">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-6">Buscar afirmações</h1>
        <p class="text-sm text-muted-foreground mb-4">Resultados 100% gerados por IA, sem revisão humana.</p>

        <div class="card p-4 mb-6">
          <form id="search-form" class="flex gap-2">
            <input type="text" id="search-input" value="${query.replace(/"/g, '&quot;')}" placeholder="Buscar por tema, palavra-chave..." class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <button type="submit" class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Buscar
            </button>
          </form>
        </div>

        <div class="card p-4 mb-6">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filtros:</span>
            <select id="filter-candidate" class="filter-select rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">Todos os candidatos</option>
              ${uniqueCandidates.map(c => `<option value="${c.name}">${c.name} (${c.party})</option>`).join('')}
            </select>
            <select id="filter-event" class="filter-select rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">Todos os eventos</option>
              ${uniqueEvents.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
            <select id="filter-sort" class="filter-select rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="candidate">Ordenar por candidato</option>
              <option value="classification">Ordenar por classificação</option>
              <option value="event">Ordenar por evento</option>
            </select>
          </div>
        </div>

        <div class="mb-4 text-sm text-muted-foreground" id="search-result-count">
          ${query ? `${results.length} resultado${results.length !== 1 ? 's' : ''} para "<strong class="text-foreground">${query}</strong>"` : `${results.length} afirmações no total`}
        </div>

        <div class="flex flex-wrap gap-2 mb-6" id="filters">
          <button class="filter-btn active" data-filter="all">Todos (${results.length})</button>`;

    const classCounts = {};
    results.forEach(r => {
      classCounts[r.classification] = (classCounts[r.classification] || 0) + 1;
    });

    ['VERDADEIRO', 'IMPRECISO', 'FALSO', 'NAO_VERIFICAVEL', 'OPINIAO'].forEach(cls => {
      if (classCounts[cls]) {
        const info = CLASSIFICATION_MAP[cls];
        html += `<button class="filter-btn" data-filter="${cls}">${info.label} (${classCounts[cls]})</button>`;
      }
    });

    html += `
        </div>

        <div id="claims-list" class="space-y-4">`;

    function renderClaimsList(claims) {
      let inner = '';
      let lastCandidate = null;
      claims.forEach((claim, i) => {
        if (claim.candidateName !== lastCandidate) {
          inner += `
          <div class="flex items-center gap-3 mt-6 mb-2 first:mt-0">
            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-white" style="background:${claim.candidateColor}">${claim.candidateName} · ${claim.candidateParty}</span>
            <span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">${claim.event}</span>
            <div class="h-px flex-1 bg-border"></div>
          </div>`;
          lastCandidate = claim.candidateName;
        }

        inner += `
          <div class="claim-card p-5 slide-in" data-classification="${claim.classification}" data-candidate="${claim.candidateName}" data-event="${claim.event}" style="animation-delay:${Math.min(i * 20, 400)}ms">
            <div class="flex items-start gap-3 mb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">${claim.id}</span>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  ${badgeHTML(claim.classification)}
                  ${claim.timestamp ? `<span class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${claim.timestamp}</span>` : ''}
                  ${claim.context && claim.context !== 'Geral' ? `<span class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">${claim.context}</span>` : ''}
                </div>
                <blockquote class="text-sm text-foreground italic leading-relaxed">"${highlightText(claim.quote, query)}"</blockquote>
              </div>
            </div>
            <div class="ml-10">
              <div class="prose text-sm text-muted-foreground">${formatVerification(highlightText(claim.verification, query))}</div>
              ${claim.sources ? `<div class="mt-2 source-text"><strong>Fontes:</strong> ${claim.sources}</div>` : ''}
            </div>
          </div>`;
      });
      return inner;
    }

    // Store initial results for filtering
    window._searchResults = results;
    html += renderClaimsList(results);

    html += `
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('search');

    // Setup form
    document.getElementById('search-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('search-input').value.trim();
      window.location.hash = q ? `#/busca?q=${encodeURIComponent(q)}` : '#/busca';
    });

    // Combined filter logic
    function applyAllFilters() {
      const activeBtn = document.querySelector('#filters .filter-btn.active');
      const classFilter = activeBtn ? activeBtn.dataset.filter : 'all';
      const candidateFilter = document.getElementById('filter-candidate').value;
      const eventFilter = document.getElementById('filter-event').value;
      const sortBy = document.getElementById('filter-sort').value;

      let filtered = window._searchResults.filter(c => {
        if (classFilter !== 'all' && c.classification !== classFilter) return false;
        if (candidateFilter !== 'all' && c.candidateName !== candidateFilter) return false;
        if (eventFilter !== 'all' && c.event !== eventFilter) return false;
        return true;
      });

      // Sort
      const classOrder = { FALSO: 0, IMPRECISO: 1, NAO_VERIFICAVEL: 2, VERDADEIRO: 3, OPINIAO: 4 };
      if (sortBy === 'classification') {
        filtered.sort((a, b) => (classOrder[a.classification] ?? 5) - (classOrder[b.classification] ?? 5));
      } else if (sortBy === 'event') {
        filtered.sort((a, b) => a.event.localeCompare(b.event) || a.candidateName.localeCompare(b.candidateName));
      } else {
        filtered.sort((a, b) => a.candidateName.localeCompare(b.candidateName) || a.id - b.id);
      }

      const listEl = document.getElementById('claims-list');
      listEl.innerHTML = renderClaimsList(filtered);

      const countEl = document.getElementById('search-result-count');
      const q = query || document.getElementById('search-input').value.trim();
      countEl.innerHTML = q
        ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "<strong class="text-foreground">${q}</strong>"`
        : `${filtered.length} afirmações no total`;

      // Update filter button counts
      const newClassCounts = {};
      filtered.forEach(r => { newClassCounts[r.classification] = (newClassCounts[r.classification] || 0) + 1; });
      document.querySelectorAll('#filters .filter-btn').forEach(btn => {
        const f = btn.dataset.filter;
        if (f === 'all') {
          btn.textContent = `Todos (${filtered.length})`;
        } else {
          const info = CLASSIFICATION_MAP[f];
          const count = newClassCounts[f] || 0;
          btn.textContent = `${info.label} (${count})`;
          btn.style.display = count === 0 ? 'none' : '';
        }
      });
    }

    setupFilters();
    document.querySelectorAll('#filter-candidate, #filter-event, #filter-sort').forEach(el => {
      el.addEventListener('change', applyAllFilters);
    });
    // Patch filter buttons to also trigger combined filter
    document.querySelectorAll('#filters .filter-btn').forEach(btn => {
      btn.removeEventListener('click', btn._handler);
      btn._handler = () => {
        document.querySelectorAll('#filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyAllFilters();
      };
      btn.addEventListener('click', btn._handler);
    });

    // Apply initial filters from URL params
    if (filters.classification) {
      const btn = document.querySelector(`#filters .filter-btn[data-filter="${filters.classification}"]`);
      if (btn) {
        document.querySelectorAll('#filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
    if (filters.candidate) {
      const sel = document.getElementById('filter-candidate');
      if (sel) sel.value = filters.candidate;
    }
    if (filters.event) {
      const sel = document.getElementById('filter-event');
      if (sel) sel.value = filters.event;
    }
    if (filters.classification || filters.candidate || filters.event) {
      applyAllFilters();
    }
  }

  function renderWidgets(candidates) {
    const baseUrl = window.location.origin + window.location.pathname;

    let html = `
      <div class="fade-in max-w-3xl">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-2">Widgets incorporáveis</h1>
        <p class="text-muted-foreground text-sm mb-8">Incorpore os resultados da verificação de fatos por IA no seu site ou blog. Dados 100% automatizados, sem revisão humana.</p>

        <div class="space-y-6">
          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Como usar</h2>
            <p class="text-sm text-muted-foreground mb-4">Copie o código HTML abaixo e cole no seu site. O widget é auto-contido e não depende de frameworks.</p>
            <div class="rounded-lg bg-muted p-4 text-xs font-mono text-muted-foreground overflow-x-auto">
              &lt;div data-contrafatos-widget="caiado"&gt;&lt;/div&gt;<br>
              &lt;script src="${baseUrl}/js/widget.js" data-base-url="${baseUrl}"&gt;&lt;/script&gt;
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-4">Preview — Todos os candidatos</h2>
            <div class="flex justify-center p-4 bg-muted/30 rounded-lg">
              <div data-contrafatos-widget="all"></div>
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-4">Preview — Por candidato</h2>
            <div class="grid gap-4 sm:grid-cols-2">`;

    const uniqueCandidates = [];
    const seen = new Set();
    candidates.forEach(c => {
      const key = c.name + '|' + c.party;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCandidates.push(c);
      }
    });

    uniqueCandidates.forEach(c => {
      html += `
              <div class="p-4 bg-muted/30 rounded-lg">
                <div data-contrafatos-widget="${c.slug}"></div>
              </div>`;
    });

    html += `
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2">Opções de personalização</h2>
            <div class="space-y-3 text-sm text-muted-foreground">
              <div>
                <code class="text-xs bg-muted px-1.5 py-0.5 rounded">data-contrafatos-widget="all"</code>
                — Mostra resumo de todos os candidatos
              </div>
              <div>
                <code class="text-xs bg-muted px-1.5 py-0.5 rounded">data-contrafatos-widget="caiado-debate-band"</code>
                — Mostra apenas o candidato específico
              </div>
              <div>
                <code class="text-xs bg-muted px-1.5 py-0.5 rounded">data-base-url="..."</code>
                — URL base do projeto (opcional, detecta automaticamente)
              </div>
            </div>
          </div>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('widgets');

    // Initialize widgets after rendering
    if (window.initWidgets) window.initWidgets();
  }

  function renderStats(candidates) {
    const allClaims = [];
    candidates.forEach(c => {
      c.claims.forEach(claim => {
        allClaims.push({ ...claim, candidateName: c.name, slug: c.slug });
      });
    });

    const total = allClaims.length;
    const byClass = {};
    const byTopic = {};
    const byCandidate = {};

    allClaims.forEach(c => {
      byClass[c.classification] = (byClass[c.classification] || 0) + 1;
      const topic = c.context || 'Geral';
      byTopic[topic] = (byTopic[topic] || 0) + 1;
      byCandidate[c.candidateName] = (byCandidate[c.candidateName] || 0) + 1;
    });

    const interviews = candidates.filter(c => !c.slug.includes('debate')).length;
    const debates = candidates.filter(c => c.slug.includes('debate')).length;

    let html = `
      <div class="fade-in">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-2">Estatísticas gerais</h1>
        <p class="text-muted-foreground text-sm mb-8">Dados agregados de todas as afirmações verificadas. 100% automatizados por IA. Sem comparação entre candidatos.</p>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <a href="#/busca" class="card p-5 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="text-3xl font-bold text-primary">${total}</div>
            <div class="text-sm text-muted-foreground mt-1">afirmações verificadas</div>
          </a>
          <a href="#/busca" class="card p-5 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="text-3xl font-bold text-primary">${candidates.length}</div>
            <div class="text-sm text-muted-foreground mt-1">análises realizadas</div>
          </a>
          <a href="#/busca?event=Entrevista%20JN" class="card p-5 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="text-3xl font-bold text-primary">${interviews}</div>
            <div class="text-sm text-muted-foreground mt-1">entrevistas JN</div>
          </a>
          <a href="#/busca?event=Debate%20Band" class="card p-5 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
            <div class="text-3xl font-bold text-primary">${debates}</div>
            <div class="text-sm text-muted-foreground mt-1">debates</div>
          </a>
        </div>

        <div class="grid gap-6 lg:grid-cols-2 mb-8">
          <div class="card p-5">
            <h2 class="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Distribuição geral</h2>
            <div id="stats-bar"></div>
            <div class="mt-4 flex justify-center">
              <canvas id="stats-donut" width="180" height="180" style="width:180px;height:180px"></canvas>
            </div>
          </div>

          <div class="card p-5">
            <h2 class="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Temas mais citados</h2>
            <div class="space-y-3">`;

    const sortedTopics = Object.entries(byTopic)
      .filter(([k]) => k !== 'Geral')
      .sort((a, b) => b[1] - a[1]);

    sortedTopics.forEach(([topic, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      html += `
              <a href="#/busca?q=${encodeURIComponent(topic)}" class="block rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors cursor-pointer">
                <div class="flex justify-between text-sm mb-1">
                  <span class="font-medium text-foreground">${topic}</span>
                  <span class="text-muted-foreground">${count} (${pct}%)</span>
                </div>
                <div class="h-2 rounded-full bg-muted overflow-hidden">
                  <div class="h-full rounded-full bg-primary/70" style="width:${pct}%"></div>
                </div>
              </a>`;
    });

    html += `
            </div>
          </div>
        </div>

        <div class="card p-5">
          <h2 class="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Classificações</h2>
          <div class="grid gap-3 sm:grid-cols-5">`;

    const classEntries = [
      { key: 'VERDADEIRO', label: 'Verdadeiro', color: '#16a34a' },
      { key: 'IMPRECISO', label: 'Impreciso', color: '#d97706' },
      { key: 'FALSO', label: 'Falso', color: '#dc2626' },
      { key: 'NAO_VERIFICAVEL', label: 'Não verificável', color: '#6b7280' },
      { key: 'OPINIAO', label: 'Opinião', color: '#9333ea' },
    ];

    classEntries.forEach(({ key, label, color }) => {
      const count = byClass[key] || 0;
      const pct = ((count / total) * 100).toFixed(1);
      html += `
            <a href="#/busca?class=${key}" class="text-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer block">
              <div class="text-2xl font-bold" style="color:${color}">${count}</div>
              <div class="text-xs text-muted-foreground mt-1">${label}</div>
              <div class="text-xs text-muted-foreground">${pct}%</div>
            </a>`;
    });

    html += `
          </div>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('stats');

    // Render charts
    renderDistributionBar(document.getElementById('stats-bar'), byClass, total);
    renderDonutChart(document.getElementById('stats-donut'), byClass, total);
  }

  function renderNotFound() {
    app.innerHTML = `
      <div class="fade-in text-center py-16">
        <h1 class="text-4xl font-bold mb-4">404</h1>
        <p class="text-muted-foreground mb-6">Página não encontrada</p>
        <a href="#/" class="text-sm text-primary hover:underline">Voltar ao início</a>
      </div>`;
  }

  function renderDownloads() {
    const transcripts = [
      { slug: 'zema', name: 'Romeu Zema', file: 'zema-formatado.txt' },
      { slug: 'caiado', name: 'Ronaldo Caiado', file: 'caiado-formatado.txt' },
      { slug: 'renan', name: 'Renan Santos', file: 'renan-formatado.txt' },
      { slug: 'lula', name: 'Lula', file: 'lula-formatado.txt' },
      { slug: 'flavio-bolsonaro-2026', name: 'Flávio Bolsonaro', file: 'flavio-bolsonaro-2026-formatado.txt' },
      { slug: 'augusto-cury', name: 'Augusto Cury', file: 'augusto-cury-formatado.txt' },
    ];
    const debateTranscripts = [
      { slug: 'caiado', name: 'Ronaldo Caiado', file: 'caiado.txt' },
      { slug: 'renan', name: 'Renan Santos', file: 'renan.txt' },
      { slug: 'cury', name: 'Augusto Cury', file: 'cury.txt' },
    ];
    const analyses = [
      { slug: 'romeu-zema-2026', name: 'Romeu Zema', file: 'romeu-zema-2026.txt' },
      { slug: 'ronaldo-caiado-2026', name: 'Ronaldo Caiado', file: 'ronaldo-caiado-2026.txt' },
      { slug: 'renan-santos-2026', name: 'Renan Santos', file: 'renan-santos-2026.txt' },
      { slug: 'lula-2026', name: 'Lula', file: 'lula-2026.txt' },
      { slug: 'flavio-bolsonaro-2026', name: 'Flávio Bolsonaro', file: 'flavio-bolsonaro-2026.txt' },
      { slug: 'augusto-cury-2026', name: 'Augusto Cury', file: 'augusto-cury-2026.txt' },
    ];
    const debateAnalyses = [
      { slug: 'caiado-debate-band', name: 'Ronaldo Caiado', file: 'caiado-debate-band.txt' },
      { slug: 'renan-debate-band', name: 'Renan Santos', file: 'renan-debate-band.txt' },
      { slug: 'cury-debate-band', name: 'Augusto Cury', file: 'cury-debate-band.txt' },
    ];

    let html = `
      <div class="fade-in max-w-3xl">
        <a href="#/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Voltar
        </a>

        <h1 class="text-2xl font-bold tracking-tight mb-2">Dados abertos</h1>
        <p class="text-muted-foreground text-sm mb-8">Todos os dados deste projeto são públicos e verificáveis. Análises 100% geradas por IA, sem revisão humana. Baixe as transcrições, análises e o prompt utilizado.</p>

        <div class="space-y-6">
          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-1 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              Prompt de verificação (1ª rodada)
            </h2>
            <p class="text-xs text-muted-foreground mb-3">O prompt completo utilizado para guiar a primeira rodada de verificação de fatos pelo modelo de IA.</p>
            <a href="dados/prompts/fact-check-v2.txt" download class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
              fact-check-v2.txt
            </a>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-1 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              Prompt de revisão (2ª rodada)
            </h2>
            <p class="text-xs text-muted-foreground mb-3">Segunda rodada de verificação: afirmações classificadas como FALSO ou NÃO VERIFICÁVEL passam por buscas adicionais para confirmar ou reclassificar.</p>
            <a href="dados/prompts/fact-check-v3-revision.txt" download class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
              fact-check-v3-revision.txt
            </a>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              Transcrições — Jornal Nacional
            </h2>
            <p class="text-xs text-muted-foreground mb-3">Transcrições geradas pelo Whisper large-v3-turbo com timestamps.</p>
            <div class="space-y-2">`;

    transcripts.forEach(t => {
      html += `
              <a href="dados/transcricoes/${t.file}" download class="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent transition-colors">
                <span class="font-medium">${t.name}</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                  ${t.file}
                </span>
              </a>`;
    });

    html += `
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              Transcrições — Debate Band (05/08/2026)
            </h2>
            <p class="text-xs text-muted-foreground mb-3">Falas separadas por candidato do debate da Band.</p>
            <div class="space-y-2">`;

    debateTranscripts.forEach(t => {
      html += `
              <a href="dados/transcricoes/${t.file}" download class="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent transition-colors">
                <span class="font-medium">${t.name}</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                  ${t.file}
                </span>
              </a>`;
    });

    html += `
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              Análises — Jornal Nacional
            </h2>
            <p class="text-xs text-muted-foreground mb-3">Relatórios completos com todas as afirmações verificadas, classificações e fontes.</p>
            <div class="space-y-2">`;

    analyses.forEach(a => {
      html += `
              <a href="dados/analises/${a.file}" download class="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent transition-colors">
                <span class="font-medium">${a.name}</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                  ${a.file}
                </span>
              </a>`;
    });

    html += `
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              Análises — Debate Band (05/08/2026)
            </h2>
            <p class="text-xs text-muted-foreground mb-3">Verificação de fatos das falas de cada candidato no debate.</p>
            <div class="space-y-2">`;

    debateAnalyses.forEach(a => {
      html += `
              <a href="dados/analises/${a.file}" download class="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent transition-colors">
                <span class="font-medium">${a.name}</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                  ${a.file}
                </span>
              </a>`;
    });

    html += `
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-semibold text-foreground mb-2 flex items-center gap-2">
              <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Como reutilizar
            </h2>
            <p class="text-xs text-muted-foreground">Código do site: licença MIT. Dados gerados por IA (análises, transcrições): CC0 (Domínio Público). Você pode baixar, redistribuir e adaptar sem restrições.</p>
          </div>
        </div>
      </div>`;

    app.innerHTML = html;
    updateNav('downloads');
  }

  function updateNav(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.route === route) {
        link.classList.add('text-foreground', 'bg-accent');
        link.classList.remove('text-muted-foreground');
      } else {
        link.classList.remove('text-foreground', 'bg-accent');
        link.classList.add('text-muted-foreground');
      }
    });
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      if (link.dataset.route === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // --- Router ---

  function navigate() {
    const hash = window.location.hash || '#/';
    const path = hash.split('?')[0].slice(1);
    const candidates = window._candidates;

    if (path === '/' || path === '') {
      renderHome(candidates);
    } else if (path.startsWith('/candidato/')) {
      const slug = path.split('/candidato/')[1];
      renderCandidate(slug, candidates);
    } else if (path === '/busca') {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      renderSearch(params.get('q') || '', candidates, {
        classification: params.get('class'),
        candidate: params.get('candidate'),
        event: params.get('event'),
      });
    } else if (path === '/metodologia') {
      renderMethodology();
    } else if (path === '/sobre') {
      renderAbout();
    } else if (path === '/dados') {
      renderDownloads();
    } else if (path === '/estatisticas') {
      renderStats(candidates);
    } else if (path === '/widgets') {
      renderWidgets(candidates);
    } else {
      renderNotFound();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Theme toggle ---

  function initTheme() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }

  function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // Re-render charts for theme change
    navigate();
  }

  // --- Init ---

  initTheme();
  window.addEventListener('hashchange', navigate);
  window.addEventListener('DOMContentLoaded', async () => {
    // Show loading spinner
    app.innerHTML = '<div class="flex flex-col items-center justify-center py-20 gap-3"><div class="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div><p class="text-sm text-muted-foreground">Carregando dados...</p></div>';

    try {
      window._candidates = await loadData();
      navigate();
    } catch (e) {
      app.innerHTML = '<div class="flex flex-col items-center justify-center py-20 gap-3"><p class="text-lg font-medium">Erro ao carregar dados</p><p class="text-sm text-muted-foreground">Verifique sua conexão e recarregue a página.</p><button onclick="location.reload()" class="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Recarregar</button></div>';
      return;
    }

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
      });
      // Close mobile menu on link click
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.remove('open');
        });
      });
    }

    // Mobile theme toggle
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    if (themeToggleMobile) {
      themeToggleMobile.addEventListener('click', toggleTheme);
    }

    // Back to top button
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Voltar ao topo');
    backToTop.innerHTML = '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>';
    document.body.appendChild(backToTop);

    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
})();
