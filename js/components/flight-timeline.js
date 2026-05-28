window.VV = window.VV || {};

VV.FlightTimeline = {
  _tooltipTarget: null,

  render: function(containerId, filtered, selected, toggleSelectFn) {
    const axis = document.querySelector(`#${containerId} .timeline-axis`);
    const track = document.querySelector(`#${containerId} .timeline-track`);
    if (!axis || !track) return;

    if (!filtered || filtered.length === 0) {
      axis.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;font-size:13px;">Sin vuelos para mostrar</div>';
      track.innerHTML = '';
      return;
    }

    const TOTAL_MIN = 24 * 60;
    const HOUR_WIDTH = 72;
    const PADDING = 0;
    const totalWidth = PADDING * 2 + (TOTAL_MIN / 60) * HOUR_WIDTH;

    axis.innerHTML = '';
    axis.style.width = totalWidth + 'px';
    for (let h = 0; h < 24; h++) {
      const isMajor = h % 2 === 0;
      const tick = document.createElement('div');
      tick.className = `tick${isMajor ? ' major' : ''}`;
      tick.style.left = ((h / 24) * totalWidth) + 'px';
      tick.textContent = isMajor ? String(h).padStart(2, '0') + ':00' : '';
      axis.appendChild(tick);
    }

    const groups = {};
    filtered.forEach(f => {
      const key = f.origen.codigo + '→' + f.destino.codigo;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });

    const groupKeys = Object.keys(groups).sort((a, b) => {
      const aIda = a.startsWith('IBZ') || a.startsWith('MAH') ? 1 : 0;
      const bIda = b.startsWith('IBZ') || b.startsWith('MAH') ? 1 : 0;
      if (aIda !== bIda) return aIda - bIda;
      return a.localeCompare(b);
    });

    track.innerHTML = '';
    track.style.width = totalWidth + 'px';

    let currentY = 0;

    groupKeys.forEach(routeKey => {
      const flights = groups[routeKey];

      const header = document.createElement('div');
      header.className = 'tl-group';
      header.innerHTML = `<div class="tl-group-header">
        ✈️ ${routeKey} <span style="font-weight:400;">· ${flights[0].origen.nombre} → ${flights[0].destino.nombre}</span>
        <span class="tl-route-count">${flights.length} vuelos</span>
      </div>`;
      header.style.position = 'relative';
      header.style.top = currentY + 'px';
      track.appendChild(header);
      currentY += 22;

      const body = document.createElement('div');
      body.className = 'tl-group-body';
      body.style.top = currentY + 'px';
      body.style.height = '38px';

      const grid = document.createElement('div');
      grid.className = 'tl-bg-grid';
      for (let h = 0; h < 24; h++) {
        const line = document.createElement('div');
        line.className = 'hour-line';
        line.style.left = ((h / 24) * totalWidth) + 'px';
        grid.appendChild(line);
      }
      body.appendChild(grid);

      flights.sort((a, b) => VV.timeToMins(a.salida) - VV.timeToMins(b.salida));

      flights.forEach((f, fi) => {
        const dep = VV.timeToMins(f.salida);
        const arr = VV.timeToMins(f.llegada);
        let duration = f.duracion_min || (arr - dep);
        if (arr < dep) duration = (24 * 60 - dep) + arr;
        if (duration < 5) duration = 30;

        const x = (dep / TOTAL_MIN) * totalWidth;
        const w = Math.max((duration / TOTAL_MIN) * totalWidth, 14);
        const barTop = 2 + (fi % 3) * 12;

        const bar = document.createElement('div');
        const sel = selected && selected.includes(f.id);
        bar.className = 'tl-flight' + (sel ? ' selected' : '');
        bar.style.left = x + 'px';
        bar.style.width = w + 'px';
        bar.style.top = barTop + 'px';
        bar.style.background = VV.AIRLINE_COLORS[f.aerolinea] || '#888';
        bar.dataset.id = f.id;

        const timeBadge = document.createElement('span');
        timeBadge.className = 'tl-time-badge';
        timeBadge.textContent = f.salida;
        bar.appendChild(timeBadge);

        const airLabel = document.createElement('span');
        airLabel.className = 'tl-airline-label';
        airLabel.textContent = f.aerolinea.substring(0, 4);
        bar.appendChild(airLabel);

        if (w > 60) {
          const durLabel = document.createElement('span');
          durLabel.className = 'tl-duration';
          durLabel.textContent = VV.minsToStr(duration);
          bar.appendChild(durLabel);
        }

        const priceBadge = document.createElement('span');
        priceBadge.className = 'tl-price-badge';
        priceBadge.textContent = f.precio_eur + '€';
        bar.appendChild(priceBadge);

        bar.onclick = function(e) {
          e.stopPropagation();
          if (typeof toggleSelectFn === 'function') toggleSelectFn(f.id);
        };

        bar.onmouseenter = function(e) { VV.FlightTimeline._showTooltip(e, f); };
        bar.onmouseleave = function() { VV.FlightTimeline._hideTooltip(); };
        bar.onmousemove = function(e) { VV.FlightTimeline._moveTooltip(e); };

        body.appendChild(bar);
      });

      track.appendChild(body);
      currentY += 42;
    });
  },

  _showTooltip: function(e, f) {
    const t = document.getElementById('tlTooltip');
    if (!t) return;
    const priceClass = f.precio_eur <= 50 ? 'color:#48c774' : f.precio_eur >= 100 ? 'color:#ff9f43' : '';
    t.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${VV.AIRLINE_COLORS[f.aerolinea] || '#888'};display:inline-block;"></span>
        <strong>${f.aerolinea} ${f.vuelo}</strong>
      </div>
      <div class="tt-row"><span>${f.origen.codigo} ${f.origen.nombre}</span><span>${f.salida}</span></div>
      <div class="tt-row"><span>${f.destino.codigo} ${f.destino.nombre}</span><span>${f.llegada}</span></div>
      <div class="tt-row" style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15);">
        <span>Duracion: ${VV.minsToStr(f.duracion_min)}</span>
        <span style="${priceClass};font-weight:800;font-size:14px;">${f.precio_eur.toFixed(0)} EUR</span>
      </div>
      ${f.escalas > 0 ? '<div style="font-size:10px;opacity:0.7;margin-top:2px;">' + f.escalas + ' escala(s)</div>' : '<div style="font-size:10px;color:#48c774;margin-top:2px;">Directo</div>'}
    `;
    t.style.display = 'block';
    this._moveTooltip(e);
  },

  _hideTooltip: function() {
    const t = document.getElementById('tlTooltip');
    if (t) t.style.display = 'none';
  },

  _moveTooltip: function(e) {
    const t = document.getElementById('tlTooltip');
    if (!t) return;
    const x = e.clientX + 14;
    const y = e.clientY - 10;
    t.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    t.style.top = Math.min(y, window.innerHeight - 160) + 'px';
  }
};
