(function() {
'use strict';

let DATA = null;
let filtered = [];
let sortField = 'precio_total_eur';
let sortAsc = true;
let priceChart = null;
let sortHistory = [];

const ZONE_GROUP = {
  'Ibiza - Marina': { group: 'La Marina', dot: 'centro', label: 'La Marina (a pie 2min)' },
  'Eivissa (centro)': { group: 'Centro', dot: 'centro', label: 'Centro (a pie 10min)' },
  'Ibiza': { group: 'Ibiza', dot: 'centro', label: 'Ibiza (a pie 10-20min)' },
};
const TAXI_COST = { 'Ibiza - Marina': 0, 'Eivissa (centro)': 0, 'Ibiza': 0 };
const ZONE_ORDER = ['Ibiza - Marina', 'Eivissa (centro)', 'Ibiza'];

function getPrice(a) {
  return (a.precio_total_eur != null && a.precio_total_eur > 1) ? a.precio_total_eur : null;
}
function getTaxi(a) { return TAXI_COST[a.ciudad] !== undefined ? TAXI_COST[a.ciudad] : 35; }
function getTotal(a) { const p = getPrice(a); return p != null ? p + getTaxi(a) : null; }

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.alojamientos) {
        DATA = imported;
        VV.loadEdits('alojamientos', DATA);
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
  const n = DATA.alojamientos.length;
  const editSpan = document.getElementById('statusEdits');
  try {
    const edits = JSON.parse(localStorage.getItem('alojamientos_edits') || '{}');
    const ec = Object.keys(edits).length;
    if (ec > 0) { editSpan.style.display = 'inline'; editSpan.textContent = '✏️ ' + ec + ' edits locales'; }
    else editSpan.style.display = 'none';
  } catch(e) { editSpan.style.display = 'none'; }
  document.getElementById('statusCount').textContent = n;
  document.getElementById('statusMsg').innerHTML = '✅ Cargado';
}

async function loadData() {
  try {
    const r = await fetch('data/alojamientos.json');
    DATA = await r.json();
    VV.loadEdits('alojamientos', DATA);
    updateStatus(); populateFilters(); applyFilters();
  } catch (e) {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-light);">⚠️ No se pudo cargar data/alojamientos.json.</td></tr>`;
    document.getElementById('statusMsg').textContent = '❌ No se pudo cargar data/alojamientos.json';
  }
}

function populateFilters() {
  const zonaSel = document.getElementById('filterZona');
  const zonas = new Set(DATA.alojamientos.map(a => a.ciudad));
  zonaSel.innerHTML = '<option value="all">Todas las zonas</option>' +
    [...zonas].sort((a, b) => {
      const ia = ZONE_ORDER.indexOf(a), ib = ZONE_ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1; if (ib >= 0) return 1;
      return a.localeCompare(b);
    }).map(z => `<option value="${z}">${z}</option>`).join('');
}

function applyFilters() {
  const zona = document.getElementById('filterZona').value;
  const fuente = document.getElementById('filterFuente').value;
  const maxPrice = parseInt(document.getElementById('priceMax').value);
  const minRating = parseFloat(document.getElementById('filterRating').value);

  filtered = DATA.alojamientos.filter(a => {
    if (zona !== 'all' && a.ciudad !== zona) return false;
    if (fuente !== 'all' && a.fuente !== fuente) return false;
    const p = getPrice(a);
    if (p == null || p > maxPrice) return false;
    if (a.puntuacion != null && a.puntuacion < minRating) return false;
    return true;
  });
  sortData(); updateUI();
}

function sortData() {
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'precio_total_eur': cmp = (getPrice(a) || Infinity) - (getPrice(b) || Infinity); break;
      case 'precio_total': cmp = (getTotal(a) || Infinity) - (getTotal(b) || Infinity); break;
      case 'puntuacion': cmp = (b.puntuacion || 0) - (a.puntuacion || 0); break;
      case 'puntuacion-desc': cmp = (a.puntuacion || 0) - (b.puntuacion || 0); break;
      case 'nombre': cmp = a.nombre.localeCompare(b.nombre); break;
      case 'fuente': cmp = a.fuente.localeCompare(b.fuente); break;
      case 'ciudad': cmp = a.ciudad.localeCompare(b.ciudad); break;
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
  sortData(); renderTable(); renderBarChart();
}

function updateStats() {
  if (filtered.length === 0) {
    ['statMinPrice','statAvgPrice','statMaxPrice','statCount','statZonas'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }
  const prices = filtered.map(a => getPrice(a)).filter(p => p != null);
  if (prices.length) {
    document.getElementById('statMinPrice').textContent = Math.min(...prices).toFixed(0) + ' €';
    document.getElementById('statMaxPrice').textContent = Math.max(...prices).toFixed(0) + ' €';
    document.getElementById('statAvgPrice').textContent = (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(0) + ' €';
  }
  const zonas = new Set(filtered.map(a => a.ciudad));
  document.getElementById('statCount').textContent = filtered.length;
  document.getElementById('statZonas').textContent = [...zonas].join(', ');
  document.getElementById('statsTotal').textContent = filtered.length + ' alojamientos';
  document.getElementById('barCount').textContent = '(' + filtered.length + ')';
  document.getElementById('cardCount').textContent = '(' + filtered.length + ')';
  document.getElementById('tableCount').textContent = '(' + filtered.length + ')';
}

function renderZoneGrid() {
  const container = document.getElementById('zoneGrid');
  const groups = {};
  filtered.forEach(a => {
    const zone = ZONE_GROUP[a.ciudad] || { group: a.ciudad, dot: 'san-antonio', label: a.ciudad };
    if (!groups[zone.group]) groups[zone.group] = { label: zone.label, dot: zone.dot, items: 0, minPrice: Infinity };
    groups[zone.group].items++;
    const p = getPrice(a);
    if (p != null && p < groups[zone.group].minPrice) groups[zone.group].minPrice = p;
  });
  container.innerHTML = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => {
      const price = g.minPrice < Infinity ? g.minPrice.toFixed(0) + '€' : '—';
      return `<div style="background:#f8f9fa;border-radius:8px;padding:10px;border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span class="map-dot ${g.dot}"></span>
          <strong style="font-size:13px;">${key}</strong>
        </div>
        <div style="font-size:11px;color:var(--text-light);">${g.items} alojamientos · Desde ${price}</div>
        <div style="font-size:10px;color:var(--text-light);">${g.label}</div>
      </div>`;
    }).join('');
  document.getElementById('zoneCount').textContent = '(' + filtered.length + ' aloj.)';
}

function renderBarChart() {
  const container = document.getElementById('barChart');
  const withPrice = filtered.filter(a => getPrice(a) != null);
  if (withPrice.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;font-size:13px;">Sin precios disponibles</div>';
    return;
  }
  const maxTotal = Math.max(...withPrice.map(a => getTotal(a)), 1);
  const sorted = [...withPrice].sort((a, b) => getTotal(a) - getTotal(b));
  container.innerHTML = '<div class="bar-chart-container">' +
    sorted.slice(0, 30).map(a => {
      const p = getPrice(a);
      const taxi = getTaxi(a);
      const total = p + taxi;
      const wPrecio = (p / maxTotal) * 100;
      return `<div class="bar-row">
        <div class="bar-label">${a.nombre.substring(0, 28)} <small>${a.ciudad}</small></div>
        <div class="bar-track">
          <div class="bar-fill baja" style="width:${wPrecio}%;">${p}€</div>
          ${taxi > 0 ? `<div class="bar-fill alta" style="width:${(taxi/maxTotal)*100}%;left:${wPrecio}%;">+${taxi}</div>` : ''}
        </div>
        <div class="bar-value">${total}€</div>
      </div>`;
    }).join('') + '</div>';
}

function renderCards() {
  const container = document.getElementById('cardList');
  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-light);font-size:13px;">No hay alojamientos que coincidan</div>';
    return;
  }
  const sorted = [...filtered].sort((a, b) => (getPrice(a) || Infinity) - (getPrice(b) || Infinity));
  container.innerHTML = sorted.map(a => {
    const p = getPrice(a);
    const taxi = getTaxi(a);
    const total = p != null ? p + taxi : null;
    const tipo = VV.guessAccomType(a.nombre);
    const sourceTag = a.fuente === 'booking' ? 'tag-booking' : 'tag-airbnb';
    const ratingStars = a.puntuacion ? '⭐'.repeat(Math.min(Math.round(a.puntuacion/2), 5)) : '';
    const services = (a.servicios || []).filter(Boolean);
    const priceHtml = p != null
      ? `<div class="price-big">${p.toFixed(0)} €</div><div class="price-small">${total === p ? '' : '+0€ taxi · Total ' + total.toFixed(0) + '€'}</div>`
      : `<div class="price-na">Sin precio</div>`;
    return `<div class="item-card" onclick="window.open('${a.url || '#'}', '_blank')" style="border-left-color:${a.fuente === 'booking' ? '#1565c0' : '#c62828'}">
      <div><span class="tag ${sourceTag}">${a.fuente}</span> <span class="tag tag-${tipo}">${tipo}</span></div>
      <div>
        <div class="accom-name" style="font-size:16px;font-weight:700;">${a.nombre} <small style="font-size:11px;font-weight:400;color:var(--text-light);">${a.ciudad}</small></div>
        <div class="accom-detail" style="font-size:12px;color:var(--text-light);">
          <span>${ratingStars} ${a.puntuacion || '?'}</span>
          ${services.length ? `<span>${services.slice(0, 3).join(' · ')}</span>` : ''}
        </div>
      </div>
      <div class="price">${priceHtml}</div>
    </div>`;
  }).join('');
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-light);">No hay alojamientos</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(a => {
    const p = getPrice(a);
    const total = getTotal(a);
    const pc = p != null && p <= 250 ? 'price-green' : p != null && p >= 500 ? 'price-warn' : '';
    const sourceTag = a.fuente === 'booking' ? 'tag-booking' : 'tag-airbnb';
    const services = (a.servicios || []).filter(Boolean);
    const ratingStars = a.puntuacion ? '⭐'.repeat(Math.min(Math.round(a.puntuacion/2), 5)) : '—';
    return `<tr>
      <td><strong>${a.nombre.substring(0, 40)}</strong></td>
      <td><span class="tag ${sourceTag}">${a.fuente}</span></td>
      <td>${a.ciudad}</td>
      <td>${ratingStars}</td>
      <td class="price-cell ${pc}">${p != null ? p.toFixed(0) + ' €' : '—'}</td>
      <td class="price-cell">${total != null ? total.toFixed(0) + ' €' : '—'}</td>
      <td style="font-size:10px;color:var(--text-light);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${services.slice(0, 3).join(', ')}</td>
      <td style="text-align:center;">
        ${p != null ? `<span class="edit-price" onclick="event.stopPropagation();editPrice('${a.id || a.nombre}')" title="Editar">✏️</span>` : '—'}
      </td>
      <td style="text-align:center;">
        ${(a.url && a.url.startsWith('http')) ? `<a href="${a.url}" target="_blank" style="text-decoration:none;font-size:16px;">🔗</a>` : '—'}
      </td>
    </tr>`;
  }).join('');
}

window.editPrice = function(id) {
  const a = DATA.alojamientos.find(x => x.id === id || x.nombre.startsWith(id.substring(0, 30)));
  if (!a) return;
  const current = a.precio_total_eur || 0;
  const cells = document.querySelectorAll('.price-cell');
  // Find the cell for this item
  const tr = document.querySelector(`tr:has(td:first-child strong)`);
  // Simple approach: prompt for value
  const val = prompt('Nuevo precio (EUR):', current);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      a.precio_total_eur = num;
      const edits = {};
      DATA.alojamientos.forEach(x => { if (x.id) edits[x.id] = x.precio_total_eur; });
      try { localStorage.setItem('alojamientos_edits', JSON.stringify(edits)); } catch(e) {}
      applyFilters();
    }
  }
};

function exportJSON() {
  const meta = DATA.metadata || {};
  meta.generado = new Date().toISOString().slice(0, 16).replace('T', ' ');
  meta.fuente = 'comparador-alojamientos.html (edicion manual)';
  DATA.metadata = meta;
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'alojamientos-actualizados.json';
  a.click();
}

function renderChart() {
  if (filtered.length === 0) return;
  const prices = filtered.map(a => getPrice(a)).filter(p => p != null);
  if (!prices.length) return;
  const min = Math.floor(Math.min(...prices) / 50) * 50;
  const max = Math.ceil(Math.max(...prices) / 50) * 50;
  const step = Math.max(25, Math.ceil((max - min) / 8));
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
      datasets: [{ label:'Alojamientos', data: Object.values(buckets), backgroundColor:'#00b4d8', borderRadius:4 }]
    },
    options: { responsive:true, maintainAspectRatio:true,
      scales: { y: { beginAtZero:true, ticks:{stepSize:1}, title:{display:true, text:'Nº alojamientos'} },
               x: { title:{display:true, text:'Precio total (€)'} } },
      plugins: { legend:{display:false} } }
  });
}

function updateUI() {
  updateStats(); renderTable(); renderBarChart(); renderCards(); renderZoneGrid(); renderChart();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  document.getElementById('filterZona').addEventListener('change', applyFilters);
  document.getElementById('filterFuente').addEventListener('change', applyFilters);
  document.getElementById('filterRating').addEventListener('change', applyFilters);
  document.getElementById('filterSort').addEventListener('change', function() {
    const v = this.value;
    sortField = v.replace('-desc', ''); sortAsc = !v.includes('-desc'); applyFilters();
  });
  document.getElementById('priceMax').addEventListener('input', function() {
    document.getElementById('priceMaxLabel').textContent = this.value + ' €'; applyFilters();
  });
  if (DATA) { populateFilters(); applyFilters(); }
  window.exportJSON = exportJSON;
  window.importJSON = importJSON;
  window.sortBy = sortBy;
});

})();
