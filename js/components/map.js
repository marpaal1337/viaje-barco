window.VV = window.VV || {};

VV.Map = {
  map: null,
  rainLayer: null,

  init: function(elementId, center, zoom) {
    this.map = L.map(elementId).setView(center, zoom);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: '© ESRI'
    });

    const naut = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: 'OpenSeaMap', opacity: 0.85
    }).addTo(this.map);

    const bathy = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, maxNativeZoom: 13, attribution: '© ESRI Ocean', opacity: 0.5
    }).addTo(this.map);

    L.control.layers(
      { '🗺️ Mapa callejero': osm, '🛰️ Satélite': sat },
      { '🧭 Carta náutica (OpenSeaMap)': naut, '⚪ Isobatas (ESRI Ocean)': bathy },
      { position: 'bottomleft' }
    ).addTo(this.map);

    this._loadRainLayer();
  },

  _loadRainLayer: function() {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        const frames = data.radar.past;
        if (frames.length) {
          const t = frames[frames.length - 1].time;
          this.rainLayer = L.tileLayer(
            `https://tilecache.rainviewer.com/v2/radar/${t}/256/{z}/{x}/{y}/1/1/1.png`,
            { opacity: 0.45, attribution: 'RainViewer' }
          ).addTo(this.map);
        }
      })
      .catch(() => {});
  },

  addMarkers: function(config) {
    // config: { pts: {}, icons: {}, markers: [], fondeos: [], amarres: [], peligros: [], rutas: [] }
    if (!this.map) return;

    const pts = config.pts || {};

    const fondeoIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🟢</span>', iconSize:[16,16], iconAnchor:[8,8]});
    const amarreIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🔵</span>', iconSize:[16,16], iconAnchor:[8,8]});
    const dangerIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🔴</span>', iconSize:[16,16], iconAnchor:[8,8]});
    const baseIcon  = L.divIcon({className:'', html:'<span style="font-size:18px;">⛵</span>', iconSize:[18,18], iconAnchor:[9,9]});
    const hotelIcon = L.divIcon({className:'', html:'<span style="font-size:16px;">🏨</span>', iconSize:[16,16], iconAnchor:[8,8]});
    const aptIcon   = L.divIcon({className:'', html:'<span style="font-size:14px;">🛫</span>', iconSize:[14,14], iconAnchor:[7,7]});

    if (config.apts) {
      config.apts.forEach(a => {
        if (pts[a]) L.marker(pts[a], {icon:aptIcon}).addTo(this.map).bindTooltip(a.toUpperCase());
      });
    }

    if (config.marina) {
      L.marker(config.marina, {icon:baseIcon}).addTo(this.map)
        .bindPopup(config.marinaPopup || '<b>⛵ Marina Ibiza</b>').openPopup();
    }

    if (config.hotelPos) {
      L.marker(config.hotelPos, {icon:hotelIcon}).addTo(this.map).bindTooltip('🏨 San Antonio');
    }

    if (config.fondeos) {
      config.fondeos.forEach(f => {
        L.circle(f.p, { radius:100, color:'#27ae60', fillColor:'#27ae60', fillOpacity:0.10, weight:2 }).addTo(this.map);
        L.marker(f.p, {icon:fondeoIcon}).addTo(this.map)
          .bindPopup(`<b>🟢 ${f.n}</b><br>📍 Fondeo gratuito<br>${f.d}<br><i>No fondear sobre Posidonia</i>`);
      });
    }

    if (config.amarres) {
      config.amarres.forEach(a => {
        L.circle(a.p, { radius:150, color:'#2196F3', fillColor:'#2196F3', fillOpacity:0.08, weight:2 }).addTo(this.map);
        L.marker(a.p, {icon:amarreIcon}).addTo(this.map)
          .bindPopup(`<b>🔵 ${a.n}</b><br>${a.d}<br><a href="${a.u}" target="_blank">🔗 Reservar</a>`);
      });
    }

    if (config.peligros) {
      config.peligros.forEach(p => {
        L.circle(p.c, { radius:p.r, color:'#e74c3c', fillColor:'#e74c3c', fillOpacity:0.08, weight:2 }).addTo(this.map);
        L.marker(p.c, {icon:dangerIcon}).addTo(this.map)
          .bindPopup(`<b>🔴 ${p.n}</b><br>${p.d}`);
      });
    }

    if (config.rutas) {
      config.rutas.forEach(r => {
        const polyline = L.polyline(r.points, { color: r.color, weight: 2, opacity: 0.6 }).addTo(this.map);
        if (r.label) polyline.bindTooltip(r.label);
      });
    }
  }
};
