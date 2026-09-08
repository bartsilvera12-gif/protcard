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

  /* ---------- Coverflow infinite + prev/next --------------------------
     Clones the original DC-rendered cards N times so the scroll can
     wrap seamlessly. When scroll reaches the last set, we jump back to
     the middle set with no transition — reader perceives an infinite
     loop. Prev/Next buttons move by one card width. -------------------- */
  const COV_COPIES = 5;              // total copies (center + 2 each side)
  function bindCoverflow() {
    document.querySelectorAll('.pc-cover-wrap').forEach((wrap) => {
      const track = wrap.querySelector('.pc-cover');
      if (!track) return;
      if (wrap.__pcCov && track.__pcCovOriginals === track.children.length) return;
      wrap.__pcCov = true;

      // Only clone once we have real content (not placeholders during DC hydration)
      const originals = Array.from(track.children).filter((c) => c.classList && c.classList.contains('pc-cover__card'));
      if (originals.length < 2) return;
      // If already cloned, leave alone
      if (track.dataset.pcCloned === '1') { /* rebind observers only */ }
      else {
        track.dataset.pcCloned = '1';
        track.__pcCovOriginals = originals.length;
        const originalCount = originals.length;
        // Clear and rebuild with COPIES copies
        const frag = document.createDocumentFragment();
        for (let i = 0; i < COV_COPIES; i++) {
          for (const el of originals) {
            const clone = el.cloneNode(true);
            clone.dataset.pcCovIdx = String(i * originalCount + originals.indexOf(el));
            // Bind original click via dispatching on the source (DC's onclick is on originals)
            const srcIdx = originals.indexOf(el);
            clone.addEventListener('click', (e) => {
              e.preventDefault();
              const source = Array.from(track.children).filter((c) => c.classList && c.classList.contains('pc-cover__card'))[srcIdx];
              if (source && source !== clone) source.click();
            });
            frag.appendChild(clone);
          }
        }
        track.innerHTML = '';
        track.appendChild(frag);
      }

      const cards = () => Array.from(track.querySelectorAll('.pc-cover__card'));
      const originalCount = track.__pcCovOriginals || originals.length;

      const centerOn = (card, smooth = true) => {
        if (!card) return;
        const wr = track.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const delta = (cr.left + cr.width / 2) - (wr.left + wr.width / 2);
        const target = track.scrollLeft + delta;
        if (smooth) track.scrollTo({ left: target, behavior: 'smooth' });
        else { track.style.scrollBehavior = 'auto'; track.scrollLeft = target; track.style.scrollBehavior = 'smooth'; }
      };

      const update = () => {
        const cs = cards(); if (!cs.length) return;
        const wr = track.getBoundingClientRect();
        const cx = wr.left + wr.width / 2;
        let best = cs[0], bestD = Infinity, bestIdx = 0;
        for (let i = 0; i < cs.length; i++) {
          const r = cs[i].getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - cx);
          if (d < bestD) { bestD = d; best = cs[i]; bestIdx = i; }
        }
        cs.forEach((c) => c.classList.remove('is-focus', 'is-left', 'is-right'));
        best.classList.add('is-focus');
        if (cs[bestIdx - 1]) cs[bestIdx - 1].classList.add('is-left');
        if (cs[bestIdx + 1]) cs[bestIdx + 1].classList.add('is-right');
      };

      const wrapIfNeeded = () => {
        const cs = cards(); if (!cs.length) return;
        const wr = track.getBoundingClientRect();
        const cx = wr.left + wr.width / 2;
        // Find focused index
        let focusIdx = 0, bestD = Infinity;
        for (let i = 0; i < cs.length; i++) {
          const r = cs[i].getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - cx);
          if (d < bestD) { bestD = d; focusIdx = i; }
        }
        const set = Math.floor(focusIdx / originalCount);
        const centerSet = Math.floor(COV_COPIES / 2);
        if (set !== centerSet) {
          const targetCard = cs[focusIdx - (set - centerSet) * originalCount];
          if (targetCard) centerOn(targetCard, false);
        }
      };

      // Center on the middle-set first card on init
      const initCenter = () => {
        const cs = cards();
        const centerSet = Math.floor(COV_COPIES / 2);
        const target = cs[centerSet * originalCount];
        if (target) centerOn(target, false);
        update();
      };

      // Observers/listeners
      if (!track.__pcCovBound) {
        track.__pcCovBound = true;
        let scrollTO;
        track.addEventListener('scroll', () => {
          window.requestAnimationFrame(update);
          window.clearTimeout(scrollTO);
          scrollTO = window.setTimeout(wrapIfNeeded, 180);
        }, { passive: true });
        window.addEventListener('resize', () => { update(); });

        const step = (dir) => {
          const cs = cards();
          const wr = track.getBoundingClientRect();
          const cx = wr.left + wr.width / 2;
          let focusIdx = 0, bestD = Infinity;
          for (let i = 0; i < cs.length; i++) {
            const r = cs[i].getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - cx);
            if (d < bestD) { bestD = d; focusIdx = i; }
          }
          const next = cs[focusIdx + dir];
          if (next) centerOn(next, true);
        };
        wrap.querySelector('.pc-cover-nav--prev')?.addEventListener('click', () => step(-1));
        wrap.querySelector('.pc-cover-nav--next')?.addEventListener('click', () => step(1));
      }

      // Wait a frame so layout settles before centering
      window.requestAnimationFrame(() => window.requestAnimationFrame(initCenter));
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
