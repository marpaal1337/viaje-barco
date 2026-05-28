(function() {
'use strict';

let DATA = null;
let filtered = [];
let sortField = 'precio_dia_baja';
let sortAsc = true;
let priceChart = null;
let sortHistory = [];

const TYPE_COLORS = { 'Velero': '#00b4d8', 'Catamarán': '#6a1b9a', 'Yate a motor': '#ff9f43' };

function getPrecioBaja(b) { return b.precio_dia_baja != null ? b.precio_dia_baja : (b.precio_dia || 0); }
function getPrecioAlta(b) { return b.precio_dia_alta != null ? b.precio_dia_alta : (b.precio_dia_media || b.precio_dia || 0); }

function formatIsla(isla) {
  const map = { 'Ibiza':'Ibiza', 'Menorca':'Menorca', 'Mallorca':'Mallorca', 'Formentera':'Formentera' };
  return map[isla] || isla;
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.barcos) {
        DATA = imported;
        VV.loadEdits('barcos', DATA);
        populateFilters();
        applyFilters();
        updateStatus();
        document.getElementById('statusMsg').innerHTML = '✅ Datos importados de <code>' + file.name + '</code>';
      }
    } catch(err) { alert('Error al importar JSON: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function updateStatus() {
  if (!DATA) return;
  const meta = DATA.metadata || {};
  document.getElementById('statsFuente').textContent = meta.fuente || 'desconocida';
  const n = DATA.barcos.length;
  const editSpan = document.getElementById('statusEdits');
  try {
    const edits = JSON.parse(localStorage.getItem('barcos_edits') || '{}');
    const ec = Object.keys(edits).length;
    if (ec > 0) { editSpan.style.display = 'inline'; editSpan.textContent = '✏️ ' + ec + ' edits locales'; }
    else editSpan.style.display = 'none';
  } catch(e) { editSpan.style.display = 'none'; }
  document.getElementById('statusCount').textContent = n;
  document.getElementById('statusMsg').innerHTML = '✅ Cargado';
}

async function loadData() {
  try {
    const r = await fetch('data/barcos.json');
    DATA = await r.json();
    VV.loadEdits('barcos', DATA);
    updateStatus();
    populateFilters();
    applyFilters();
  } catch (e) {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-light);">⚠️ No se pudo cargar data/barcos.json.</td></tr>`;
    document.getElementById('statusMsg').textContent = '❌ No se pudo cargar data/barcos.json';
  }
}

function populateFilters() {
  const islaSel = document.getElementById('filterIsla');
  const islas = new Set(DATA.barcos.map(b => b.isla));
  islaSel.innerHTML = '<option value="all">Todas las islas</option>' + [...islas].sort().map(i => `<option value="${i}">${i}</option>`).join('');
}

function applyFilters() {
  const isla = document.getElementById('filterIsla').value;
  const tipo = document.getElementById('filterTipo').value;
  const minPlazas = parseInt(document.getElementById('filterPlazas').value);
  const minEslora = parseFloat(document.getElementById('filterEslora').value);
  const maxPrice = parseInt(document.getElementById('priceMax').value);
  const patron = document.getElementById('filterPatron').value;

  filtered = DATA.barcos.filter(b => {
    if (isla !== 'all' && b.isla !== isla) return false;
    if (tipo !== 'all' && b.tipo !== tipo) return false;
    if (b.plazas < minPlazas) return false;
    if (b.eslora_m < minEslora) return false;
    if (getPrecioBaja(b) > maxPrice) return false;
    if (patron !== 'all' && String(b.con_patron) !== patron) return false;
    return true;
  });
  sortData();
  updateUI();
}

function sortData() {
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'precio_dia_baja': cmp = getPrecioBaja(a) - getPrecioBaja(b); break;
      case 'precio_dia_alta': cmp = getPrecioAlta(a) - getPrecioAlta(b); break;
      case 'eslora_m': cmp = a.eslora_m - b.eslora_m; break;
      case 'plazas': cmp = a.plazas - b.plazas; break;
      case 'camarotes': cmp = (a.camarotes||0) - (b.camarotes||0); break;
      case 'rating': cmp = (b.rating||0) - (a.rating||0); break;
      case 'modelo': cmp = a.modelo.localeCompare(b.modelo); break;
      case 'tipo': cmp = a.tipo.localeCompare(b.tipo); break;
      case 'isla': cmp = a.isla.localeCompare(b.isla); break;
      case 'puerto_base': cmp = (a.puerto_base||'').localeCompare(b.puerto_base||''); break;
    }
    return sortAsc ? cmp : -cmp;
  });
}

function sortBy(field) {
  if (sortHistory.length && sortHistory[sortHistory.length-1] === field) {
    sortAsc = !sortAsc;
  } else {
    sortField = field;
    sortAsc = true;
    sortHistory.push(field);
    if (sortHistory.length > 3) sortHistory.shift();
  }
  sortData();
  renderTable();
  renderBarChart();
}

function updateStats() {
  if (filtered.length === 0) {
    ['statMinPrice','statAvgPrice','statMaxPrice','statCount','statIslas'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }
  const prices = filtered.map(b => b.precio_dia_baja);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const islas = new Set(filtered.map(b => b.isla));

  document.getElementById('statMinPrice').textContent = min.toFixed(0) + ' €';
  document.getElementById('statMaxPrice').textContent = max.toFixed(0) + ' €';
  document.getElementById('statAvgPrice').textContent = avg.toFixed(0) + ' €';
  document.getElementById('statCount').textContent = filtered.length;
  document.getElementById('statIslas').textContent = [...islas].join(', ');
  document.getElementById('statsTotal').textContent = filtered.length + ' barcos';
  document.getElementById('barCount').textContent = '(' + filtered.length + ' barcos)';
  document.getElementById('tableCount').textContent = '(' + filtered.length + ' barcos)';
}

function renderBarChart() {
  const container = document.getElementById('barChart');
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;font-size:13px;">Sin barcos para mostrar</div>';
    return;
  }
  const maxPrice = Math.max(...filtered.map(b => b.precio_dia_alta), 1);
  const sorted = [...filtered].sort((a, b) => a.precio_dia_baja - b.precio_dia_baja);
  container.innerHTML = '<div class="bar-chart-container">' +
    sorted.map(b => {
      const wBaja = (b.precio_dia_baja / maxPrice) * 100;
      const wAlta = (b.precio_dia_alta / maxPrice) * 100;
      return `<div class="bar-row">
        <div class="bar-label">${b.modelo} <small>${b.isla} · ${b.plazas} pax</small></div>
        <div class="bar-track">
          <div class="bar-fill alta" style="width:${wAlta}%;">${b.precio_dia_alta}€</div>
          <div class="bar-fill baja" style="width:${wBaja}%;">${b.precio_dia_baja}€</div>
        </div>
        <div class="bar-value">${b.precio_dia_baja}€</div>
      </div>`;
    }).join('') + '</div>';
  document.getElementById('scenarioCount').textContent = '(' + filtered.length + ' escenarios)';
}

function renderScenarios() {
  const container = document.getElementById('scenarioList');
  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-light);font-size:13px;">Selecciona barcos para ver escenarios</div>';
    return;
  }
  const EXTRAS_DEFAULT = 50, DIAS = 3, PERSONAS = 6;
  const scenarios = filtered.map(b => {
    const extras = parseFloat(String(b.extras_dia || '0').match(/([\d.]+)/)?.[1] || EXTRAS_DEFAULT);
    const costeBarco = (b.precio_dia_baja + extras) * DIAS;
    const porPersona = Math.round(costeBarco / PERSONAS);
    return { ...b, costeBarco, porPersona, extras };
  }).sort((a, b) => a.porPersona - b.porPersona);

  container.innerHTML = scenarios.map((s, rank) => {
    const rc = rank === 0 ? 'top1' : rank === 1 ? 'top2' : rank === 2 ? 'top3' : '';
    const tc = s.tipo === 'Catamarán' ? 'tag-catamaran' : s.tipo === 'Yate a motor' ? 'tag-yate' : 'tag-velero';
    return `<div class="scenario-card">
      <div class="scenario-rank ${rc}">#${rank + 1}</div>
      <div class="scenario-detail">
        <strong>${s.modelo}</strong> <span class="tag ${tc}">${s.tipo}</span>
        <span style="color:var(--text-light);">·</span> ${s.isla} · ${s.puerto_base || '?'}
        <br><span style="color:var(--text-light);font-size:11px;">
          ${s.eslora_m}m · ${s.plazas} plazas · ${s.camarotes || '?'} camarotes
          <span style="margin-left:8px;">💰 ${s.precio_dia_baja}€/día + ${s.extras}€ extras</span></span>
      </div>
      <div class="scenario-price ${rc}">${s.porPersona}€ <small style="font-size:11px;font-weight:400;color:var(--text-light);display:block;">/pers</small></div>
    </div>`;
  }).join('');
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text-light);">No hay barcos que coincidan con los filtros</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(b => {
    const pc = b.precio_dia_baja <= 350 ? 'price-green' : b.precio_dia_baja >= 500 ? 'price-warn' : '';
    const tc = b.tipo === 'Catamarán' ? 'tag-catamaran' : b.tipo === 'Yate a motor' ? 'tag-yate' : 'tag-velero';
    return `<tr>
      <td><strong>${b.modelo}</strong></td>
      <td><span class="tag ${tc}">${b.tipo}</span></td>
      <td>${formatIsla(b.isla)}</td>
      <td>${b.puerto_base || '—'}</td>
      <td>${b.eslora_m}m</td>
      <td>${b.plazas}</td>
      <td>${b.camarotes || '—'}</td>
      <td class="price-cell price-warn">${b.precio_dia_alta} <small>€</small></td>
      <td class="price-cell ${pc}" id="price-${b.id}">
        ${b.precio_dia_baja} <small>€</small>
        <span class="edit-price" onclick="event.stopPropagation();editPrice('${b.id}')" title="Editar precio">✏️</span>
      </td>
      <td>${b.rating ? '⭐ '.repeat(Math.round(b.rating)) : '—'}</td>
      <td style="text-align:center;">${b.url ? `<a href="${b.url}" target="_blank" style="text-decoration:none;font-size:16px;">🔗</a>` : '—'}</td>
    </tr>`;
  }).join('');
}

function renderChart() {
  if (filtered.length === 0) return;
  const prices = filtered.map(b => b.precio_dia_baja);
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
      datasets: [{ label:'Barcos', data: Object.values(buckets), backgroundColor:'#00b4d8', borderRadius:4 }]
    },
    options: { responsive:true, maintainAspectRatio:true,
      scales: { y: { beginAtZero:true, ticks:{stepSize:1}, title:{display:true, text:'Nº barcos'} },
               x: { title:{display:true, text:'€/día (temp. baja)'} } },
      plugins: { legend:{display:false} } }
  });
}

// ── Edit price ──
window.editPrice = function(id) {
  const b = DATA.barcos.find(x => x.id === id);
  if (!b) return;
  const current = b.precio_dia_baja;
  const cell = document.getElementById(`price-${id}`);
  cell.innerHTML = `<input type="number" class="price-input" value="${current}" step="1" min="0" id="input-${id}" onblur="savePrice('${id}')" onkeydown="if(event.key==='Enter')savePrice('${id}');if(event.key==='Escape')cancelEdit('${id}','${current}')">`;
  document.getElementById(`input-${id}`).focus();
};

window.savePrice = function(id) {
  const input = document.getElementById(`input-${id}`);
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) return;
  const b = DATA.barcos.find(x => x.id === id);
  if (!b) return;
  b.precio_dia_baja = val;
  const edits = {};
  DATA.barcos.forEach(x => edits[x.id] = x.precio_dia_baja);
  try { localStorage.setItem('barcos_edits', JSON.stringify(edits)); } catch(e) {}
  applyFilters();
};

window.cancelEdit = function(id, original) {
  const b = DATA.barcos.find(x => x.id === id);
  if (b) b.precio_dia_baja = parseFloat(original);
  applyFilters();
};

function exportJSON() {
  const meta = DATA.metadata || {};
  meta.generado = new Date().toISOString().slice(0, 16).replace('T', ' ');
  meta.fuente = 'comparador-barcos.html (edicion manual)';
  DATA.metadata = meta;
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'barcos-actualizados.json';
  a.click();
}

function updateUI() {
  updateStats();
  renderTable();
  renderBarChart();
  renderScenarios();
  renderChart();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  document.getElementById('filterIsla').addEventListener('change', applyFilters);
  document.getElementById('filterTipo').addEventListener('change', applyFilters);
  document.getElementById('filterPlazas').addEventListener('change', applyFilters);
  document.getElementById('filterEslora').addEventListener('change', applyFilters);
  document.getElementById('filterSort').addEventListener('change', function() {
    const v = this.value;
    sortField = v.replace('-desc', '');
    sortAsc = !v.includes('-desc');
    applyFilters();
  });
  document.getElementById('priceMax').addEventListener('input', function() {
    document.getElementById('priceMaxLabel').textContent = this.value + ' €';
    applyFilters();
  });

  if (DATA) { populateFilters(); applyFilters(); }

  window.exportJSON = exportJSON;
  window.importJSON = importJSON;
  window.sortBy = sortBy;
});

})();
