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
  const bathy = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, maxNativeZoom: 13, attribution: '© ESRI Ocean', opacity: 0.5 }).addTo(map);

  L.control.layers(
    { '🗺️ Mapa callejero': osm, '🛰️ Satélite': sat },
    { '🧭 Carta náutica (OpenSeaMap)': naut, '⚪ Isobatas (ESRI Ocean)': bathy },
    { position: 'bottomleft' }
  ).addTo(map);

  fetch('https://api.rainviewer.com/public/weather-maps.json')
    .then(r => r.json())
    .then(data => {
      const frames = data.radar.past;
      if (frames.length) {
        const t = frames[frames.length - 1].time;
        L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${t}/256/{z}/{x}/{y}/1/1/1.png`, { opacity: 0.45, attribution: 'RainViewer' }).addTo(map);
      }
    }).catch(() => {});

  const pts = {
    ibz_apt: [38.8729, 1.3704], marina: [38.9080, 1.4570],
    vlc: [39.4892, -0.4817], mad: [40.4719, -3.5626], blq: [44.5354, 11.2887],
    comte: [38.9629, 1.2213], dhort: [38.8899, 1.2246], vedra: [38.8667, 1.1979],
    tago: [39.0367, 1.6430], beni: [39.0894, 1.4539], porroig: [38.8643, 1.3033],
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
    '<b>⛵ Marina Ibiza</b><br>Base del barco · Check-in/out<br>• Amarre ~30-40€/noche<br>• Dufour 43 de Toni<br><a href="https://marinaibiza.com/" target="_blank">🔗 Marina Ibiza</a>'
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
    L.marker(f.p, {icon:fondeoIcon}).addTo(map).bindPopup(`<b>🟢 ${f.n}</b><br>📍 Fondeo gratuito<br>${f.d}<br><i>No fondear sobre Posidonia</i>`);
  });

  const amarres = [
    { p: pts.marina, n: 'Marina Ibiza', d: '30-40€/noche · 14m eslora', u: 'https://marinaibiza.com/' },
    { p: [38.980,1.305], n: 'Port de San Antonio', d: '245 amarres · 5 tránsito', u: 'https://www.portsib.es/puerto/port-de-sant-antoni-de-portmany/' },
  ];
  amarres.forEach(a => {
    L.circle(a.p, { radius:150, color:'#2196F3', fillColor:'#2196F3', fillOpacity:0.08, weight:2 }).addTo(map);
    L.marker(a.p, {icon:amarreIcon}).addTo(map).bindPopup(`<b>🔵 ${a.n}</b><br>${a.d}<br><a href="${a.u}" target="_blank">🔗 Reservar</a>`);
  });

  const peligros = [
    { c:[38.922,1.230], r:280, n:'Bajo Caragoler', d:'Roca a 0.5m entre Comte y d\'Hort' },
    { c:[38.852,1.192], r:200, n:"L'Esponja", d:'Bajo 1m S de Es Vedrà · Rodear por W' },
    { c:[38.913,1.477], r:130, n:'Roca sa Gorra', d:'Roca 1m · Canal balizado · Port Este' },
    { c:[39.095,1.525], r:180, n:'Baix des Caló', d:'Roca 0.5m NE costa C. d\'en Serra' },
    { c:[38.835,1.390], r:400, n:'Es Freus', d:'Bajos + corrientes 2 nudos · Estrecho' },
  ];
  peligros.forEach(p => {
    L.circle(p.c, { radius:p.r, color:'#e74c3c', fillColor:'#e74c3c', fillOpacity:0.08, weight:2 }).addTo(map);
    L.marker(p.c, {icon:dangerIcon}).addTo(map).bindPopup(`<b>🔴 ${p.n}</b><br>${p.d}`);
  });

  const rutaD1 = [
    pts.marina, [38.922,1.400], [38.940,1.350], [38.955,1.300],
    [38.955,1.270], [38.9629,1.2213],
    [38.930,1.220], [38.910,1.225], [38.8899,1.2246],
    [38.920,1.250], [38.908,1.320], [38.9080,1.4570],
  ];
  const rutaD2 = [
    pts.marina, [38.920,1.480], [38.950,1.520], [38.980,1.570],
    [39.000,1.600], [39.020,1.620], [39.0367,1.6430],
    [39.040,1.600], [39.050,1.550], [39.060,1.500],
    [39.070,1.470], [39.080,1.460], [39.0894,1.4539],
    [39.070,1.430], [39.040,1.400], [39.000,1.380],
    [38.960,1.400], [38.940,1.420], [38.930,1.440], [38.9080,1.4570],
  ];
  const rutaD3 = [
    pts.marina, [38.900,1.430], [38.880,1.380], [38.870,1.350],
    [38.865,1.320], [38.8643,1.3033],
    [38.870,1.350], [38.880,1.380], [38.900,1.430], [38.9080,1.4570],
  ];

  L.polyline(rutaD1, { color:'#2196F3', weight:2, opacity:0.6 }).addTo(map).bindTooltip('Día 1 ~28.5 MN');
  L.polyline(rutaD2, { color:'#4CAF50', weight:2, opacity:0.6 }).addTo(map).bindTooltip('Día 2 ~37 MN');
  L.polyline(rutaD3, { color:'#FF9800', weight:2, opacity:0.6 }).addTo(map).bindTooltip('Día 3 ~16 MN');
}

function initChart() {
  const ctx = document.getElementById('chartCategorias');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['✈️ Vuelos', '⛵ Barco', '🏨 Alojamiento', '🚕 Taxis', '🍽️ Comidas'],
      datasets: [{
        data: [768, 1345, 311, 141, 375],
        backgroundColor: ['#1565c0', '#00b4d8', '#ff9f43', '#48c774', '#6a1b9a'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof L !== 'undefined') initMap();
  if (typeof Chart !== 'undefined') initChart();
  window.toggleDay = toggleDay;
});

})();
