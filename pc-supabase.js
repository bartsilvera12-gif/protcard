/* PROT CARD — public-site Supabase loader.
   Fetches productos, marcas, modelos and settings, then pushes them into
   window.PC_DATA and forces the DC Component to re-render. If Supabase is
   unavailable or the config is empty the site keeps the hardcoded fallback. */
(function () {
  'use strict';

  const cfg = window.PC_SUPABASE || {};
  if (!cfg.url || !cfg.key) {
    // No config — leave the hardcoded data in place.
    return;
  }

  function ensureSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve(window.supabase);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.async = true;
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new Error('supabase-js failed to load'));
      document.head.appendChild(s);
    });
  }

  async function loadAll() {
    const sb = window.supabase.createClient(cfg.url, cfg.key);
    const [prod, marcas, modelos, settings] = await Promise.all([
      sb.schema('protcard').from('productos').select('*').order('orden', { ascending: true }).order('created_at', { ascending: true }),
      sb.schema('protcard').from('marcas').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
      sb.schema('protcard').from('modelos').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
      sb.schema('protcard').from('settings').select('*'),
    ]);
    if (prod.error) throw prod.error;
    if (marcas.error) throw marcas.error;
    if (modelos.error) throw modelos.error;
    if (settings.error) throw settings.error;

    // Build CAT: { marcaName: [modeloName, ...] }
    const marcaById = {};
    for (const m of marcas.data) marcaById[m.id] = m.nombre;
    const CAT = {};
    for (const m of marcas.data) CAT[m.nombre] = [];
    for (const mo of modelos.data) {
      const mk = marcaById[mo.marca_id];
      if (!mk) continue;
      if (!CAT[mk]) CAT[mk] = [];
      CAT[mk].push(mo.nombre);
    }

    const fmtPrecio = (raw) => {
      if (raw == null || raw === '') return 'Precio mayorista bajo consulta';
      const s = String(raw).trim();
      // If it's just digits (with optional separators), format as Gs.
      if (/^\d[\d.,\s]*$/.test(s)) {
        const n = parseInt(s.replace(/[.,\s]/g, ''), 10);
        if (!isNaN(n)) return 'Gs. ' + n.toLocaleString('es-PY');
      }
      return s;
    };
    // Products in the shape the DC template expects
    const PROD = (prod.data || []).map((p) => ({
      id: p.id,
      img: p.img_url || 'assets/img/p-gr-rojo.jpg',
      marca: p.marca,
      modelo: p.modelo,
      tipo: p.tipo || 'Pickup',
      nombre: p.nombre,
      compat: p.compat || '',
      alt: p.img_alt || p.nombre,
      precio: p.precio || '',
      precioDisplay: fmtPrecio(p.precio),
      destacado: !!p.destacado,
      linea: p.linea || 'cubrecartes',
    }));

    // Settings as a flat object
    const settingsObj = {};
    for (const row of settings.data || []) settingsObj[row.key] = row.value;

    window.PC_DATA = { CAT, PROD, settings: settingsObj };
    if (typeof window.__pcRefreshData === 'function') window.__pcRefreshData();
  }

  ensureSdk()
    .then(loadAll)
    .catch((err) => {
      const msg = err && (err.message || err.hint || String(err));
      console.warn('[pc-supabase] hardcoded fallback in use:', msg);
      // Common causes: schema "protcard" not exposed in PostgREST, or
      // RLS policies missing. The DC keeps its hardcoded PROD/CAT.
    });
})();
