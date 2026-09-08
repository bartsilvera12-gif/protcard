/* PROT CARD — custom dropdown that replaces every native <select>
   with a themed button + list, backed by the real <select> so the
   dc-runtime (React) still receives the change events. */
(function () {
  'use strict';

  const CSS = `
  .pcs{position:relative;display:block;width:100%;color:inherit;font-family:'Barlow Condensed',system-ui,sans-serif}
  .pcs > select.pcs__sel{position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;margin:0;padding:0;border:0;background:transparent;-webkit-appearance:none;appearance:none;font:inherit;color:transparent}
  .pcs__btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;cursor:pointer;background:transparent;color:inherit;font:inherit;text-align:left;border:0;padding:0;margin:0;letter-spacing:.02em;transition:color .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}
  .pcs__val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;line-height:1.15}
  .pcs__ph{opacity:.65}
  .pcs__caret{flex:none;transition:transform .2s ease}
  .pcs.is-open .pcs__caret{transform:rotate(180deg)}
  .pcs.is-disabled{opacity:.5;pointer-events:none}
  .pcs__pop{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:9999;background:#fff;color:#141414;border:1px solid rgba(20,20,20,.14);border-radius:2px;box-shadow:0 16px 36px -8px rgba(20,20,20,.32),0 2px 6px rgba(20,20,20,.14);max-height:min(60vh,340px);overflow:auto;padding:4px 0;opacity:0;transform:translateY(-4px);pointer-events:none;transition:opacity .16s ease,transform .16s ease}
  .pcs.is-open .pcs__pop{opacity:1;transform:translateY(0);pointer-events:auto}
  .pcs__opt{display:flex;align-items:center;gap:10px;padding:11px 14px;font-size:16px;line-height:1.15;cursor:pointer;color:#141414;border-left:3px solid transparent;transition:background .12s ease,color .12s ease,border-color .12s ease}
  .pcs__opt:hover{background:#F2F2F3;color:#E30613;border-left-color:#E30613}
  .pcs__opt.is-sel{background:#E30613;color:#fff;border-left-color:#B4040F;font-weight:600}
  .pcs__opt.is-sel:hover{background:#B4040F;color:#fff}
  .pcs__opt.is-disabled{opacity:.4;cursor:not-allowed;color:#8a8a8a}
  .pcs__opt.is-disabled:hover{background:transparent;color:#8a8a8a;border-left-color:transparent}
  .pcs--light .pcs__btn{background:#fff;color:#141414;border:1px solid rgba(20,20,20,.2);padding:11px 12px;font-size:18px;border-radius:2px}
  .pcs--light .pcs__btn:hover{border-color:#E30613}
  .pcs.is-open.pcs--light .pcs__btn{border-color:#E30613;box-shadow:0 0 0 3px rgba(227,6,19,.15)}
  .pcs--ghost .pcs__btn{background:transparent;color:inherit;border:0;padding:8px 0;font-size:18px}
  .pcs--dark .pcs__btn{background:transparent;color:#fff;border:0;padding:6px 0;font-size:19px;letter-spacing:.03em}
  .pcs--dark .pcs__caret{color:#fff}
  `;

  function injectCss() {
    if (document.getElementById('pcs-styles')) return;
    const s = document.createElement('style');
    s.id = 'pcs-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const CARET_SVG = '<svg class="pcs__caret" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="#E30613" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CARET_DARK = '<svg class="pcs__caret" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function variantFor(sel) {
    const id = sel.id || '';
    if (id === 'pcMarcaA' || id === 'pcModeloA' || id === 'pcAnioA') return 'dark';
    if (id === 'pcFMarca' || id === 'pcFModelo' || id === 'pcFAnio') return 'ghost';
    return 'light';
  }

  function setNativeValue(sel, val) {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(sel, val);
    else sel.value = val;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Node.prototype.removeChild patch — React tries to remove the <select>
     from what it thinks is the parent. After we wrap the select in .pcs,
     its true parent changes. Forward to the actual parent so React does
     not throw NotFoundError. */
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.__pcsWrapped && child.parentNode && child.parentNode !== this) {
      try { child.__pcsCleanup && child.__pcsCleanup(); } catch (_) {}
      return origRemove.call(child.parentNode, child);
    }
    return origRemove.call(this, child);
  };
  const origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.__pcsWrapped && ref.parentNode && ref.parentNode !== this) {
      /* React wants to insert something before the select; do it in the
         real DOM location instead. */
      return origInsert.call(ref.parentNode, node, ref);
    }
    return origInsert.call(this, node, ref);
  };

  let openInstance = null;
  document.addEventListener('mousedown', (e) => {
    if (openInstance && !openInstance.wrap.contains(e.target)) openInstance.api.close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!openInstance) return;
    if (e.key === 'Escape') { openInstance.api.close(); e.preventDefault(); }
  });

  function enhance(sel) {
    if (sel.__pcsWrapped) return;
    if (sel.closest && sel.closest('.pcs')) { sel.__pcsWrapped = true; return; }
    sel.__pcsWrapped = true;

    const variant = variantFor(sel);
    const wrap = document.createElement('span');
    wrap.className = 'pcs pcs--' + variant;
    if (sel.parentNode) sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('pcs__sel');
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');

    const caret = variant === 'dark' ? CARET_DARK : CARET_SVG;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pcs__btn';
    btn.innerHTML = '<span class="pcs__val"></span>' + caret;
    if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    wrap.appendChild(btn);

    const pop = document.createElement('div');
    pop.className = 'pcs__pop';
    pop.setAttribute('role', 'listbox');
    wrap.appendChild(pop);

    const state = { wrap, sel, btn, pop, isOpen: false };

    function labelFor(v) {
      for (const o of sel.options) if (o.value === v) return o.textContent;
      return sel.options[0] ? sel.options[0].textContent : '';
    }
    function renderVal() {
      const v = sel.value;
      const label = labelFor(v);
      const first = sel.options[0];
      const isPh = first && first.value === v && first.disabled;
      const valEl = btn.querySelector('.pcs__val');
      valEl.textContent = label || '';
      valEl.classList.toggle('pcs__ph', !!isPh);
    }
    function renderList() {
      pop.innerHTML = '';
      const v = sel.value;
      for (const o of sel.options) {
        const item = document.createElement('div');
        item.className = 'pcs__opt' + (o.value === v ? ' is-sel' : '') + (o.disabled ? ' is-disabled' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('data-val', o.value);
        item.textContent = o.textContent;
        if (!o.disabled) {
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            setNativeValue(sel, o.value);
            renderVal();
            renderList();
            api.close();
          });
        }
        pop.appendChild(item);
      }
    }
    function renderDisabled() {
      wrap.classList.toggle('is-disabled', sel.disabled);
      btn.disabled = sel.disabled;
    }

    const api = {
      open() {
        if (openInstance && openInstance !== state) openInstance.api.close();
        openInstance = state;
        wrap.classList.add('is-open');
        state.isOpen = true;
        const selEl = pop.querySelector('.pcs__opt.is-sel');
        if (selEl) selEl.scrollIntoView({ block: 'nearest' });
      },
      close() {
        wrap.classList.remove('is-open');
        state.isOpen = false;
        if (openInstance === state) openInstance = null;
      },
    };
    state.api = api;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (sel.disabled) return;
      if (state.isOpen) api.close(); else api.open();
    });

    const mo = new MutationObserver(() => { renderVal(); renderList(); renderDisabled(); });
    mo.observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'value'] });
    sel.addEventListener('change', () => { renderVal(); renderList(); });

    sel.__pcsCleanup = () => {
      try { mo.disconnect(); } catch (_) {}
      if (state === openInstance) openInstance = null;
    };

    renderVal();
    renderList();
    renderDisabled();
  }

  function scan() {
    document.querySelectorAll('select:not(.pcs__sel)').forEach(enhance);
  }

  function boot() {
    injectCss();
    scan();
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) { scan(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
