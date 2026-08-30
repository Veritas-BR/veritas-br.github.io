// widget.js - Embeddable fact-check widget
// Usage: <script src="https://site.com/js/widget.js" data-candidate="slug"></script>

(function() {
  'use strict';

  const SCRIPT_TAG = document.currentScript;
  const CANDIDATE_SLUG = SCRIPT_TAG?.getAttribute('data-candidate') || 'all';
  const DATA_URL = SCRIPT_TAG?.getAttribute('data-base-url') || SCRIPT_TAG?.src?.replace(/\/js\/widget\.js.*$/, '') || '';

  const COLORS = {
    VERDADEIRO: '#16a34a',
    IMPRECISO: '#d97706',
    FALSO: '#dc2626',
    NAO_VERIFICAVEL: '#6b7280',
    OPINIAO: '#9333ea',
  };

  const LABELS = {
    VERDADEIRO: 'Verdadeiro',
    IMPRECISO: 'Impreciso',
    FALSO: 'Falso',
    NAO_VERIFICAVEL: 'Não verificável',
    OPINIAO: 'Opinião',
  };

  function isDarkMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ||
           document.documentElement.classList.contains('dark');
  }

  function createWidget(container, candidate) {
    const dark = isDarkMode();
    const fg = dark ? '#e2e8f0' : '#0f172a';
    const muted = dark ? '#94a3b8' : '#64748b';
    const bg = dark ? '#1e293b' : '#ffffff';
    const border = dark ? '#334155' : '#e2e8f0';
    const cardBg = dark ? '#0f172a' : '#f8fafc';

    const summary = candidate.summary;
    const total = Object.values(summary).reduce((a, b) => a + b, 0);

    container.style.cssText = `
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: ${bg};
      border: 1px solid ${border};
      border-radius: 12px;
      padding: 20px;
      max-width: 360px;
      color: ${fg};
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Header
    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div>
          <div style="font-size:16px;font-weight:600;color:${fg};">${candidate.name}</div>
          <div style="font-size:12px;color:${muted};">${candidate.party}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:700;color:${candidate.color};">${total}</div>
          <div style="font-size:11px;color:${muted};">afirmações</div>
        </div>
      </div>`;

    // Bar chart
    const classes = ['VERDADEIRO', 'IMPRECISO', 'FALSO', 'NAO_VERIFICAVEL', 'OPINIAO'];
    html += `<div style="display:flex;height:8px;border-radius:9999px;overflow:hidden;margin-bottom:12px;">`;
    classes.forEach(cls => {
      const count = summary[cls] || 0;
      if (count > 0) {
        const pct = (count / total * 100).toFixed(1);
        html += `<div style="width:${pct}%;background:${COLORS[cls]};" title="${LABELS[cls]}: ${count}"></div>`;
      }
    });
    html += `</div>`;

    // Legend
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">`;
    classes.forEach(cls => {
      const count = summary[cls] || 0;
      if (count > 0) {
        html += `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:${muted};">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS[cls]};"></span>
          ${LABELS[cls]}: ${count}
        </span>`;
      }
    });
    html += `</div>`;

    // Link
    html += `
      <div style="text-align:center;padding-top:12px;border-top:1px solid ${border};">
        <a href="${DATA_URL}#/candidato/${candidate.slug}" target="_blank" rel="noopener" style="font-size:12px;color:${candidate.color};text-decoration:none;font-weight:500;">
          Ver análise completa →
        </a>
      </div>
      <div style="text-align:center;margin-top:8px;">
        <span style="font-size:9px;color:${muted};">Veritas BR 2026 · Verificação de fatos · Eleições 2026</span>
      </div>`;

    container.innerHTML = html;
  }

  async function init() {
    // Find all widget containers
    const containers = document.querySelectorAll('[data-contrafatos-widget]');
    if (containers.length === 0) return;

    try {
      const response = await fetch(`${DATA_URL}/js/data.json`);
      const candidates = await response.json();

      containers.forEach(container => {
        const slug = container.getAttribute('data-contrafatos-widget');
        let candidate;

        if (slug === 'all') {
          // Show summary of all candidates
          const merged = {};
          candidates.forEach(c => {
            Object.keys(c.summary).forEach(k => {
              merged[k] = (merged[k] || 0) + c.summary[k];
            });
          });
          candidate = {
            name: 'Todos os candidatos',
            party: `${candidates.length} análises`,
            slug: '',
            color: '#3b82f6',
            summary: merged,
          };
        } else {
          candidate = candidates.find(c => c.slug === slug);
        }

        if (candidate) {
          createWidget(container, candidate);
        }
      });
    } catch (e) {
      console.error('Veritas BR widget error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
