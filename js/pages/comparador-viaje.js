(function() {
'use strict';

const TABS = {
  barcos: { DATA: null, filtered: [], sortField: 'precio_dia_baja', sortAsc: true, chart: null, _rendered: false,
    storageKey: 'barcos_edits', dataFile: 'data/barcos.json', importId: 'importBarcos' },
  vuelos: { DATA: null, filtered: [], sortField: 'precio', sortAsc: true, chart: null, selected: [], _rendered: false,
    storageKey: 'vuelos_edits', dataFile: 'data/vuelos.json', importId: 'importVuelos' },
  alojamientos: { DATA: null, filtered: [], sortField: 'precio_total_eur', sortAsc: true, chart: null, _rendered: false,
    storageKey: 'alojamientos_edits', dataFile: 'data/alojamientos.json', importId: 'importAloj' },
};

let currentTab = 'barcos';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  const t = TABS[tab];
  if (t && t.DATA && !t._rendered) { t._rendered = true; t.applyFilters(); }
  if (tab === 'vuelos' && t.DATA) setTimeout(() => t.renderTimeline(), 50);
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
    t.exportJSON = () => exportBarcosJSON();
    t.applyFilters();
    VV.updateWF('barcos', t.DATA, document.querySelector('.tab-panel[data-tab="barcos"]'));
    wireBarcos();
  }
  if (TABS.vuelos.DATA) {
    const t = TABS.vuelos;
    populateVuelosFilters();
    t.applyFilters = () => { applyVuelos(); };
    t.exportJSON = () => exportVuelosJSON();
    t.openGF = () => openGoogleFlights();
    t.clearSel = () => { t.selected = []; applyVuelos(); };
    VV.updateWF('vuelos', t.DATA, document.querySelector('.tab-panel[data-tab="vuelos"]'));
    wireVuelos();
  }
  if (TABS.alojamientos.DATA) {
    const t = TABS.alojamientos;
    populateAlojFilters();
    t.applyFilters = () => { applyAloj(); };
    t.exportJSON = () => exportAlojJSON();
    VV.updateWF('alojamientos', t.DATA, document.querySelector('.tab-panel[data-tab="alojamientos"]'));
    wireAloj();
  }
  updateGlobalStats();
}

function updateGlobalStats() {
  const parts = [];
  for (const [k, t] of Object.entries(TABS)) {
    if (!t.DATA) continue;
    const arr = t.DATA.barcos || t.DATA.alternativas || t.DATA.alojamientos || [];
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
  t.sortAsc = true;
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
      if (sf === 'precio' || sf === 'precio_dia_baja') cmp = (b.precio_dia_baja||0) - (a.precio_dia_baja||0);
      else if (sf === 'precio_dia_alta') cmp = (b.precio_dia_alta||0) - (a.precio_dia_alta||0);
      else if (sf === 'eslora') cmp = (a.eslora_m||0) - (b.eslora_m||0);
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
    } else if (tab === 'alojamientos') {
      const pa = VV.fmtPrice(a.precio_total_eur);
      const pb = VV.fmtPrice(b.precio_total_eur);
      if (sf === 'precio' || sf === 'precio_total_eur') cmp = (pa||Infinity) - (pb||Infinity);
      else if (sf === 'puntuacion') cmp = (b.puntuacion||0) - (a.puntuacion||0);
      else if (sf === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      else if (sf === 'fuente') cmp = a.fuente.localeCompare(b.fuente);
      else if (sf === 'ciudad') cmp = a.ciudad.localeCompare(b.ciudad);
    }
    return t.sortAsc ? cmp : -cmp;
  });
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
  p.querySelector('[data-count="bar"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="scenarios"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="table"]').textContent = `(${f.length})`;

  // Bar chart
  const barContainer = p.querySelector('.barChart');
  if (f.length === 0) {
    barContainer.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;">Sin datos</div>';
  } else {
    const maxP = Math.max(...f.map(VV.getAlta), 1);
    const sorted = [...f].sort((a, b) => VV.getBaja(a) - VV.getBaja(b));
    barContainer.innerHTML = '<div class="bar-chart-container">' +
      sorted.map(b => {
        const wB = (VV.getBaja(b) / maxP) * 100;
        const wA = (VV.getAlta(b) / maxP) * 100;
        return `<div class="bar-row">
          <div class="bar-label">${b.modelo} <small>${b.plazas} pax</small></div>
          <div class="bar-track">
            <div class="bar-fill orange" style="width:${wA}%">${VV.getAlta(b)}€</div>
            <div class="bar-fill blue" style="width:${wB}%">${VV.getBaja(b)}€</div>
          </div>
          <div class="bar-value">${VV.getBaja(b)}€</div>
        </div>`;
      }).join('') + '</div>';
  }

  // Scenarios
  const scContainer = p.querySelector('.scenarioList');
  const scenarios = f.map(b => ({
    ...b, porPersona: Math.round(((VV.getBaja(b) + 50) * 3) / 6)
  })).sort((a, b) => a.porPersona - b.porPersona);
  scContainer.innerHTML = scenarios.map((s, i) => {
    const rc = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
    const tc = s.tipo === 'Catamarán' ? 'tag-catamaran' : s.tipo === 'Yate a motor' ? 'tag-yate' : 'tag-velero';
    return `<div class="scenario-card">
      <div class="scenario-rank ${rc}">#${i+1}</div>
      <div class="scenario-detail"><strong>${s.modelo}</strong> <span class="tag ${tc}">${s.tipo}</span>
        <span style="color:var(--text-light);">· ${s.isla} · ${s.puerto_base||'?'}</span><br>
        <span style="font-size:11px;color:var(--text-light);">${s.eslora_m}m · ${s.plazas} plazas · ${VV.getBaja(s)}€/día</span></div>
      <div class="scenario-price ${rc}">${s.porPersona}€ <small style="display:block;font-size:11px;color:var(--text-light);font-weight:400;">/pers</small></div>
    </div>`;
  }).join('');

  renderBarcosTable(p);
  renderBarcosChart(p);
}

function renderBarcosTable(p) {
  const t = TABS.barcos;
  const tbody = p.querySelector('.tableBody');
  if (t.filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-light);">Sin resultados</td></tr>';
    return;
  }
  tbody.innerHTML = t.filtered.map(b => {
    const pc = VV.getBaja(b) <= 350 ? 'price-green' : VV.getBaja(b) >= 500 ? 'price-warn' : '';
    const tc = b.tipo === 'Catamarán' ? 'tag-catamaran' : b.tipo === 'Yate a motor' ? 'tag-yate' : 'tag-velero';
    return `<tr>
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

function wireBarcos() {
  const p = document.querySelector('.tab-panel[data-tab="barcos"]');
  p.querySelector('.f-isla').addEventListener('change', applyBarcos);
  p.querySelector('.f-tipo').addEventListener('change', applyBarcos);
  p.querySelector('.f-plazas').addEventListener('change', applyBarcos);
  p.querySelector('.f-patron').addEventListener('change', applyBarcos);
  p.querySelector('.f-sort').addEventListener('change', function() {
    const v = this.value;
    TABS.barcos.sortField = v.replace('-desc', '');
    TABS.barcos.sortAsc = !v.includes('-desc');
    sortData('barcos'); renderBarcos();
  });
  p.querySelector('.f-pmax').addEventListener('input', function() {
    p.querySelector('.f-pmax-lbl').textContent = `${this.value} €`;
    applyBarcos();
  });
  p.addEventListener('click', e => {
    const ep = e.target.closest('.edit-price');
    if (!ep || ep.dataset.tab !== 'barcos') return;
    const td = ep.closest('td[data-edit]');
    if (!td) return;
    const id = td.dataset.edit;
    const current = TABS.barcos.DATA.barcos.find(b => b.id === id)?.precio_dia_baja || 0;
    VV.editPrice(td, 'barcos', TABS.barcos.DATA, current, (val) => {
      const b = TABS.barcos.DATA.barcos.find(x => x.id === id);
      if (b && !isNaN(val) && val >= 0) { b.precio_dia_baja = val; VV.saveEdits('barcos', TABS.barcos.DATA); }
      applyBarcos();
    });
  });
  document.getElementById('importBarcos').addEventListener('change', e => {
    VV.importJSON(e.target.files[0], (imported) => {
      if (imported.barcos) { TABS.barcos.DATA = imported; VV.loadEdits('barcos', imported);
        populateBarcosFilters(); applyBarcos(); VV.updateWF('barcos', imported, p); }
    });
    e.target.value = '';
  });
}

function exportBarcosJSON() {
  VV.exportJSON(TABS.barcos.DATA, 'barcos-actualizados.json');
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
  t.sortAsc = true;
  sortData('vuelos');
  renderVuelos();
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

  // Timeline
  VV.FlightTimeline.render('timelineContainer-viaje', f, t.selected, function(id) {
    const idx = t.selected.indexOf(id);
    if (idx >= 0) t.selected.splice(idx, 1);
    else t.selected.push(id);
    renderVuelos();
  });

  // Table
  const tbody = p.querySelector('.tableBody');
  tbody.innerHTML = f.map(v => {
    const sel = t.selected.includes(v.id);
    const pc = v.precio_eur <= 50 ? 'price-green' : v.precio_eur >= 100 ? 'price-warn' : '';
    return `<tr class="${sel ? 'selected-row' : ''}">
      <td><strong>${v.aerolinea}</strong> <span style="font-size:11px;color:var(--text-light);">${v.vuelo}</span></td>
      <td>${v.origen.codigo} → ${v.destino.codigo}</td>
      <td>${VV.fmtDate(v.fecha)}</td>
      <td>${v.salida}</td>
      <td>${v.llegada}</td>
      <td>${VV.minsToStr(v.duracion_min)}</td>
      <td class="price-cell ${pc}">${v.precio_eur.toFixed(0)} €</td>
      <td style="text-align:center;" onclick="const idx = TABS.vuelos.selected.indexOf('${v.id}'); if(idx>=0)TABS.vuelos.selected.splice(idx,1); else TABS.vuelos.selected.push('${v.id}'); applyVuelos();">${sel ? '✅' : '☐'}</td>
    </tr>`;
  }).join('');
  p.querySelector('[data-count="timeline"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="table"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="combos"]').textContent = `(${(t.DATA.combinaciones||[]).length})`;

  // Combos
  const combos = t.DATA.combinaciones || [];
  p.querySelector('.comboList').innerHTML = combos.map(c => {
    const ida = t.DATA.alternativas.find(f => f.id === c.ida_id);
    const pc2 = c.precio_total <= 100 ? 'price-green' : c.precio_total >= 180 ? 'price-warn' : '';
    return `<div class="combo-card">
      <div class="combo-price ${pc2}">${c.precio_total.toFixed(0)} €</div>
      <div class="combo-detail"><strong>${c.origen_nombre}</strong> → ${ida ? ida.destino.nombre : '?'}</div>
    </div>`;
  }).join('');

  // Update comparison bar
  const bar = p.querySelector('.comparison-bar');
  if (t.selected.length === 0) bar.style.display = 'none';
  else {
    bar.style.display = 'flex';
    bar.querySelector('.sel-count').textContent = t.selected.length;
    const flights = t.selected.map(id => t.DATA.alternativas.find(f => f.id === id)).filter(Boolean);
    bar.querySelector('.sel-total').textContent = 'Total: ' + flights.reduce((s, f) => s + f.precio_eur, 0).toFixed(2) + ' €';
  }

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
  p.querySelector('.f-sort-v').addEventListener('change', function() {
    const v = this.value;
    TABS.vuelos.sortField = v.replace('-desc', '');
    TABS.vuelos.sortAsc = !v.includes('-desc');
    sortData('vuelos'); renderVuelos();
  });
  document.getElementById('importVuelos').addEventListener('change', e => {
    VV.importJSON(e.target.files[0], (imported) => {
      if (imported.alternativas) { TABS.vuelos.DATA = imported; VV.loadEdits('vuelos', imported);
        populateVuelosFilters(); applyVuelos(); VV.updateWF('vuelos', imported, p); }
    });
    e.target.value = '';
  });
}

function exportVuelosJSON() {
  VV.exportJSON(TABS.vuelos.DATA, 'vuelos-actualizados.json');
}

function openGoogleFlights() {}

// ── ALOJAMIENTOS ──
function populateAlojFilters() {
  const t = TABS.alojamientos;
  if (!t.DATA) return;
  const p = document.querySelector('.tab-panel[data-tab="alojamientos"]');
  const zonas = [...new Set(t.DATA.alojamientos.map(a => a.ciudad))].sort();
  p.querySelector('.f-zona').innerHTML = '<option value="all">Todas</option>' + zonas.map(z => `<option value="${z}">${z}</option>`).join('');
}

function applyAloj() {
  const t = TABS.alojamientos;
  if (!t.DATA) return;
  const p = document.querySelector('.tab-panel[data-tab="alojamientos"]');
  const zona = p.querySelector('.f-zona').value;
  const fuente = p.querySelector('.f-fuente').value;
  const maxPrice = parseInt(p.querySelector('.f-pmax-a').value);
  const minRating = parseFloat(p.querySelector('.f-rating').value);

  t.filtered = t.DATA.alojamientos.filter(a => {
    if (zona !== 'all' && a.ciudad !== zona) return false;
    if (fuente !== 'all' && a.fuente !== fuente) return false;
    const pr = VV.fmtPrice(a.precio_total_eur);
    if (pr == null || pr > maxPrice) return false;
    if (a.puntuacion != null && a.puntuacion < minRating) return false;
    return true;
  });
  t.sortAsc = true;
  sortData('alojamientos');
  renderAloj();
}

function renderAloj() {
  const t = TABS.alojamientos;
  const p = document.querySelector('.tab-panel[data-tab="alojamientos"]');
  const f = t.filtered;

  const prices = f.map(a => VV.fmtPrice(a.precio_total_eur)).filter(x => x != null);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const zonas = [...new Set(f.map(a => a.ciudad))];
  p.querySelector('[data-stat="min"] .val').textContent = prices.length ? `${min.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="max"] .val').textContent = prices.length ? `${max.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="avg"] .val').textContent = prices.length ? `${avg.toFixed(0)} €` : '—';
  p.querySelector('[data-stat="count"] .val').textContent = f.length;
  p.querySelector('[data-stat="zonas"] .val').textContent = zonas.join(', ') || '—';

  // Bar chart
  VV.renderBarChart('barChartAloj', f, a => VV.fmtPrice(a.precio_total_eur) || 0, null,
    a => a.nombre.substring(0, 28), a => a.ciudad, Math.max(...f.map(a => VV.fmtPrice(a.precio_total_eur) || 0), 1));

  // Table
  const tbody = p.querySelector('.tableBody');
  tbody.innerHTML = f.map(a => {
    const pr = VV.fmtPrice(a.precio_total_eur);
    const pc = pr != null && pr <= 250 ? 'price-green' : pr != null && pr >= 500 ? 'price-warn' : '';
    return `<tr>
      <td><strong>${a.nombre.substring(0, 40)}</strong></td>
      <td>${a.fuente}</td>
      <td>${a.ciudad}</td>
      <td>${a.puntuacion ? '⭐'.repeat(Math.min(Math.round(a.puntuacion/2), 5)) : '—'}</td>
      <td class="price-cell ${pc}">${pr != null ? pr.toFixed(0) + ' €' : '—'}</td>
      <td style="font-size:10px;color:var(--text-light);">${(a.servicios||[]).slice(0, 3).join(', ')}</td>
      <td style="text-align:center;">${(a.url && a.url.startsWith('http')) ? `<a href="${a.url}" target="_blank" style="text-decoration:none;font-size:16px;">🔗</a>` : '—'}</td>
    </tr>`;
  }).join('');
  p.querySelector('[data-count="bar"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="cards"]').textContent = `(${f.length})`;
  p.querySelector('[data-count="table"]').textContent = `(${f.length})`;

  if (f.length && prices.length) {
    const canvas = p.querySelector('.priceChart');
    if (canvas) {
      if (t.chart) t.chart.destroy();
      const ctx = canvas.getContext('2d');
      const min = Math.floor(Math.min(...prices) / 50) * 50;
      const max = Math.ceil(Math.max(...prices) / 50) * 50;
      const step = Math.max(25, Math.ceil((max - min) / 8));
      const buckets = {};
      for (let b = min; b <= max; b += step) buckets[`${b}-${b+step}`] = 0;
      prices.forEach(p => {
        const bucket = Math.floor((p - min) / step) * step + min;
        if (buckets[`${bucket}-${bucket+step}`] !== undefined) buckets[`${bucket}-${bucket+step}`]++;
      });
      t.chart = new Chart(ctx, {
        type: 'bar', data: {
          labels: Object.keys(buckets).map(k => `${k.split('-')[0]}€`),
          datasets: [{ label: 'Alojamientos', data: Object.values(buckets), backgroundColor: '#00b4d8', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: true,
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Nº' } },
                   x: { title: { display: true, text: 'Precio total (€)' } } },
          plugins: { legend: { display: false } } }
      });
    }
  }
}

function wireAloj() {
  const p = document.querySelector('.tab-panel[data-tab="alojamientos"]');
  p.querySelector('.f-zona').addEventListener('change', applyAloj);
  p.querySelector('.f-fuente').addEventListener('change', applyAloj);
  p.querySelector('.f-pmax-a').addEventListener('input', function() {
    p.querySelector('.f-pmax-lbl-a').textContent = `${this.value} €`;
    applyAloj();
  });
  p.querySelector('.f-rating').addEventListener('change', applyAloj);
  p.querySelector('.f-sort-a').addEventListener('change', function() {
    const v = this.value;
    TABS.alojamientos.sortField = v.replace('-desc', '');
    TABS.alojamientos.sortAsc = !v.includes('-desc');
    sortData('alojamientos'); renderAloj();
  });
  document.getElementById('importAloj').addEventListener('change', e => {
    VV.importJSON(e.target.files[0], (imported) => {
      if (imported.alojamientos) { TABS.alojamientos.DATA = imported; VV.loadEdits('alojamientos', imported);
        populateAlojFilters(); applyAloj(); VV.updateWF('alojamientos', imported, p); }
    });
    e.target.value = '';
  });
}

function exportAlojJSON() {
  VV.exportJSON(TABS.alojamientos.DATA, 'alojamientos-actualizados.json');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tabButtons').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });
  await loadAll();
  window.TABS = TABS;
  window.switchTab = switchTab;
});

})();
