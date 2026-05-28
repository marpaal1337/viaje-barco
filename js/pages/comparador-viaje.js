(function() {
'use strict';

const TABS = {
  barcos: { DATA: null, filtered: [], sortField: 'precio_dia_baja', sortAsc: true, chart: null, _rendered: false,
    storageKey: 'barcos_edits', dataFile: '../data/barcos.json', importId: 'importBarcos', page: 1, pageSize: 15 },
  vuelos: { DATA: null, filtered: [], sortField: 'precio', sortAsc: true, chart: null, selected: [], _rendered: false,
    storageKey: 'vuelos_edits', dataFile: '../data/vuelos.json', importId: 'importVuelos', page: 1, pageSize: 15 },
};

let currentTab = 'barcos';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  const t = TABS[tab];
  if (t && t.DATA && !t._rendered) { t._rendered = true; t.applyFilters(); }
  if (tab === 'vuelos' && t.DATA && t._rendered) setTimeout(() => t.applyFilters(), 50);
}

async function loadAll() {
  for (const [key, t] of Object.entries(TABS)) {
    try {
      const r = await fetch(t.dataFile);
      t.DATA = await r.json();
      VV.loadEdits(key, t.DATA);
    } catch(e) { console.warn('Failed to load ' + t.dataFile); }
  }

  if (TABS.barcos.DATA) {
    const t = TABS.barcos;
    t._rendered = true;
    populateBarcosFilters();
    t.applyFilters = () => { applyBarcos(); };
    t.applyFilters();
    wireBarcos();
    wireTableSort('barcos');
  }
  if (TABS.vuelos.DATA) {
    const t = TABS.vuelos;
    populateVuelosFilters();
    t.applyFilters = () => { applyVuelos(); };
    t.openGF = () => openGoogleFlights();
    t.clearSel = () => { t.selected = []; applyVuelos(); };
    wireVuelos();
    wireTableSort('vuelos');
  }
  updateGlobalStats();
}

function updateGlobalStats() {
  const parts = [];
  for (const [k, t] of Object.entries(TABS)) {
    if (!t.DATA) continue;
    const arr = t.DATA.barcos || t.DATA.alternativas || [];
    parts.push(k + ': ' + arr.length);
  }
  document.getElementById('globalStats').textContent = parts.join(' · ');
}

// ── BARCOS ──
function populateBarcosFilters() {
  const t = TABS.barcos;
  if (!t.DATA) return;
  const islas = [...new Set(t.DATA.barcos.map(b => b.isla))].sort();
  document.querySelector('.tab-panel[data-tab="barcos"] .f-isla').innerHTML =
    '<option value="all">Todas</option>' + islas.map(i => `<option value="${i}">${i}</option>`).join('');
}

function applyBarcos() {
  const t = TABS.barcos;
  if (!t.DATA) return;
  const p = document.querySelector('.tab-panel[data-tab="barcos"]');
  const isla = p.querySelector('.f-isla').value;
  const tipo = p.querySelector('.f-tipo').value;
  const minPlazas = parseInt(p.querySelector('.f-plazas').value);
  const patron = p.querySelector('.f-patron').value;
  const maxPrice = parseInt(p.querySelector('.f-pmax').value);

  t.filtered = t.DATA.barcos.filter(b => {
    if (isla !== 'all' && b.isla !== isla) return false;
    if (tipo !== 'all' && b.tipo !== tipo) return false;
    if (b.plazas < minPlazas) return false;
    if (patron !== 'all' && String(b.con_patron) !== patron) return false;
    if (VV.getBaja(b) > maxPrice) return false;
    return true;
  });
  t.page = 1;
  sortData('barcos');
  renderBarcos();
}

function sortData(tab) {
  const t = TABS[tab];
  if (!t) return;
  t.filtered.sort((a, b) => {
    let cmp = 0;
    const sf = t.sortField;
    if (tab === 'barcos') {
      if (sf === 'precio' || sf === 'precio_dia_baja') cmp = (a.precio_dia_baja||0) - (b.precio_dia_baja||0);
      else if (sf === 'precio_dia_alta') cmp = (a.precio_dia_alta||0) - (b.precio_dia_alta||0);
      else if (sf === 'eslora' || sf === 'eslora_m') cmp = (a.eslora_m||0) - (b.eslora_m||0);
      else if (sf === 'rating') cmp = (b.rating||0) - (a.rating||0);
      else if (sf === 'modelo') cmp = a.modelo.localeCompare(b.modelo);
      else if (sf === 'tipo') cmp = a.tipo.localeCompare(b.tipo);
      else if (sf === 'isla') cmp = a.isla.localeCompare(b.isla);
      else if (sf === 'puerto_base') cmp = (a.puerto_base||'').localeCompare(b.puerto_base||'');
      else if (sf === 'plazas') cmp = (a.plazas||0) - (b.plazas||0);
    } else if (tab === 'vuelos') {
      if (sf === 'precio') cmp = a.precio_eur - b.precio_eur;
      else if (sf === 'salida') cmp = VV.timeToMins(a.salida) - VV.timeToMins(b.salida);
      else if (sf === 'llegada') cmp = VV.timeToMins(a.llegada) - VV.timeToMins(b.llegada);
      else if (sf === 'duracion') cmp = (a.duracion_min||0) - (b.duracion_min||0);
      else if (sf === 'aerolinea') cmp = a.aerolinea.localeCompare(b.aerolinea);
      else if (sf === 'ruta') cmp = `${a.origen.codigo}→${a.destino.codigo}`.localeCompare(`${b.origen.codigo}→${b.destino.codigo}`);
      else if (sf === 'fecha') cmp = a.fecha.localeCompare(b.fecha);
    }
    return t.sortAsc ? cmp : -cmp;
  });
}

function getPageItems(t) {
  const start = (t.page - 1) * t.pageSize;
  return t.filtered.slice(start, start + t.pageSize);
}

function renderPagination(tab, container) {
  const t = TABS[tab];
  const total = t.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / t.pageSize));
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  const p = t.page;
  let html = '<div class="pagination">';
  html += `<button class="page-btn" data-tab="${tab}" data-page="${p - 1}" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
  const maxBtns = 5;
  let startP = Math.max(1, p - Math.floor(maxBtns / 2));
  let endP = Math.min(totalPages, startP + maxBtns - 1);
  if (endP - startP + 1 < maxBtns) startP = Math.max(1, endP - maxBtns + 1);
  if (startP > 1) html += `<button class="page-btn" data-tab="${tab}" data-page="1">1</button>${startP > 2 ? '<span class="page-info">…</span>' : ''}`;
  for (let i = startP; i <= endP; i++) {
    html += `<button class="page-btn${i === p ? ' active' : ''}" data-tab="${tab}" data-page="${i}">${i}</button>`;
  }
  if (endP < totalPages) {
    html += `${endP < totalPages - 1 ? '<span class="page-info">…</span>' : ''}<button class="page-btn" data-tab="${tab}" data-page="${totalPages}">${totalPages}</button>`;
  }
  html += `<button class="page-btn" data-tab="${tab}" data-page="${p + 1}" ${p >= totalPages ? 'disabled' : ''}>›</button>`;
  html += `<span class="page-info">${(p - 1) * t.pageSize + 1}–${Math.min(p * t.pageSize, total)} de ${total}</span>`;
  html += '</div>';
  container.innerHTML = html;
}

function renderVuelosTable(p) {
  const t = TABS.vuelos;
  const tbody = p.querySelector('.tableBody');
  const f = t.filtered;
  if (f.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-light);">Sin resultados</td></tr>';
    const pag = p.querySelector('.pagination');
    if (pag) pag.innerHTML = '';
    return;
  }
  const pageItems = getPageItems(t);
  tbody.innerHTML = pageItems.map(v => {
    const sel = t.selected.includes(v.id);
    const pc = v.precio_eur <= 50 ? 'price-green' : v.precio_eur >= 100 ? 'price-warn' : '';
    return `<tr class="${sel ? 'selected-row' : ''}" data-fid="${v.id}">
      <td><strong>${v.aerolinea}</strong> <span style="font-size:11px;color:var(--text-light);">${v.vuelo}</span></td>
      <td>${v.origen.codigo} → ${v.destino.codigo}</td>
      <td>${VV.fmtDate(v.fecha)}</td>
      <td>${v.salida}</td>
      <td>${v.llegada}</td>
      <td>${VV.minsToStr(v.duracion_min)}</td>
      <td class="price-cell ${pc}">${v.precio_eur.toFixed(0)} €</td>
      <td style="text-align:center;">${sel ? '✅' : '☐'}</td>
    </tr>`;
  }).join('');
  let pag = p.querySelector('.pagination');
  if (!pag) {
    pag = document.createElement('div');
    p.querySelector('.table-wrap').after(pag);
  }
  renderPagination('vuelos', pag);
}

function renderBarcos() {
  const t = TABS.barcos;
  const p = document.querySelector('.tab-panel[data-tab="barcos"]');
  const f = t.filtered;

  const prices = f.map(VV.getBaja).filter(x => x > 0);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const islas = [...new Set(f.map(b => b.isla))];
  p.querySelector('[data-stat="min"] .val').textContent = prices.length ? `${min.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="max"] .val').textContent = prices.length ? `${max.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="avg"] .val').textContent = prices.length ? `${avg.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="count"] .val').textContent = f.length;
  p.querySelector('[data-stat="islas"] .val').textContent = islas.join(', ') || '—';
  p.querySelector('[data-count="map"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="table"]').textContent = `(${f.length})`;

  renderBoatMap(p);
  renderBarcosTable(p);
  renderBarcosChart(p);
  updateSortArrows('barcos');
}

function renderBarcosTable(p) {
  const t = TABS.barcos;
  const tbody = p.querySelector('.tableBody');
  if (t.filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-light);">Sin resultados</td></tr>';
    const pag = p.querySelector('.pagination');
    if (pag) pag.innerHTML = '';
    t._highlightedPort = null;
    return;
  }
  const hp = t._highlightedPort;
  const pageItems = getPageItems(t);
  tbody.innerHTML = pageItems.map(b => {
    const pc = VV.getBaja(b) <= 350 ? 'price-green' : VV.getBaja(b) >= 500 ? 'price-warn' : '';
    const tc = b.tipo === 'Catamarán' ? 'tag-catamaran' : b.tipo === 'Yate a motor' ? 'tag-yate' : 'tag-velero';
    const hl = hp && b.puerto_base === hp ? ' hl-row' : '';
    return `<tr class="${hl}" data-port="${b.puerto_base || ''}">
      <td><strong>${b.modelo}</strong></td>
      <td><span class="tag ${tc}">${b.tipo}</span></td>
      <td>${b.isla}</td>
      <td>${b.puerto_base || '—'}</td>
      <td>${b.eslora_m}m</td>
      <td>${b.plazas}</td>
      <td class="price-cell price-warn">${VV.getAlta(b).toFixed(0)} €</td>
      <td class="price-cell ${pc}" data-edit="${b.id}">${VV.getBaja(b).toFixed(0)} € <span class="edit-price" data-tab="barcos">✏️</span></td>
      <td>${b.rating ? '⭐'.repeat(Math.min(Math.round(b.rating),5)) : '—'}</td>
      <td style="text-align:center;">${b.url ? `<a href="${b.url}" target="_blank" style="text-decoration:none;font-size:16px;">🔗</a>` : '—'}</td>
    </tr>`;
  }).join('');
  let pag = p.querySelector('.pagination');
  if (!pag) {
    pag = document.createElement('div');
    p.querySelector('.table-wrap').after(pag);
  }
  renderPagination('barcos', pag);
}

function renderBarcosChart(p) {
  const t = TABS.barcos;
  if (t.filtered.length === 0) return;
  const prices = t.filtered.map(VV.getBaja).filter(x => x > 0);
  if (!prices.length) return;
  const canvas = p.querySelector('.priceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (t.chart) t.chart.destroy();
  const buckets = VV.buildPriceBuckets(prices, 50);
  const keys = Object.keys(buckets);
  if (!keys.length) return;
  t.chart = new Chart(ctx, {
    type: 'bar', data: {
      labels: keys.map(k => `${k.split('-')[0]}€`),
      datasets: [{ label: 'Barcos', data: Object.values(buckets), backgroundColor: '#00b4d8', borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: true,
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Nº' } },
               x: { title: { display: true, text: '€/día (Sep)' } } },
      plugins: { legend: { display: false } } }
  });
}

const PORT_COORDS = {
  'Marina Ibiza': [38.908, 1.432],
  'Ibiza (Ciudad)': [38.910, 1.435],
  'Sant Antoni de Portmany': [38.978, 1.307],
  'La Savina': [38.731, 1.389],
  'Santa Eulària des Riu': [38.985, 1.537],
  'Ses Salines': [38.942, 1.422],
  'Playa de Talamanca': [38.920, 1.451],
  'Port de Sant Miquel': [39.068, 1.408],
  'Port des Torrent': [38.956, 1.283],
  'Porroig': [38.892, 1.381],
  'Es Jondal': [38.876, 1.352],
};

function renderBoatMap(p) {
  const mapId = 'boatMap';
  const container = p.querySelector('#' + mapId);
  if (!container) return;
  const map = TABS.barcos._map || L.map(mapId, { zoomControl: true, attributionControl: false }).setView([38.92, 1.38], 10);
  if (!TABS.barcos._map) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    TABS.barcos._map = map;
  }
  if (TABS.barcos._markers) map.removeLayer(TABS.barcos._markers);

  const counts = {};
  TABS.barcos.filtered.forEach(b => {
    const pn = b.puerto_base || 'Otro';
    counts[pn] = (counts[pn] || 0) + 1;
  });

  const hp = TABS.barcos._highlightedPort;
  const markers = L.layerGroup();
  const colors = ['#00b4d8', '#ff9f43', '#48c774', '#9b59b6', '#e74c3c', '#f39c12', '#1abc9c'];
  let ci = 0;
  const legendItems = [];
  Object.entries(counts).forEach(([port, count]) => {
    const coords = PORT_COORDS[port];
    if (!coords) return;
    const color = colors[ci++ % colors.length];
    const isHL = hp && port === hp;
    L.circleMarker(coords, {
      radius: isHL ? Math.max(12, Math.min(count * 3, 34)) : Math.max(8, Math.min(count * 2.5, 28)),
      color: isHL ? '#fff' : color,
      fillColor: isHL ? '#e74c3c' : color,
      fillOpacity: isHL ? 0.9 : 0.6, weight: isHL ? 4 : 2
    }).bindPopup(`<strong>${port}</strong><br>${count} barcos`).on('click', function() {
      TABS.barcos._highlightedPort = TABS.barcos._highlightedPort === port ? null : port;
      const panel = document.querySelector('.tab-panel[data-tab="barcos"]');
      renderBarcosTable(panel);
      renderBoatMap(panel);
    }).addTo(markers);
    const hlClass = isHL ? ' style="border:2px solid #e74c3c;border-radius:50%;"' : '';
    legendItems.push(`<span${hlClass}><span class="map-dot" style="background:${color}"></span> ${port} (${count})</span>`);
  });
  markers.addTo(map);
  TABS.barcos._markers = markers;

  const legend = p.querySelector('#boatMapLegend');
  if (legend) legend.innerHTML = legendItems.join('');
  setTimeout(() => map.invalidateSize(), 100);
}

function wireBarcos() {
  const p = document.querySelector('.tab-panel[data-tab="barcos"]');
  p.querySelector('.f-isla').addEventListener('change', applyBarcos);
  p.querySelector('.f-tipo').addEventListener('change', applyBarcos);
  p.querySelector('.f-plazas').addEventListener('change', applyBarcos);
  p.querySelector('.f-patron').addEventListener('change', applyBarcos);
  p.querySelector('.f-pmax').addEventListener('input', function() {
    p.querySelector('.f-pmax-lbl').textContent = `${this.value} €`;
    applyBarcos();
  });
  p.addEventListener('click', e => {
    const ep = e.target.closest('.edit-price');
    if (ep && ep.dataset.tab === 'barcos') {
      const td = ep.closest('td[data-edit]');
      if (!td) return;
      const id = td.dataset.edit;
      const current = TABS.barcos.DATA.barcos.find(b => b.id === id)?.precio_dia_baja || 0;
      VV.editPrice(td, 'barcos', TABS.barcos.DATA, current, (val) => {
        const b = TABS.barcos.DATA.barcos.find(x => x.id === id);
        if (b && !isNaN(val) && val >= 0) { b.precio_dia_baja = val; VV.saveEdits('barcos', TABS.barcos.DATA); }
        applyBarcos();
      });
      return;
    }
    const row = e.target.closest('tr[data-port]');
    if (!row || e.target.closest('a, .edit-price, .page-btn')) return;
    const port = row.dataset.port;
    if (!port) return;
    TABS.barcos._highlightedPort = TABS.barcos._highlightedPort === port ? null : port;
    renderBarcosTable(p);
    renderBoatMap(p);
    updateSortArrows('barcos');
  });
}

// ── VUELOS ──
function populateVuelosFilters() {
  const t = TABS.vuelos;
  if (!t.DATA) return;
  const p = document.querySelector('.tab-panel[data-tab="vuelos"]');
  const rutas = new Set(), fechas = new Set();
  DATA_LOOP: for (const f of t.DATA.alternativas) {
    rutas.add(`${f.origen.codigo}→${f.destino.codigo}`);
    fechas.add(f.fecha);
  }
  p.querySelector('.f-ruta').innerHTML = '<option value="all">Todas</option>' + [...rutas].sort().map(r => `<option value="${r}">${r}</option>`).join('');
  p.querySelector('.f-fecha').innerHTML = '<option value="all">Todas</option>' + [...fechas].sort().map(f => `<option value="${f}">${VV.fmtDate(f)}</option>`).join('');
}

function applyVuelos() {
  const t = TABS.vuelos;
  if (!t.DATA) return;
  const p = document.querySelector('.tab-panel[data-tab="vuelos"]');
  const ruta = p.querySelector('.f-ruta').value;
  const fecha = p.querySelector('.f-fecha').value;
  const tipo = p.querySelector('.f-tipo-v').value;
  const maxPrice = parseInt(p.querySelector('.f-pmax-v').value);

  t.filtered = t.DATA.alternativas.filter(f => {
    if (ruta !== 'all' && `${f.origen.codigo}→${f.destino.codigo}` !== ruta) return false;
    if (fecha !== 'all' && f.fecha !== fecha) return false;
    if (tipo !== 'all' && f.tipo !== tipo) return false;
    if (f.precio_eur > maxPrice) return false;
    return true;
  });
  t.page = 1;
  sortData('vuelos');
  renderVuelos();
}

function renderVuelosNoChart(p) {
  const t = TABS.vuelos;
  const f = t.filtered;
  const toggleSel = function(id) {
    const idx = t.selected.indexOf(id);
    if (idx >= 0) t.selected.splice(idx, 1); else t.selected.push(id);
    renderVuelosTable(p);
    VV.FlightTimeline.render('timelineContainer-viaje', f, t.selected, toggleSel, t.sortField, t.sortAsc);
    updateSortArrows('vuelos');
  };
  VV.FlightTimeline.render('timelineContainer-viaje', f, t.selected, toggleSel, t.sortField, t.sortAsc);
  renderVuelosTable(p);
  p.querySelector('[data-count="timeline"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="table"]').textContent = `(${f.length})`;
  updateSortArrows('vuelos');
}

function renderVuelos() {
  const t = TABS.vuelos;
  const p = document.querySelector('.tab-panel[data-tab="vuelos"]');
  const f = t.filtered;

  const prices = f.map(v => v.precio_eur);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const airlines = [...new Set(f.map(v => v.aerolinea))];
  p.querySelector('[data-stat="min"] .val').textContent = prices.length ? `${min.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="max"] .val').textContent = prices.length ? `${max.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="avg"] .val').textContent = prices.length ? `${avg.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="count"] .val').textContent = f.length;
  p.querySelector('[data-stat="airlines"] .val').textContent = airlines.join(', ') || '—';

  renderVuelosNoChart(p);

  // Chart
  if (f.length) {
    const prices2 = f.map(v => v.precio_eur);
    const canvas = p.querySelector('.priceChart');
    if (canvas) {
      if (t.chart) t.chart.destroy();
      const ctx = canvas.getContext('2d');
      const min = Math.floor(Math.min(...prices2) / 10) * 10;
      const max = Math.ceil(Math.max(...prices2) / 10) * 10;
      const step = Math.max(1, Math.ceil((max - min) / 8));
      const buckets = {};
      for (let b = min; b <= max; b += step) buckets[`${b}-${b+step}`] = 0;
      prices2.forEach(p => {
        const bucket = Math.floor((p - min) / step) * step + min;
        if (buckets[`${bucket}-${bucket+step}`] !== undefined) buckets[`${bucket}-${bucket+step}`]++;
      });
      t.chart = new Chart(ctx, {
        type: 'bar', data: {
          labels: Object.keys(buckets).map(k => `${k.split('-')[0]}€`),
          datasets: [{ label: 'Vuelos', data: Object.values(buckets), backgroundColor: '#00b4d8', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: true,
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Nº' } },
                   x: { title: { display: true, text: 'Precio (€)' } } },
          plugins: { legend: { display: false } } }
      });
    }
  }
}

function wireVuelos() {
  const p = document.querySelector('.tab-panel[data-tab="vuelos"]');
  p.querySelector('.f-ruta').addEventListener('change', applyVuelos);
  p.querySelector('.f-fecha').addEventListener('change', applyVuelos);
  p.querySelector('.f-tipo-v').addEventListener('change', applyVuelos);
  p.querySelector('.f-pmax-v').addEventListener('input', function() {
    p.querySelector('.f-pmax-lbl-v').textContent = `${this.value} €`;
    applyVuelos();
  });
  p.addEventListener('click', e => {
    const row = e.target.closest('tr[data-fid]');
    if (!row || e.target.closest('.page-btn, a')) return;
    const id = row.dataset.fid;
    const t = TABS.vuelos;
    const idx = t.selected.indexOf(id);
    if (idx >= 0) t.selected.splice(idx, 1); else t.selected.push(id);
    renderVuelosNoChart(p);
  });
}

function openGoogleFlights() {}

// ── Table header sort ──
function updateSortArrows(tab) {
  const t = TABS[tab];
  const p = document.querySelector(`.tab-panel[data-tab="${tab}"]`);
  if (!p) return;
  const alias = { precio: 'precio_dia_baja', eslora: 'eslora_m', puntuacion: 'rating' };
  p.querySelectorAll('th[data-sort]').forEach(th => {
    const span = th.querySelector('.sort-arrow');
    if (!span) return;
    const ds = th.dataset.sort;
    const match = ds === t.sortField || alias[t.sortField] === ds || alias[ds] === t.sortField;
    if (match) {
      span.textContent = t.sortAsc ? ' ▲' : ' ▼';
      th.classList.add('active');
    } else {
      span.textContent = '';
      th.classList.remove('active');
    }
  });
}

function wireTableSort(tab) {
  const p = document.querySelector(`.tab-panel[data-tab="${tab}"]`);
  if (!p) return;
  const t = TABS[tab];
  p.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (t.sortField === field) t.sortAsc = !t.sortAsc;
      else { t.sortField = field; t.sortAsc = true; }
      t.page = 1;
      sortData(tab);
      if (tab === 'barcos') renderBarcos();
      else if (tab === 'vuelos') renderVuelos();
    });
  });
}

// ── Scraper API ──
let _serverOk = null;

async function probeServer() {
  try {
    const r = await fetch('/api/scrape/barcos', { method: 'OPTIONS', signal: AbortSignal.timeout(2000) });
    _serverOk = true;
  } catch {
    _serverOk = false;
  }
}

function showStaticHint(p) {
  const bar = document.createElement('div');
  bar.className = 'search-result-bar';
  bar.style.cssText = 'background:#fff8e1;color:#e65100;display:block;line-height:1.5;font-weight:400;font-size:12px;';
  bar.innerHTML = `<strong>🔍 Modo lectura</strong> — Los datos actuales son los que ves en pantalla.
    Para rescrapear con nuevos parámetros:
    <code style="background:#eee;padding:1px 6px;border-radius:4px;font-size:11px;">python server.py</code>
    y abre <code style="background:#eee;padding:1px 6px;border-radius:4px;font-size:11px;">http://localhost:8080</code>`;
  const old = p.querySelector('.search-result-bar');
  if (old) old.remove();
  const searchBar = p.querySelector('.search-bar');
  if (searchBar) searchBar.after(bar);
}

async function runScraper(type) {
  const p = document.querySelector(`.tab-panel[data-tab="${type}"]`);
  if (!p) return;
  const btn = p.querySelector('.btn-search');
  const spinner = p.querySelector('.spinner');

  if (_serverOk === false) {
    showStaticHint(p);
    return;
  }

  btn.disabled = true;
  spinner.style.display = 'inline-flex';
  const old = p.querySelector('.search-result-bar');
  if (old) old.remove();

  const params = {};
  if (type === 'barcos') {
    const isla = p.querySelector('.s-isla').value;
    params.islands = [{ isla, puertos: [isla], slug: isla.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }];
    const tipo = p.querySelector('.s-tipo').value;
    if (tipo !== 'all') params.tipo = tipo;
  } else if (type === 'vuelos') {
    const origen = p.querySelector('.s-origen').value;
    const destino = p.querySelector('.s-destino-v').value;
    const fechaIda = p.querySelector('.s-fecha-ida').value;
    const fechaVuelta = p.querySelector('.s-fecha-vuelta').value;
    params.routes = [[origen, destino, origen, destino]];
    params.dates = [fechaIda, fechaVuelta];
  }

  try {
    const res = await fetch(`/api/scrape/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();

    if (data.status === 'ok' && data.data) {
      TABS[type].DATA = data.data;
      if (TABS[type].chart) { TABS[type].chart.destroy(); TABS[type].chart = null; }
      TABS[type].selected = [];
      TABS[type]._rendered = false;
      if (type === 'barcos') TABS.barcos._highlightedPort = null;
      VV.saveEdits(type, data.data);

      if (type === 'barcos') { populateBarcosFilters(); applyBarcos(); }
      else if (type === 'vuelos') { populateVuelosFilters(); applyVuelos(); }

      updateGlobalStats();
      const items = data.data.barcos || data.data.alternativas || [];
      showResultBar(p, `✅ ${items.length} resultados`);
    } else {
      showResultBar(p, `❌ ${data.error || 'Error del scraper'}`, true);
    }
  } catch {
    showStaticHint(p);
    _serverOk = false;
  }

  btn.disabled = false;
  spinner.style.display = 'none';
}

function showResultBar(p, msg, isError) {
  const bar = document.createElement('div');
  bar.className = 'search-result-bar' + (isError ? ' error' : '');
  bar.textContent = msg;
  const old = p.querySelector('.search-result-bar');
  if (old) old.remove();
  const searchBar = p.querySelector('.search-bar');
  if (searchBar) searchBar.after(bar);
  if (!isError) setTimeout(() => { if (bar.parentNode) bar.remove(); }, 6000);
}

window.runScraper = runScraper;

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tabButtons').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (!btn || btn.disabled) return;
    const tab = btn.dataset.tab;
    const page = parseInt(btn.dataset.page);
    if (!tab || !page) return;
    const t = TABS[tab];
    if (!t) return;
    t.page = page;
    const p = document.querySelector(`.tab-panel[data-tab="${tab}"]`);
    if (!p) return;
    if (tab === 'barcos') { renderBarcosTable(p); renderBoatMap(p); updateSortArrows('barcos'); }
    else if (tab === 'vuelos') { renderVuelosNoChart(p); }
  });
  await loadAll();
  await probeServer();
  const modeEl = document.getElementById('modeBadge');
  if (modeEl) modeEl.textContent = _serverOk ? '⚡ servidor' : '📄 datos estáticos';
  window.TABS = TABS;
  window.switchTab = switchTab;
});

})();
