window.VV = window.VV || {};

VV.editPrice = function(td, tab, DATA, currentValue, refreshCallback) {
  const current = currentValue || 0;
  td.innerHTML = `<input type="number" class="price-input" value="${current}" step="1" min="0">`;
  const inp = td.querySelector('input');
  inp.focus();
  const done = function() {
    const val = parseFloat(inp.value);
    if (!isNaN(val) && val >= 0) {
      if (typeof refreshCallback === 'function') refreshCallback(val);
    }
  };
  inp.addEventListener('blur', done);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') done();
    if (e.key === 'Escape') location.reload();
  });
};

VV.renderChart = function(canvasId, chartInstance, labels, data, label, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label || 'Datos',
        data: data,
        backgroundColor: color || '#00b4d8',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Nº' } },
        x: { title: { display: true, text: 'Precio (€)' } }
      },
      plugins: { legend: { display: false } }
    }
  });
};

VV.buildPriceBuckets = function(prices, baseStep) {
  if (!prices.length) return {};
  const min = Math.floor(Math.min(...prices) / baseStep) * baseStep;
  const max = Math.ceil(Math.max(...prices) / baseStep) * baseStep;
  const step = Math.max(baseStep, Math.ceil((max - min) / 8));
  const buckets = {};
  for (let b = min; b <= max; b += step) buckets[`${b}-${b+step}`] = 0;
  prices.forEach(p => {
    const bucket = Math.floor((p - min) / step) * step + min;
    const key = `${bucket}-${bucket+step}`;
    if (buckets[key] !== undefined) buckets[key]++;
  });
  return buckets;
};

VV.createChartFromPrices = function(canvasId, chartRef, prices, label, color, xLabel) {
  const buckets = VV.buildPriceBuckets(prices, 50);
  const keys = Object.keys(buckets);
  if (!keys.length) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartRef && typeof chartRef.destroy === 'function') chartRef.destroy();
  const labels = keys.map(k => `${k.split('-')[0]}€`);
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label || 'Datos',
        data: Object.values(buckets),
        backgroundColor: color || '#00b4d8',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Nº' } },
        x: { title: { display: true, text: xLabel || 'Precio (€)' } }
      },
      plugins: { legend: { display: false } }
    }
  });
};

VV.renderBarChart = function(containerId, items, getValue, getValueAlt, getLabel, getSublabel, maxValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;">Sin datos</div>';
    return;
  }
  const maxP = maxValue || Math.max(...items.map(getValue), 1);
  const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));
  container.innerHTML = '<div class="bar-chart-container">' + sorted.map(item => {
    const w = (getValue(item) / maxP) * 100;
    const wAlt = getValueAlt ? (getValueAlt(item) / maxP) * 100 : 0;
    const label = getLabel(item);
    const sublabel = getSublabel ? getSublabel(item) : '';
    const val = getValue(item);
    const valAlt = getValueAlt ? getValueAlt(item) : null;
    return `<div class="bar-row">
      <div class="bar-label">${label}${sublabel ? ` <small>${sublabel}</small>` : ''}</div>
      <div class="bar-track">
        ${valAlt ? `<div class="bar-fill orange" style="width:${wAlt}%">${valAlt}€</div>` : ''}
        <div class="bar-fill blue" style="width:${w}%">${val}€</div>
      </div>
      <div class="bar-value">${val}€</div>
    </div>`;
  }).join('') + '</div>';
};
