window.VV = window.VV || {};

const STORAGE_KEYS = { barcos: 'barcos_edits', vuelos: 'vuelos_edits', alojamientos: 'alojamientos_edits' };
const FIELD_MAP = { barcos: 'precio_dia_baja', vuelos: 'precio_eur', alojamientos: 'precio_total_eur' };

VV.loadEdits = function(key, DATA) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[key]);
    if (!raw) return;
    const edits = JSON.parse(raw);
    const arr = DATA.barcos || DATA.alternativas || DATA.alojamientos || [];
    const field = FIELD_MAP[key];
    arr.forEach(item => {
      if (item.id && edits[item.id] !== undefined) item[field] = edits[item.id];
    });
  } catch(e) {}
};

VV.saveEdits = function(key, DATA) {
  const edits = {};
  const arr = DATA.barcos || DATA.alternativas || DATA.alojamientos || [];
  const field = FIELD_MAP[key];
  arr.forEach(item => { if (item.id) edits[item.id] = item[field]; });
  try { localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(edits)); } catch(e) {}
};
