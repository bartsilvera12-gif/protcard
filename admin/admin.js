/* PROT CARD — admin panel. Talks to Supabase via supabase-js.
   No framework, plain DOM. */
(function () {
  'use strict';

  const cfg = window.PC_SUPABASE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  if (!cfg.url || !cfg.key) { $('#pcNoCfg').hidden = false; return; }
  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pc-admin-auth' }
  });

  const BUCKET = 'pc-images';
  let state = { marcas: [], modelos: [], productos: [], settings: {} };

  /* ------------- Auth ------------------------------------------------- */
  async function checkSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) showApp(data.session); else showLogin();
  }
  function showLogin() {
    $('#pcApp').hidden = true;
    $('#pcLogin').hidden = false;
  }
  async function showApp(session) {
    $('#pcLogin').hidden = true;
    $('#pcApp').hidden = false;
    $('#pcMeEmail').textContent = session.user.email || '';
    await loadAll();
    renderProductos();
    renderMarcas();
    renderSettingsForm();
  }
  $('#pcLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = $('#pcLoginErr'); err.hidden = true;
    const { data, error } = await sb.auth.signInWithPassword({
      email: fd.get('email'), password: fd.get('password'),
    });
    if (error) { err.textContent = error.message; err.hidden = false; return; }
    showApp(data.session);
  });
  $('#pcLogout').addEventListener('click', async () => { await sb.auth.signOut(); showLogin(); });

  /* ------------- Tabs ------------------------------------------------- */
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('is-active'));
    $$('.pane').forEach((p) => p.classList.remove('is-active'));
    t.classList.add('is-active');
    $('#tab-' + t.dataset.tab).classList.add('is-active');
  }));

  /* ------------- Data ------------------------------------------------- */
  async function loadAll() {
    const [marcas, modelos, productos, settings] = await Promise.all([
      sb.from('pc_marcas').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
      sb.from('pc_modelos').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
      sb.from('pc_productos').select('*').order('orden', { ascending: true }).order('created_at', { ascending: false }),
      sb.from('pc_settings').select('*'),
    ]);
    state.marcas = marcas.data || [];
    state.modelos = modelos.data || [];
    state.productos = productos.data || [];
    state.settings = {};
    for (const r of settings.data || []) state.settings[r.key] = r.value;
  }

  /* ------------- Productos tab ---------------------------------------- */
  function renderProductos() {
    const tb = $('#pcProdTable tbody');
    tb.innerHTML = '';
    if (!state.productos.length) {
      tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:36px;color:#6b6b6b">Sin productos todavía. Tocá <b>+ Nuevo producto</b>.</td></tr>';
      return;
    }
    for (const p of state.productos) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.img_url ? `<img class="thumb" src="${escapeAttr(p.img_url)}" alt="">` : '<div class="thumb"></div>'}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.marca || '')}</td>
        <td>${escapeHtml(p.modelo || '')}</td>
        <td>${escapeHtml(p.tipo || '')}</td>
        <td>${escapeHtml(p.precio || '')}</td>
        <td>${p.destacado ? '<span class="badge">Destacado</span>' : ''}</td>
        <td class="actions">
          <button class="btn" data-edit="${p.id}">Editar</button>
          <button class="btn btn--danger" data-del="${p.id}">Eliminar</button>
        </td>`;
      tb.appendChild(tr);
    }
    tb.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openProdModal(state.productos.find((x) => x.id === b.dataset.edit))));
    tb.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteProducto(b.dataset.del)));
  }
  $('#pcAddProd').addEventListener('click', () => openProdModal(null));

  function openProdModal(p) {
    const modal = $('#pcProdModal');
    const form = $('#pcProdForm');
    form.reset();
    $('#pcProdErr').hidden = true;
    $('#pcProdModalTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
    // Fill marca select
    const selMarca = $('#pcSelMarca');
    selMarca.innerHTML = '<option value="">Elegir…</option>' + state.marcas.map((m) => `<option value="${escapeAttr(m.nombre)}">${escapeHtml(m.nombre)}</option>`).join('');
    const selModelo = $('#pcSelModelo');
    const refreshModelos = () => {
      const marca = selMarca.value;
      const marcaRow = state.marcas.find((m) => m.nombre === marca);
      const modelos = marcaRow ? state.modelos.filter((mo) => mo.marca_id === marcaRow.id) : [];
      selModelo.innerHTML = '<option value="">Elegir…</option>' + modelos.map((mo) => `<option value="${escapeAttr(mo.nombre)}">${escapeHtml(mo.nombre)}</option>`).join('');
    };
    selMarca.onchange = refreshModelos;

    if (p) {
      form.id.value = p.id;
      form.nombre.value = p.nombre || '';
      selMarca.value = p.marca || '';
      refreshModelos();
      selModelo.value = p.modelo || '';
      form.tipo.value = p.tipo || 'Pickup';
      form.precio.value = p.precio || '';
      form.compat.value = p.compat || '';
      form.img_alt.value = p.img_alt || '';
      form.orden.value = p.orden ?? 0;
      form.destacado.checked = !!p.destacado;
      form.img_url.value = p.img_url || '';
      const preview = $('#pcProdPreview');
      if (p.img_url) { preview.src = p.img_url; preview.hidden = false; } else preview.hidden = true;
    } else {
      refreshModelos();
      $('#pcProdPreview').hidden = true;
    }
    modal.hidden = false;
  }
  $('#pcProdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = $('#pcProdErr'); errEl.hidden = true;
    const btn = $('#pcProdSave'); btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const fd = new FormData(form);
      let img_url = fd.get('img_url') || null;
      const file = fd.get('img_file');
      if (file && file instanceof File && file.size > 0) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
        img_url = pub.publicUrl;
      }
      const row = {
        nombre: fd.get('nombre'),
        marca: fd.get('marca'),
        modelo: fd.get('modelo'),
        tipo: fd.get('tipo'),
        precio: fd.get('precio') || null,
        compat: fd.get('compat') || null,
        img_url,
        img_alt: fd.get('img_alt') || null,
        destacado: !!form.destacado.checked,
        orden: parseInt(fd.get('orden') || '0', 10) || 0,
        updated_at: new Date().toISOString(),
      };
      const id = fd.get('id');
      const q = id ? sb.from('pc_productos').update(row).eq('id', id) : sb.from('pc_productos').insert(row);
      const { error } = await q;
      if (error) throw error;
      await loadAll(); renderProductos();
      $('#pcProdModal').hidden = true;
    } catch (err) {
      errEl.textContent = err.message || String(err); errEl.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]') || e.target.matches('.modal')) {
      $$('.modal').forEach((m) => m.hidden = true);
    }
  });
  $('#pcProdForm').querySelector('input[name="img_file"]').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const img = $('#pcProdPreview'); img.src = url; img.hidden = false;
  });
  async function deleteProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    const { error } = await sb.from('pc_productos').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await loadAll(); renderProductos();
  }

  /* ------------- Marcas y modelos tab --------------------------------- */
  function renderMarcas() {
    const wrap = $('#pcMarcasList');
    wrap.innerHTML = '';
    if (!state.marcas.length) {
      wrap.innerHTML = '<div class="settings-form" style="text-align:center;color:#6b6b6b">Sin marcas todavía. Tocá <b>+ Nueva marca</b>.</div>';
      return;
    }
    for (const m of state.marcas) {
      const modelos = state.modelos.filter((mo) => mo.marca_id === m.id);
      const block = document.createElement('div');
      block.className = 'marca-block';
      block.innerHTML = `
        <div class="marca-block__head">
          <h3>${escapeHtml(m.nombre)}</h3>
          <button class="btn btn--danger" data-delmarca="${m.id}">Eliminar</button>
        </div>
        <div class="marca-block__modelos">
          ${modelos.map((mo) => `<span class="chip">${escapeHtml(mo.nombre)}<button data-delmod="${mo.id}" title="Eliminar">×</button></span>`).join('') || '<span style="color:#9a9a9a;font-size:14px">Sin modelos</span>'}
        </div>
        <form class="marca-block__add" data-marca="${m.id}">
          <input name="nombre" placeholder="Nuevo modelo" required>
          <button class="btn" type="submit">Agregar</button>
        </form>`;
      wrap.appendChild(block);
    }
    wrap.querySelectorAll('[data-delmarca]').forEach((b) => b.addEventListener('click', () => deleteMarca(b.dataset.delmarca)));
    wrap.querySelectorAll('[data-delmod]').forEach((b) => b.addEventListener('click', () => deleteModelo(b.dataset.delmod)));
    wrap.querySelectorAll('form[data-marca]').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = f.nombre.value.trim(); if (!nombre) return;
      const marca_id = f.dataset.marca;
      const { error } = await sb.from('pc_modelos').insert({ marca_id, nombre });
      if (error) { alert(error.message); return; }
      f.reset();
      await loadAll(); renderMarcas();
    }));
  }
  $('#pcAddMarca').addEventListener('click', async () => {
    const nombre = prompt('Nombre de la marca (ej. Toyota):');
    if (!nombre) return;
    const { error } = await sb.from('pc_marcas').insert({ nombre: nombre.trim() });
    if (error) { alert(error.message); return; }
    await loadAll(); renderMarcas();
  });
  async function deleteMarca(id) {
    if (!confirm('¿Eliminar esta marca y todos sus modelos?')) return;
    const { error } = await sb.from('pc_marcas').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await loadAll(); renderMarcas();
  }
  async function deleteModelo(id) {
    if (!confirm('¿Eliminar este modelo?')) return;
    const { error } = await sb.from('pc_modelos').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await loadAll(); renderMarcas();
  }

  /* ------------- Settings tab ----------------------------------------- */
  function renderSettingsForm() {
    const f = $('#pcSettingsForm');
    for (const name of ['wa_number', 'wa_default_msg', 'email', 'instagram_url', 'tiktok_url']) {
      if (f[name]) f[name].value = state.settings[name] || '';
    }
  }
  $('#pcSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = $('#pcSettingsOk'); ok.hidden = true;
    const fd = new FormData(e.target);
    const rows = [];
    for (const [k, v] of fd.entries()) rows.push({ key: k, value: v, updated_at: new Date().toISOString() });
    const { error } = await sb.from('pc_settings').upsert(rows, { onConflict: 'key' });
    if (error) { alert(error.message); return; }
    await loadAll();
    ok.hidden = false;
    window.setTimeout(() => ok.hidden = true, 1800);
  });

  /* ------------- Helpers ---------------------------------------------- */
  function escapeHtml(s) { return (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }
  function escapeAttr(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  checkSession();
})();
