window.VV = window.VV || {};

VV.loadEdits = function(key, DATA) {
  const STORAGE_KEYS = {
    barcos: 'barcos_edits',
    vuelos: 'vuelos_edits',
    alojamientos: 'alojamientos_edits',
  };
  const FIELD_MAP = {
    barcos: 'precio_dia_baja',
    vuelos: 'precio_eur',
    alojamientos: 'precio_total_eur',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[key]);
    if (!raw) return;
    const edits = JSON.parse(raw);
    const arr = DATA.barcos || DATA.alternativas || DATA.alojamientos || [];
    const field = FIELD_MAP[key];
    arr.forEach(item => {
      if (item.id && edits[item.id] !== undefined) {
        item[field] = edits[item.id];
      }
    });
  } catch(e) {}
};

VV.saveEdits = function(key, DATA) {
  const STORAGE_KEYS = {
    barcos: 'barcos_edits',
    vuelos: 'vuelos_edits',
    alojamientos: 'alojamientos_edits',
  };
  const FIELD_MAP = {
    barcos: 'precio_dia_baja',
    vuelos: 'precio_eur',
    alojamientos: 'precio_total_eur',
  };
  const edits = {};
  const arr = DATA.barcos || DATA.alternativas || DATA.alojamientos || [];
  const field = FIELD_MAP[key];
  arr.forEach(item => {
    if (item.id) edits[item.id] = item[field];
  });
  try { localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(edits)); } catch(e) {}
};

VV.updateWF = function(tab, DATA, panel) {
  const STORAGE_KEYS = {
    barcos: 'barcos_edits',
    vuelos: 'vuelos_edits',
    alojamientos: 'alojamientos_edits',
  };
  if (!panel || !DATA) return;
  const msg = panel.querySelector('.wf-msg');
  const count = panel.querySelector('.wf-count');
  const editsEl = panel.querySelector('.wf-edits');
  if (msg) msg.textContent = '✅ Cargado';
  if (count) count.textContent = (DATA.barcos || DATA.alternativas || DATA.alojamientos || []).length;
  if (editsEl) {
    try {
      const edits = JSON.parse(localStorage.getItem(STORAGE_KEYS[tab]) || '{}');
      const ec = Object.keys(edits).length;
      if (ec > 0) { editsEl.style.display = 'inline'; editsEl.textContent = `✏️ ${ec} edits`; }
      else editsEl.style.display = 'none';
    } catch(e) { editsEl.style.display = 'none'; }
  }
};

VV.exportJSON = function(DATA, filename) {
  DATA.metadata = DATA.metadata || {};
  DATA.metadata.generado = new Date().toISOString().slice(0, 16).replace('T', ' ');
  DATA.metadata.fuente = 'comparador (edicion manual)';
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

VV.importJSON = function(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      callback(imported);
    } catch(err) {
      alert('Error al importar JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
};
