(function() {
'use strict';

let DATA = null;
let filtered = [];
let selected = [];
let sortField = 'precio';
let sortAsc = true;
let priceChart = null;
let sortHistory = [];

const COLORS = { 'Ryanair': '#1565c0', 'Iberia Express': '#e65100', 'Iberia': '#6a1b9a', 'Vueling': '#00838f' };

function formatDate(d) {
  if (!d) return '';
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [y, m, day] = d.split('-');
  return `${parseInt(day)} ${meses[parseInt(m)-1]}`;
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.alternativas) {
        DATA = imported;
        VV.loadEdits('vuelos', DATA);
        populateFilters(); applyFilters(); updateStatus();
        document.getElementById('statusMsg').innerHTML = '✅ Datos importados de <code>' + file.name + '</code>';
      }
    } catch(err) { alert('Error: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function updateStatus() {
  if (!DATA) return;
  const meta = DATA.metadata || {};
  document.getElementById('statsFuente').textContent = meta.fuente || 'desconocida';
  const n = DATA.alternativas.length;
  const editSpan = document.getElementById('statusEdits');
  try {
    const edits = JSON.parse(localStorage.getItem('vuelos_edits') || '{}');
    const ec = Object.keys(edits).length;
    if (ec > 0) { editSpan.style.display = 'inline'; editSpan.textContent = '✏️ ' + ec + ' edits locales'; }
    else editSpan.style.display = 'none';
  } catch(e) { editSpan.style.display = 'none'; }
  document.getElementById('statusCount').textContent = n;
  document.getElementById('statusMsg').innerHTML = '✅ Cargado';
}

async function loadData() {
  try {
    const r = await fetch('data/vuelos.json');
    DATA = await r.json();
    VV.loadEdits('vuelos', DATA);
    updateStatus(); populateFilters(); applyFilters();
  } catch (e) {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-light);">⚠️ No se pudo cargar data/vuelos.json.</td></tr>`;
    document.getElementById('statusMsg').textContent = '❌ No se pudo cargar data/vuelos.json';
  }
}

function populateFilters() {
  const rutaSel = document.getElementById('filterRuta');
  const fechaSel = document.getElementById('filterFecha');
  const rutas = new Set();
  const fechas = new Set();
  DATA.alternativas.forEach(f => {
    rutas.add(f.origen.codigo + '→' + f.destino.codigo);
    fechas.add(f.fecha);
  });
  rutaSel.innerHTML = '<option value="all">Todas las rutas</option>' + [...rutas].sort().map(r => `<option value="${r}">${r}</option>`).join('');
  fechaSel.innerHTML = '<option value="all">Todas las fechas</option>' + [...fechas].sort().map(f => `<option value="${f}">${formatDate(f)}</option>`).join('');
}

function applyFilters() {
  const ruta = document.getElementById('filterRuta').value;
  const fecha = document.getElementById('filterFecha').value;
  const tipo = document.getElementById('filterTipo').value;
  const maxPrice = parseInt(document.getElementById('priceMax').value);

  filtered = DATA.alternativas.filter(f => {
    if (ruta !== 'all' && (f.origen.codigo + '→' + f.destino.codigo) !== ruta) return false;
    if (fecha !== 'all' && f.fecha !== fecha) return false;
    if (tipo !== 'all' && f.tipo !== tipo) return false;
    if (f.precio_eur > maxPrice) return false;
    return true;
  });
  sortData(); updateUI();
}

function sortData() {
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'precio': cmp = a.precio_eur - b.precio_eur; break;
      case 'salida': cmp = VV.timeToMins(a.salida) - VV.timeToMins(b.salida); break;
      case 'llegada': cmp = VV.timeToMins(a.llegada) - VV.timeToMins(b.llegada); break;
      case 'duracion': cmp = (a.duracion_min||0) - (b.duracion_min||0); break;
      case 'aerolinea': cmp = a.aerolinea.localeCompare(b.aerolinea); break;
      case 'ruta': cmp = (a.origen.codigo+'→'+a.destino.codigo).localeCompare(b.origen.codigo+'→'+b.destino.codigo); break;
      case 'fecha': cmp = a.fecha.localeCompare(b.fecha); break;
    }
    return sortAsc ? cmp : -cmp;
  });
}

function sortBy(field) {
  if (sortHistory.length && sortHistory[sortHistory.length-1] === field) {
    sortAsc = !sortAsc;
  } else {
    sortField = field; sortAsc = true;
    sortHistory.push(field);
    if (sortHistory.length > 3) sortHistory.shift();
  }
  sortData(); renderTable(); renderTimeline();
}

function toggleSelect(id) {
  const idx = selected.indexOf(id);
  if (idx >= 0) selected.splice(idx, 1);
  else if (selected.length < 4) selected.push(id);
  renderTable(); renderTimeline(); updateComparisonBar();
}

function clearSelection() { selected = []; renderTable(); renderTimeline(); updateComparisonBar(); }

function updateComparisonBar() {
  const bar = document.getElementById('comparisonBar');
  if (selected.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  document.getElementById('comparisonCount').textContent = selected.length;
  const flights = selected.map(id => DATA.alternativas.find(f => f.id === id)).filter(Boolean);
  document.getElementById('comparisonTotal').textContent = 'Total: ' + flights.reduce((s, f) => s + f.precio_eur, 0).toFixed(2) + ' €';
}

function updateStats() {
  if (filtered.length === 0) {
    ['statMinPrice','statAvgPrice','statMaxPrice','statCount','statAirlines'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }
  const prices = filtered.map(f => f.precio_eur);
  document.getElementById('statMinPrice').textContent = Math.min(...prices).toFixed(0) + ' €';
  document.getElementById('statMaxPrice').textContent = Math.max(...prices).toFixed(0) + ' €';
  document.getElementById('statAvgPrice').textContent = (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(0) + ' €';
  document.getElementById('statCount').textContent = filtered.length;
  const airlines = new Set(filtered.map(f => f.aerolinea));
  document.getElementById('statAirlines').textContent = [...airlines].join(', ');
  document.getElementById('statsTotal').textContent = filtered.length + ' vuelos';
  document.getElementById('timelineCount').textContent = '(' + filtered.length + ' vuelos)';
  document.getElementById('tableCount').textContent = '(' + filtered.length + ' vuelos)';
}

function renderTimeline() {
  VV.FlightTimeline.render('timelineContainer', filtered, selected, toggleSelect);
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-light);">No hay vuelos que coincidan con los filtros</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(f => {
    const sel = selected.includes(f.id);
    const pc = f.precio_eur <= 50 ? 'price-green' : f.precio_eur >= 100 ? 'price-warn' : '';
    return `<tr class="${sel ? 'selected-row' : ''}">
      <td><strong>${f.aerolinea}</strong> <span style="color:var(--text-light);font-size:11px;">${f.vuelo}</span></td>
      <td>${f.origen.codigo} → ${f.destino.codigo}</td>
      <td>${formatDate(f.fecha)}</td>
      <td>${f.salida}</td>
      <td>${f.llegada}</td>
      <td>${VV.minsToStr(f.duracion_min)}</td>
      <td class="price-cell ${pc}" id="price-${f.id}">
        ${f.precio_eur.toFixed(0)} <small>€</small>
        <span class="edit-price" onclick="event.stopPropagation();editPrice('${f.id}')" title="Editar precio">✏️</span>
      </td>
      <td style="text-align:center;" onclick="toggleSelect('${f.id}')">${sel ? '✅' : '☐'}</td>
    </tr>`;
  }).join('');
}

function renderCombos() {
  const container = document.getElementById('comboList');
  const combos = DATA.combinaciones || [];
  document.getElementById('comboCount').textContent = '(' + combos.length + ' combinaciones)';
  if (combos.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-light);font-size:13px;">No hay combinaciones definidas.</div>';
    return;
  }
  container.innerHTML = combos.map(c => {
    const ida = DATA.alternativas.find(f => f.id === c.ida_id);
    const vuelta = DATA.alternativas.find(f => f.id === c.vuelta_id);
    const pc = c.precio_total <= 100 ? 'price-green' : c.precio_total >= 180 ? 'price-warn' : '';
    const gfUrl = ida ? `https://www.google.com/travel/flights?q=Flights+to+${ida.destino.codigo}+from+${ida.origen.codigo}+on+${ida.fecha}&curr=EUR` : '#';
    return `<div class="combo-card">
      <div class="combo-price ${pc}">${c.precio_total.toFixed(0)} €</div>
      <div class="combo-detail">
        <strong>${c.origen_nombre}</strong> → ${ida ? `${ida.destino.nombre} <span style="color:var(--text-light);font-size:11px;">(${ida.aerolinea} ${ida.salida})</span>` : '?'}
        ${vuelta ? `<span style="color:var(--text-light);font-size:11px;"> · Vuelta: ${vuelta.aerolinea} ${vuelta.salida}</span>` : ''}
        <span style="display:block;margin-top:4px;"><a href="${gfUrl}" target="_blank" style="font-size:10px;color:var(--accent);text-decoration:none;">🔗 Google Flights</a></span>
      </div>
    </div>`;
  }).join('');
}

function renderChart() {
  if (filtered.length === 0) return;
  const prices = filtered.map(f => f.precio_eur);
  const min = Math.floor(Math.min(...prices) / 10) * 10;
  const max = Math.ceil(Math.max(...prices) / 10) * 10;
  const step = Math.max(1, Math.ceil((max - min) / 8));
  const buckets = {};
  for (let b = min; b <= max; b += step) buckets[`${b}-${b+step}`] = 0;
  prices.forEach(p => {
    const bucket = Math.floor((p - min) / step) * step + min;
    if (buckets[`${bucket}-${bucket+step}`] !== undefined) buckets[`${bucket}-${bucket+step}`]++;
  });
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChart) priceChart.destroy();
  priceChart = new Chart(ctx, {
    type:'bar', data: {
      labels: Object.keys(buckets).map(k => `${k.split('-')[0]}€`),
      datasets: [{ label:'Vuelos', data: Object.values(buckets), backgroundColor:'#00b4d8', borderRadius:4 }]
    },
    options: { responsive:true, maintainAspectRatio:true,
      scales: { y: { beginAtZero:true, ticks:{stepSize:1}, title:{display:true, text:'Nº vuelos'} },
               x: { title:{display:true, text:'Precio (€)'} } },
      plugins: { legend:{display:false} } }
  });
}

// ── Edit price ──
window.editPrice = function(id) {
  const f = DATA.alternativas.find(x => x.id === id);
  if (!f) return;
  const cell = document.getElementById('price-' + id);
  cell.innerHTML = `<input type="number" class="price-input" value="${f.precio_eur}" step="0.01" min="0" id="input-${id}" onblur="savePrice('${id}')" onkeydown="if(event.key==='Enter')savePrice('${id}');if(event.key==='Escape')cancelEdit('${id}','${f.precio_eur}')">`;
  document.getElementById('input-' + id).focus();
};

window.savePrice = function(id) {
  const input = document.getElementById('input-' + id);
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) return;
  const f = DATA.alternativas.find(x => x.id === id);
  if (!f) return;
  f.precio_eur = val;
  const edits = {};
  DATA.alternativas.forEach(x => edits[x.id] = x.precio_eur);
  try { localStorage.setItem('vuelos_edits', JSON.stringify(edits)); } catch(e) {}
  applyFilters();
};

window.cancelEdit = function(id, original) {
  const f = DATA.alternativas.find(x => x.id === id);
  if (f) f.precio_eur = parseFloat(original);
  applyFilters();
};

function openGoogleFlights() {
  const ruta = document.getElementById('filterRuta').value;
  const fecha = document.getElementById('filterFecha').value;
  if (ruta !== 'all' && fecha !== 'all') {
    const parts = ruta.split('→');
    window.open(`https://www.google.com/travel/flights?q=Flights+to+${parts[1]}+from+${parts[0]}+on+${fecha}&curr=EUR`, '_blank');
    return;
  }
  const rutas = [...new Set(DATA.alternativas.map(f => f.origen.codigo + '→' + f.destino.codigo))];
  const fechas = [...new Set(DATA.alternativas.map(f => f.fecha))].sort();
  const targetDate = fechas[0] || '2026-09-01';
  rutas.forEach(r => {
    const [o, d] = r.split('→');
    window.open(`https://www.google.com/travel/flights?q=Flights+to+${d}+from+${o}+on+${targetDate}&curr=EUR`, '_blank');
  });
}

function exportJSON() {
  const meta = DATA.metadata || {};
  meta.generado = new Date().toISOString().slice(0, 16).replace('T', ' ');
  meta.fuente = 'comparador-vuelos.html (edicion manual)';
  DATA.metadata = meta;
  VV.FlightTimeline._buildCombos = function() {
    const ida = DATA.alternativas.filter(f => f.tipo === 'ida');
    const vuelta = DATA.alternativas.filter(f => f.tipo === 'vuelta');
    const combos = [];
    for (const f of ida) {
      const returns = vuelta.filter(r => r.origen.codigo === f.destino.codigo && r.destino.codigo === f.origen.codigo);
      for (const r of returns) {
        combos.push({ persona: f.origen.codigo + '→' + f.destino.codigo, origen: f.origen.codigo, origen_nombre: f.origen.nombre, ida_id: f.id, vuelta_id: r.id, precio_total: Math.round((f.precio_eur + r.precio_eur) * 100) / 100 });
      }
    }
    return combos;
  };
  DATA.combinaciones = VV.FlightTimeline._buildCombos();
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vuelos-actualizados.json';
  a.click();
}

function updateUI() {
  updateStats(); renderTable(); renderTimeline(); renderChart(); renderCombos(); updateComparisonBar();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  document.getElementById('filterRuta').addEventListener('change', applyFilters);
  document.getElementById('filterFecha').addEventListener('change', applyFilters);
  document.getElementById('filterTipo').addEventListener('change', applyFilters);
  document.getElementById('filterSort').addEventListener('change', function() {
    const v = this.value;
    sortField = v.replace('-desc', ''); sortAsc = !v.includes('-desc'); applyFilters();
  });
  document.getElementById('priceMax').addEventListener('input', function() {
    document.getElementById('priceMaxLabel').textContent = this.value + ' €'; applyFilters();
  });

  if (DATA) { populateFilters(); applyFilters(); }
  window.addEventListener('resize', renderTimeline);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') clearSelection(); });

  window.exportJSON = exportJSON;
  window.importJSON = importJSON;
  window.sortBy = sortBy;
  window.toggleSelect = toggleSelect;
  window.clearSelection = clearSelection;
  window.openGoogleFlights = openGoogleFlights;
});

})();
