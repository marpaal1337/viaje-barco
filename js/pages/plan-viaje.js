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
    ibz_apt: [38.8729, 1.3704], marina: [38.9083, 1.4567],
    vlc: [39.4892, -0.4817], mad: [40.4719, -3.5626], blq: [44.5354, 11.2887],
    comte: [38.9629, 1.2213], dhort: [38.8899, 1.2246], vedra: [38.8667, 1.1979],
    espalmador: [38.7417, 1.3833], illetes: [38.6917, 1.3750], saona: [38.6550, 1.2967],
    pou: [38.8317, 1.4317], ahorcados: [38.7567, 1.4500],
    porroig: [38.8833, 1.2667],
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
    '<b>⛵ Marina Ibiza</b><br>' +
    'Base del barco · Check-in/out<br>' +
    '• 0 amarres en ruta (2 noches fondeo)<br>' +
    '<a href="https://www.marinaibiza.com/" target="_blank">🔗 Marina Ibiza</a>'
  ).openPopup();
  L.marker([38.9758, 1.3076], {icon:hotelIcon}).addTo(map).bindTooltip('🏨 San Antonio');

  const fondeos = [
    { p: pts.espalmador, n: 'Espalmador / Illetes', d: 'Arena 3-6m · Laguna de barro · 38.74N 1.38E' },
    { p: pts.illetes,  n: 'Ses Illetes',           d: 'Arena 3-6m · Frente playa · 38.69N 1.38E' },
    { p: pts.saona,    n: 'Cala Saona',            d: 'Arena 4-8m · Refugio W · 38.66N 1.30E' },
    { p: pts.comte,    n: 'Cala Comte',            d: 'Arena 5-12m · Protegida W · 38.96N 1.22E' },
    { p: pts.dhort,    n: "Cala d'Hort",           d: 'Arena 4-10m · Vistas Es Vedrà · 38.89N 1.22E' },
    { p: pts.porroig,  n: 'Porroig',               d: 'Arena 4-8m · Refugio S · 38.88N 1.27E' },
  ];
  fondeos.forEach(f => {
    L.circle(f.p, { radius:100, color:'#27ae60', fillColor:'#27ae60', fillOpacity:0.10, weight:2 }).addTo(map);
    L.marker(f.p, {icon:fondeoIcon}).addTo(map).bindPopup(
      '<b>🟢 ' + f.n + '</b><br>📍 Fondeo gratuito<br>' + f.d + '<br><i>No fondear sobre Posidonia</i>'
    );
  });

  const boyaEco = [
    { p: [38.747,1.385], n: 'Boya ecológica S\'Espalmador', d: '~20€/noche · Reserva previa · Parque Ses Salines', u: 'https://www.marinaibiza.com/eco-puerto/fondeos/' },
  ];
  boyaEco.forEach(a => {
    L.circle(a.p, { radius:150, color:'#2196F3', fillColor:'#2196F3', fillOpacity:0.08, weight:2 }).addTo(map);
    L.marker(a.p, {icon:amarreIcon}).addTo(map).bindPopup(
      '<b>🔵 ' + a.n + '</b><br>' + a.d + '<br><a href="' + a.u + '" target="_blank">🔗 Reservar en Marina Ibiza</a>'
    );
  });

  const peligros = [
    { c:[38.922,1.230], r:280, n:'Bajo Caragoler', d:'Roca a 0.5m entre Comte y d\'Hort' },
    { c:[38.852,1.192], r:200, n:"L'Esponja", d:'Bajo 1m S de Es Vedrà · Rodear por W' },
    { c:[38.913,1.477], r:130, n:'Roca sa Gorra', d:'Roca 1m · Canal balizado · Port Este' },
    { c:[38.832,1.432], r:150, n:'Bajo d\'en Pou', d:'Barra Freu Grande 6-8.5m · Pasar al N de la baliza' },
    { c:[38.800,1.420], r:380, n:'Freu Mediano/Chico', d:'Máx 4m · NO usar · piedra La Barqueta' },
  ];
  peligros.forEach(p => {
    L.circle(p.c, { radius:p.r, color:'#e74c3c', fillColor:'#e74c3c', fillOpacity:0.15, weight:2 }).addTo(map);
    L.marker(p.c, {icon:dangerIcon}).addTo(map).bindPopup(
      '<b>🔴 ' + p.n + '</b><br>' + p.d
    );
  });

  const MB = pts.marina;
  const ES = pts.espalmador;
  const IL = pts.illetes;
  const PB = pts.pou;
  const CD = pts.dhort;
  const PR = pts.porroig;
  const CC = pts.comte;

  const d1 = [
    MB, [38.895,1.462], [38.875,1.458], [38.855,1.450], [38.840,1.440],
    [38.833,1.436], PB, [38.810,1.440], [38.785,1.445], [38.765,1.433],
    ES, IL
  ];

  const d2 = [
    IL, ES, [38.765,1.433], [38.785,1.445], [38.810,1.440],
    PB, [38.833,1.436], [38.845,1.430], [38.850,1.400],
    [38.855,1.360], [38.860,1.320], [38.865,1.280], [38.870,1.250],
    [38.880,1.235], CD, PR
  ];

  const d3 = [
    PR, [38.900,1.250], [38.925,1.235], [38.945,1.228],
    CC,
    [38.945,1.240], [38.925,1.290], [38.912,1.340], [38.905,1.390],
    [38.905,1.430], MB
  ];

  L.polyline(d1, { color:'#2196F3', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 1 · ~12 MN · Marina → Freu Grande → Espalmador/Illetes');
  L.polyline(d2, { color:'#4CAF50', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 2 · ~15 MN · Illetes → Freu Grande → d\'Hort → Porroig');
  L.polyline(d3, { color:'#FF9800', weight:3, opacity:0.7 }).addTo(map).bindTooltip('📅 Día 3 · ~17 MN · Porroig → Cala Comte → Marina');

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);line-height:1.6;';
    div.innerHTML =
      '<b>🧭 Leyenda</b><br>' +
      '🟢 Fondeo gratuito<br>' +
      '🔵 Boya ecológica (reserva)<br>' +
      '🔴 Peligro náutico<br>' +
      '📍 Activa «Carta náutica»<br>' +
      '   abajo izda. para boyas<br>' +
      '   profundidades y avisos';
    return div;
  };
  legend.addTo(map);
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof L !== 'undefined' && document.getElementById('map')) initMap();
  window.toggleDay = toggleDay;
});

})();
