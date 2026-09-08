/* PROT CARD — enhancements: hamburger menu, reveal-on-scroll,
   coverflow focus, card mouse glow, FAQ smooth accordion. */
(function () {
  'use strict';

  /* ---------- Hamburger menu ------------------------------------------ */
  function ensureMenuBtn() {
    const nav = document.querySelector('nav[data-pc-nav]');
    if (!nav) return;
    let btn = document.querySelector('.pc-menu-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-menu-btn';
      btn.setAttribute('aria-label', 'Abrir menú');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      const header = nav.closest('header');
      const inner = header && header.firstElementChild;
      if (inner) inner.appendChild(btn);
    }
    btn.onclick = (e) => {
      e.preventDefault();
      nav.classList.toggle('is-open');
      btn.innerHTML = nav.classList.contains('is-open')
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    };
    // Close on link click
    nav.querySelectorAll('a').forEach((a) => {
      if (a.__pcMenuBound) return;
      a.__pcMenuBound = true;
      a.addEventListener('click', () => nav.classList.remove('is-open'));
    });
  }

  /* ---------- Reveal on scroll (.pc-slide) ---------------------------- */
  function watchReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.pc-slide').forEach((el) => el.classList.add('pc-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('pc-in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.15 });
    document.querySelectorAll('.pc-slide:not(.pc-in)').forEach((el) => io.observe(el));
  }

  /* ---------- Card mouse glow (.pc-icard) ----------------------------- */
  function bindCardGlow() {
    document.querySelectorAll('.pc-icard').forEach((card) => {
      if (card.__pcGlow) return;
      card.__pcGlow = true;
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--pcx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--pcy', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- Coverflow focus (.pc-cover) ----------------------------- */
  function bindCoverflow() {
    document.querySelectorAll('.pc-cover').forEach((wrap) => {
      if (wrap.__pcCov) return;
      wrap.__pcCov = true;
      const cards = () => Array.from(wrap.querySelectorAll('.pc-cover__card'));
      const update = () => {
        const cs = cards(); if (!cs.length) return;
        const wr = wrap.getBoundingClientRect();
        const cx = wr.left + wr.width / 2;
        let best = cs[0], bestD = Infinity;
        for (const c of cs) {
          const r = c.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - cx);
          if (d < bestD) { bestD = d; best = c; }
        }
        cs.forEach((c) => c.classList.remove('is-focus', 'is-left', 'is-right'));
        const idx = cs.indexOf(best);
        best.classList.add('is-focus');
        if (cs[idx - 1]) cs[idx - 1].classList.add('is-left');
        if (cs[idx + 1]) cs[idx + 1].classList.add('is-right');
      };
      wrap.addEventListener('scroll', () => {
        window.requestAnimationFrame(update);
      }, { passive: true });
      window.addEventListener('resize', update);
      window.requestAnimationFrame(update);
      // Initial: center the focused card
      window.setTimeout(update, 100);
    });
  }

  /* ---------- Hero slideshow: crossfade every ~6s --------------------- */
  function bindHeroSlides() {
    document.querySelectorAll('.pc-hero-slides').forEach((wrap) => {
      if (wrap.__pcSlides) return;
      wrap.__pcSlides = true;
      const slides = Array.from(wrap.querySelectorAll('.pc-hero-slide'));
      if (slides.length < 2) return;
      let i = 0;
      const tick = () => {
        slides[i].classList.remove('is-active');
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-active');
      };
      wrap.__pcSlidesTimer = window.setInterval(tick, 6000);
    });
  }

  /* ---------- FAQ accordion: sync data-pc-open → .is-open ------------- */
  function syncFaq() {
    document.querySelectorAll('.pc-faq__row').forEach((row) => {
      const v = (row.getAttribute('data-pc-open') || '').toLowerCase();
      const open = v === 'true' || v === '1';
      row.classList.toggle('is-open', open);
      if (!row.__pcFaqObs) {
        row.__pcFaqObs = new MutationObserver(() => {
          const nv = (row.getAttribute('data-pc-open') || '').toLowerCase();
          row.classList.toggle('is-open', nv === 'true' || nv === '1');
        });
        row.__pcFaqObs.observe(row, { attributes: true, attributeFilter: ['data-pc-open'] });
      }
    });
  }

  /* ---------- Boot ---------------------------------------------------- */
  function boot() {
    ensureMenuBtn();
    watchReveal();
    bindCardGlow();
    bindCoverflow();
    syncFaq();
    // Re-scan periodically to catch DC re-renders (sc-if unmounts, page changes)
    new MutationObserver(() => {
      ensureMenuBtn();
      watchReveal();
      bindCardGlow();
      bindCoverflow();
      syncFaq();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
