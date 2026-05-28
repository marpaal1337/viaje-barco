window.VV = window.VV || {};

VV.MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

VV.AIRLINE_COLORS = {
  'Ryanair': '#1565c0',
  'Iberia Express': '#e65100',
  'Iberia': '#6a1b9a',
  'Vueling': '#00838f',
};

VV.fmtDate = function(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${parseInt(day)} ${VV.MONTHS[parseInt(m)-1]}`;
};

VV.timeToMins = function(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

VV.minsToStr = function(m) {
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return h > 0 ? `${h}h ${mi}m` : `${mi}m`;
};

VV.fmtPrice = function(v) {
  if (v == null || isNaN(v) || v <= 1) return null;
  return v;
};

VV.guessAccomType = function(n) {
  const l = (n || '').toLowerCase();
  if (l.includes('apartamento') || l.includes('apartament')) return 'apartamento';
  if (l.includes('hostal') || l.includes('hostel')) return 'hostal';
  if (l.includes('guest')) return 'guesthouse';
  if (l.includes('suites') || l.includes('suite')) return 'hotel';
  return 'hotel';
};

VV.getBaja = function(b) {
  return b.precio_dia_baja != null ? b.precio_dia_baja : (b.precio_dia || 0);
};

VV.getAlta = function(b) {
  return b.precio_dia_alta != null ? b.precio_dia_alta : (b.precio_dia_media || b.precio_dia || 0);
};
