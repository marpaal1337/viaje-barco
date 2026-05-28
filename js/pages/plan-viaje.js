(function() {

function toggleDay(el) {
  el.classList.toggle('open');
  const body = el.nextElementSibling;
  if (body) body.classList.toggle('open');
}

function initMap() {
  const map = L.map('map').setView([38.92, 1.38], 11);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: '© ESRI' });
  const naut = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, attribution: 'OpenSeaMap', opacity: 0.85 }).addTo(map);

  L.control.layers(
    { '🗺️ Mapa callejero': osm, '🛰️ Satélite': sat },
    { '🧭 Carta náutica (OpenSeaMap)': naut },
    { position: 'bottomleft' }
  ).addTo(map);

  const pts = {
    ibz_apt: [38.8729, 1.3704], marina: [38.9114, 1.4496],
    vlc: [39.4892, -0.4817], mad: [40.4719, -3.5626], blq: [44.5354, 11.2887],
    comte: [38.9629, 1.2213], dhort: [38.8899, 1.2246], vedra: [38.8667, 1.1979],
    tago: [39.0367, 1.6430], beni: [39.0894, 1.4539],
    porroig: [38.8643, 1.3033],
  };

  const fondeoIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🟢</span>', iconSize:[16,16], iconAnchor:[8,8]});
  const amarreIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🔵</span>', iconSize:[16,16], iconAnchor:[8,8]});
  const dangerIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🔴</span>', iconSize:[16,16], iconAnchor:[8,8]});
  const baseIcon  = L.divIcon({className:'', html:'<span style="font-size:18px;">⛵</span>', iconSize:[18,18], iconAnchor:[9,9]});
  const hotelIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🏨</span>', iconSize:[16,16], iconAnchor:[8,8]});
  const aptIcon   = L.divIcon({className:'', html:'<span style="font-size:14px;">🛫</span>', iconSize:[14,14], iconAnchor:[7,7]});

  L.marker(pts.vlc, {icon:aptIcon}).addTo(map).bindTooltip('VLC');
  L.marker(pts.mad, {icon:aptIcon}).addTo(map).bindTooltip('MAD');
  L.marker(pts.blq, {icon:aptIcon}).addTo(map).bindTooltip('BLQ');
  L.marker(pts.ibz_apt, {icon:aptIcon}).addTo(map).bindTooltip('IBZ');
  L.marker(pts.marina, {icon:baseIcon}).addTo(map).bindPopup(
    '<b>⛵ Marina Botafoc</b><br>' +
    'Base del barco · Check-in/out<br>' +
    '• Amarre ~30-40€/noche<br>' +
    '• Agua y luz incluidos<br>' +
    '<a href="https://www.portsib.es/" target="_blank">🔗 Ports IB</a> · ' +
    '<a href="https://reservas.portsib.es/" target="_blank">🔗 Reservar amarre</a>'
  ).openPopup();
  L.marker([38.9758, 1.3076], {icon:hotelIcon}).addTo(map).bindTooltip('🏨 San Antonio');

  const fondeos = [
    { p: pts.comte,  n: 'Cala Comte',         d: 'Arena 5-12m · Protegida W · 38.96N 1.22E' },
    { p: pts.dhort,  n: "Cala d'Hort",        d: 'Arena 4-10m · Vistas Es Vedrà · 38.89N 1.22E' },
    { p: [39.035,1.637], n: 'Tagomago',       d: 'Arena+roca 8-15m · Lado S · 39.04N 1.64E' },
    { p: pts.beni,   n: 'Cala Benirràs',      d: 'Arena 5-10m · Tambores atardecer · 39.09N 1.45E' },
    { p: pts.porroig, n: 'Porroig',           d: 'Arena 4-8m · Refugio S · 38.86N 1.30E' },
  ];
  fondeos.forEach(f => {
    L.circle(f.p, { radius:100, color:'#27ae60', fillColor:'#27ae60', fillOpacity:0.10, weight:2 }).addTo(map);
    L.marker(f.p, {icon:fondeoIcon}).addTo(map).bindPopup(
      '<b>🟢 ' + f.n + '</b><br>📍 Fondeo gratuito<br>' + f.d + '<br><i>No fondear sobre Posidonia</i>'
    );
  });

  const amarres = [
    { p: pts.marina, n: 'Marina Botafoc', d: '30-40€/noche · 10m eslora', u: 'https://reservas.portsib.es/' },
    { p: [38.980,1.305], n: 'Port de San Antonio', d: '245 amarres · 5 tránsito', u: 'https://www.portsib.es/puerto/port-de-sant-antoni-de-portmany/' },
  ];
  amarres.forEach(a => {
    L.circle(a.p, { radius:150, color:'#2196F3', fillColor:'#2196F3', fillOpacity:0.08, weight:2 }).addTo(map);
    L.marker(a.p, {icon:amarreIcon}).addTo(map).bindPopup(
      '<b>🔵 ' + a.n + '</b><br>' + a.d + '<br><a href="' + a.u + '" target="_blank">🔗 Reservar en PortsIB</a>'
    );
  });

  const peligros = [
    { c:[38.922,1.230], r:280, n:'Bajo Caragoler', d:'Roca a 0.5m entre Comte y d\'Hort' },
    { c:[38.852,1.192], r:200, n:"L'Esponja", d:'Bajo 1m S de Es Vedrà · Rodear por W' },
    { c:[38.913,1.477], r:130, n:'Roca sa Gorra', d:'Roca 1m · Canal balizado · Port Este' },
    { c:[39.095,1.525], r:180, n:'Baix des Caló', d:'Roca 0.5m NE costa C. d\'en Serra' },
    { c:[38.835,1.390], r:400, n:'Es Freus', d:'Bajos + corrientes 2 nudos · Estrecho' },
  ];
  peligros.forEach(p => {
    L.circle(p.c, { radius:p.r, color:'#e74c3c', fillColor:'#e74c3c', fillOpacity:0.15, weight:2 }).addTo(map);
    L.marker(p.c, {icon:dangerIcon}).addTo(map).bindPopup(
      '<b>🔴 ' + p.n + '</b><br>' + p.d
    );
  });

  const MB = pts.marina;
  const CC = pts.comte;
  const CD = pts.dhort;
  const TA = pts.tago;
  const BE = pts.beni;
  const PO = pts.porroig;

  const d1 = [
    MB, [38.892,1.478], [38.865,1.462], [38.842,1.440], [38.830,1.400],
    [38.823,1.350], [38.828,1.305], [38.835,1.265], [38.850,1.235],
    [38.880,1.218], [38.912,1.205], [38.940,1.198],
    CC,
    [38.918,1.206], [38.898,1.215],
    CD,
    [38.868,1.242], [38.855,1.270], [38.843,1.305],
    [38.838,1.350], [38.842,1.395], [38.855,1.430],
    [38.872,1.458], [38.890,1.472], MB
  ];

  const d2 = [
    MB, [38.922,1.478], [38.948,1.498], [38.975,1.535],
    [39.000,1.580], [39.018,1.620], [39.030,1.640],
    TA,
    [39.060,1.600], [39.078,1.545], [39.092,1.495],
    [39.120,1.460], [39.132,1.400], [39.138,1.325],
    [39.135,1.260], [39.122,1.210], [39.095,1.172],
    [39.050,1.148], [38.995,1.135], [38.940,1.132],
    [38.882,1.140], [38.830,1.160], [38.805,1.215],
    [38.798,1.290], [38.798,1.355], [38.808,1.410],
    [38.825,1.445], [38.850,1.468], [38.878,1.478],
    MB
  ];

  const d3 = [
    MB, [38.892,1.478], [38.865,1.462], [38.842,1.440], [38.830,1.400],
    [38.823,1.350], [38.828,1.308], [38.838,1.280],
    [38.850,1.258],
    PO,
    [38.850,1.258], [38.838,1.280], [38.828,1.308],
    [38.823,1.350], [38.842,1.395], [38.855,1.430],
    [38.872,1.458], [38.890,1.472], MB
  ];

  L.polyline(d1, { color:'#2196F3', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 1 · ~28 MN · Botafoc → Comte → d\'Hort → Botafoc');
  L.polyline(d2, { color:'#4CAF50', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 2 · ~37 MN · Botafoc → Tagomago → Benirràs → Botafoc');
  L.polyline(d3, { color:'#FF9800', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 3 · ~16 MN · Botafoc → Porroig → Botafoc');

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);line-height:1.6;';
    div.innerHTML =
      '<b>🧭 Leyenda</b><br>' +
      '🟢 Fondeo gratuito<br>' +
      '🔵 Amarre de pago<br>' +
      '🔴 Peligro náutico<br>' +
      '📍 Activa «Carta náutica»<br>' +
      '   abajo izda. para boyas<br>' +
      '   profundidades y avisos';
    return div;
  };
  legend.addTo(map);
}

function initChart() {
  const ctx = document.getElementById('chartCategorias');
  if (!ctx) return;
  const CATS = {
    labels: ['✈️ Vuelos', '⛵ Barco', '🏨 Alojamiento', '🚕 Taxis', '🍽️ Comidas'],
    totals: [768, 1245, 311, 141, 375],
    perPers: [154, 249, 62, 28, 75],
    colors: ['#74b9ff','#48c774','#ffeaa7','#ff9f43','#ee5a24'],
  };
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CATS.labels,
      datasets: [
        { label: 'Total grupo (€)', data: CATS.totals, backgroundColor: CATS.colors, borderRadius: 4, yAxisID: 'y' },
        { label: '~/persona (€)', data: CATS.perPers, backgroundColor: CATS.colors.map(c => c + '99'), borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Total grupo (€)' } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: '~/pers (€)' }, grid: { drawOnChartArea: false } }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            afterLabel: ctx => {
              const i = ctx.dataIndex;
              return `Total grupo: ${CATS.totals[i]}€ · ~${CATS.perPers[i]}€/pers`;
            }
          }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof L !== 'undefined' && document.getElementById('map')) initMap();
  if (typeof Chart !== 'undefined' && document.getElementById('chartCategorias')) initChart();
  window.toggleDay = toggleDay;
});

})();
