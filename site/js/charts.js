// charts.js - Simple distribution chart using Canvas

function renderDistributionBar(container, summary, total) {
  const categories = [
    { key: 'VERDADEIRO', label: 'Verdadeiro', color: '#16a34a' },
    { key: 'IMPRECISO', label: 'Impreciso', color: '#d97706' },
    { key: 'FALSO', label: 'Falso', color: '#dc2626' },
    { key: 'NAO_VERIFICAVEL', label: 'Não verificável', color: '#6b7280' },
    { key: 'OPINIAO', label: 'Opinião', color: '#9333ea' },
  ];

  const segments = categories
    .map(c => ({ ...c, count: summary[c.key] || 0 }))
    .filter(s => s.count > 0);

  if (total === 0) return;

  let html = '<div class="bar-container">';
  segments.forEach(s => {
    const pct = (s.count / total * 100).toFixed(1);
    html += `<div class="bar-segment" style="width:${pct}%;background:${s.color}" title="${s.label}: ${s.count} (${pct}%)"></div>`;
  });
  html += '</div>';

  // Legend
  html += '<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">';
  segments.forEach(s => {
    const pct = (s.count / total * 100).toFixed(1);
    html += `<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${s.color}"></span>
      ${s.label}: ${s.count} (${pct}%)
    </span>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

function renderDonutChart(canvas, summary, total) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const categories = [
    { key: 'VERDADEIRO', color: '#16a34a' },
    { key: 'IMPRECISO', color: '#d97706' },
    { key: 'FALSO', color: '#dc2626' },
    { key: 'NAO_VERIFICAVEL', color: '#6b7280' },
    { key: 'OPINIAO', color: '#9333ea' },
  ];

  const segments = categories
    .map(c => ({ ...c, count: summary[c.key] || 0 }))
    .filter(s => s.count > 0);

  if (total === 0) return;

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const radius = Math.min(cx, cy) - 4;
  const innerRadius = radius * 0.55;

  let startAngle = -Math.PI / 2;
  segments.forEach(s => {
    const sliceAngle = (s.count / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 1.25rem Inter, system-ui, sans-serif';
  ctx.fillText(total, cx, cy - 8);
  ctx.font = '0.625rem Inter, system-ui, sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || '#64748b';
  ctx.fillText('afirmações', cx, cy + 10);
}

function renderRadarChart(canvas, topicCounts, totalClaims) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const cx = width / 2;
  const cy = height / 2;

  // Detect dark mode
  const isDark = document.documentElement.classList.contains('dark');

  // Filter out "Geral" and sort by count descending
  const topics = Object.entries(topicCounts)
    .filter(([k]) => k !== 'Geral')
    .sort((a, b) => b[1] - a[1]);

  if (topics.length === 0) return;

  const n = topics.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Compute percentages
  const maxPct = Math.max(...topics.map(([, c]) => (c / totalClaims) * 100));
  const levels = 4;

  // Theme-aware colors
  const fg = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)';
  const fillColor = isDark ? 'rgba(96, 165, 250, 0.25)' : 'rgba(59, 130, 246, 0.2)';
  const strokeColor = isDark ? 'rgba(96, 165, 250, 0.9)' : 'rgba(59, 130, 246, 0.8)';
  const pointColor = isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 0.9)';

  // Radius with padding for labels
  const isMobile = width < 260;
  const labelPad = isMobile ? 40 : 48;
  const radius = Math.min(cx, cy) - labelPad;

  // Draw grid levels
  for (let l = 1; l <= levels; l++) {
    const r = (radius * l) / levels;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = startAngle + (i % n) * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  // Draw axes
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  // Draw data polygon
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const pct = (topics[idx][1] / totalClaims) * 100;
    const r = maxPct > 0 ? (pct / maxPct) * radius : 0;
    const angle = startAngle + idx * angleStep;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw data points
  for (let i = 0; i < n; i++) {
    const pct = (topics[i][1] / totalClaims) * 100;
    const r = maxPct > 0 ? (pct / maxPct) * radius : 0;
    const angle = startAngle + i * angleStep;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, isMobile ? 2.5 : 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = pointColor;
    ctx.fill();
  }

  // Draw labels
  const labelFont = isMobile ? '0.5625rem Inter, system-ui, sans-serif' : '0.6875rem Inter, system-ui, sans-serif';
  const valueFont = isMobile ? '0.5rem Inter, system-ui, sans-serif' : '0.625rem Inter, system-ui, sans-serif';

  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const pct = ((topics[i][1] / totalClaims) * 100).toFixed(0);
    const label = topics[i][0];
    const value = `${pct}%`;

    // Position label outside the polygon
    const labelR = radius + (isMobile ? 28 : 34);
    let lx = cx + labelR * Math.cos(angle);
    let ly = cy + labelR * Math.sin(angle);

    // Clamp to canvas bounds
    const textWidth = ctx.measureText(label).width;
    const halfText = textWidth / 2 + 4;
    if (ctx.textAlign === 'left') lx = Math.min(lx, width - halfText);
    else if (ctx.textAlign === 'right') lx = Math.max(lx, halfText);

    // Adjust alignment based on position
    if (Math.cos(angle) > 0.15) ctx.textAlign = 'left';
    else if (Math.cos(angle) < -0.15) ctx.textAlign = 'right';
    else ctx.textAlign = 'center';

    // Re-clamp after alignment change
    if (ctx.textAlign === 'left') lx = Math.min(lx, width - halfText);
    else if (ctx.textAlign === 'right') lx = Math.max(lx, halfText);

    ctx.fillStyle = fg;
    ctx.font = labelFont;
    ctx.fillText(label, lx, ly - 5);
    ctx.fillStyle = muted;
    ctx.font = valueFont;
    ctx.fillText(value, lx, ly + 9);
  }
}
