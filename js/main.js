/* ==========================================================================
   main.js — Space Frame Architects
   Motion system (GSAP + ScrollTrigger), navigation, menu, hero, sections,
   gallery + lightbox, project case overlay, testimonials, cursor.
   Every feature degrades to a static, fully readable page without JS/motion.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const html = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n) => String(n).padStart(2, '0');

  const reduced = html.classList.contains('reduced');
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduced;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!hasGsap) html.classList.add('no-motion');
  // Pinned sections are measured from the top; start there unless a #hash was requested.
  if (motion && 'scrollRestoration' in history && !location.hash) { history.scrollRestoration = 'manual'; window.scrollTo(0, 0); }
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    html.classList.add('has-st');
    gsap.defaults({ ease: 'expo.out', duration: 1.2 });
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ── Scroll lock (overlays) ──────────────────────────────────────────── */
  let lockCount = 0;
  function lockScroll() {
    if (lockCount++ === 0) {
      const sb = window.innerWidth - html.clientWidth;
      if (sb > 0) document.body.style.paddingRight = sb + 'px';
      html.classList.add('is-locked');
    }
  }
  function unlockScroll() {
    if (lockCount > 0 && --lockCount === 0) {
      html.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  }

  /* ── Focus trap helper ───────────────────────────────────────────────── */
  function focusables(container) {
    return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter((el) => el.getClientRects().length > 0);
  }
  function trapTab(container, e) {
    if (e.key !== 'Tab') return;
    const f = focusables(container);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── Text splitting (lines / words) ──────────────────────────────────── */
  // Tokenises an element's text (keeping <em> and <br>) into word spans,
  // then groups the words into masked lines by measuring their offsetTop.
  function tokenise(el) {
    const tokens = [];
    const walk = (node, em) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((t) => { if (t.trim()) tokens.push({ t, em }); });
        } else if (n.nodeName === 'BR') {
          // A <br> hidden by CSS (e.g. on phones) must not force a line break.
          if (getComputedStyle(n).display !== 'none') tokens.push({ br: true });
        } else if (n.nodeType === 1) {
          walk(n, em || n.nodeName === 'EM');
        }
      });
    };
    walk(el, false);
    return tokens;
  }
  function wordSpan(tok) {
    const w = document.createElement('span');
    w.className = 'word';
    const inner = document.createElement(tok.em ? 'em' : 'span');
    inner.className = 'word__inner';
    inner.textContent = tok.t;
    w.appendChild(inner);
    return w;
  }
  function splitWords(el) {
    const original = el.innerHTML;
    const tokens = tokenise(el);
    el.innerHTML = '';
    tokens.forEach((tok, i) => {
      if (tok.br) { el.appendChild(document.createElement('br')); return; }
      el.appendChild(wordSpan(tok));
      if (i < tokens.length - 1 && !tokens[i + 1].br) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('is-split');
    return { original, targets: $$('.word__inner', el) };
  }
  function splitLines(el) {
    const original = el.innerHTML;
    const tokens = tokenise(el);
    el.innerHTML = '';
    const spans = [];
    tokens.forEach((tok) => {
      if (tok.br) { const br = document.createElement('br'); el.appendChild(br); spans.push({ br }); return; }
      const s = wordSpan(tok);
      el.appendChild(s); el.appendChild(document.createTextNode(' '));
      spans.push({ s, tok });
    });
    // Group words into lines by vertical position.
    const lines = [];
    let current = null, lastTop = null;
    spans.forEach((it) => {
      if (it.br) { current = null; lastTop = null; return; }
      const top = it.s.offsetTop;
      if (current === null || Math.abs(top - lastTop) > 4) { current = []; lines.push(current); lastTop = top; }
      current.push(it.tok);
    });
    el.innerHTML = '';
    lines.forEach((words) => {
      const line = document.createElement('span');
      line.className = 'line';
      const inner = document.createElement('span');
      inner.className = 'line__inner';
      words.forEach((tok, i) => {
        const node = tok.em ? document.createElement('em') : document.createTextNode(tok.t);
        if (tok.em) node.textContent = tok.t;
        inner.appendChild(node);
        if (i < words.length - 1) inner.appendChild(document.createTextNode(' '));
      });
      line.appendChild(inner);
      el.appendChild(line);
    });
    el.classList.add('is-split');
    return { original, targets: $$('.line__inner', el) };
  }
  function restore(el, original) { el.innerHTML = original; }

  /* ── Smooth anchor navigation ────────────────────────────────────────── */
  function scrollToTarget(hash) {
    const target = hash === '#hero' || hash === '#' ? document.body : $(hash);
    if (!target) return;
    const top = hash === '#hero' ? 0 : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    const focusEl = hash === '#hero' ? $('#hero') : target;
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.closest('.menu')) return; // menu handles its own links
    const hash = a.getAttribute('href');
    if (hash.length < 2 && hash !== '#') return;
    e.preventDefault();
    scrollToTarget(hash);
    if (history.replaceState) history.replaceState(null, '', hash);
  });

  /* ── Nav: theme per section, hide on scroll, progress bar ───────────── */
  const nav = $('#nav');
  const progressBar = $('.scroll-progress span');
  (() => {
    const sections = $$('[data-nav]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) nav.classList.toggle('is-light', en.target.dataset.nav === 'light');
        });
      }, { rootMargin: '-36px 0px -96% 0px', threshold: 0 });
      sections.forEach((s) => io.observe(s));
    }
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
      nav.classList.toggle('is-scrolled', y > 40);
      if (!html.classList.contains('is-locked')) {
        const down = y > lastY + 4, up = y < lastY - 4;
        if (down && y > window.innerHeight * 0.9) nav.classList.add('is-hidden');
        else if (up || y < 80) nav.classList.remove('is-hidden');
      }
      lastY = y;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    update();
  })();

  /* ── Fullscreen menu ─────────────────────────────────────────────────── */
  const menu = (() => {
    const el = $('#menu'), openBtn = $('#menu-open'), closeBtn = $('#menu-close');
    const links = $$('.menu__link', el), preview = $('.menu__preview img', el);
    let isOpen = false, tl = null;

    function open() {
      if (isOpen) return;
      isOpen = true;
      el.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      lockScroll();
      if (motion) {
        tl && tl.kill();
        tl = gsap.timeline();
        tl.fromTo($('.menu__bg', el), { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'expo.inOut' })
          .fromTo($$('.menu__text', el), { yPercent: 110 }, { yPercent: 0, stagger: 0.06, duration: 1 }, 0.45)
          .fromTo([$('.menu__top', el), $('.menu__foot', el), $('.menu__preview', el), ...$$('.menu__num', el)], { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.03 }, 0.6);
      }
      setTimeout(() => closeBtn.focus(), motion ? 300 : 0);
    }
    function close(after) {
      if (!isOpen) return;
      isOpen = false;
      openBtn.setAttribute('aria-expanded', 'false');
      const done = () => {
        el.hidden = true; unlockScroll();
        if (typeof after === 'function') after(); else openBtn.focus();
      };
      if (motion) {
        tl && tl.kill();
        tl = gsap.timeline({ onComplete: done });
        tl.to([...$$('.menu__text', el)], { yPercent: -110, stagger: 0.03, duration: 0.5, ease: 'power3.in' })
          .to([$('.menu__top', el), $('.menu__foot', el), $('.menu__preview', el), ...$$('.menu__num', el)], { opacity: 0, duration: 0.3 }, 0)
          .to($('.menu__bg', el), { clipPath: 'inset(100% 0 0% 0)', duration: 0.7, ease: 'expo.inOut' }, 0.25);
      } else done();
    }
    openBtn.addEventListener('click', () => (isOpen ? close() : open()));
    closeBtn.addEventListener('click', () => close());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      trapTab(el, e);
    });
    links.forEach((a) => {
      const swap = () => {
        const src = a.dataset.preview;
        if (!preview || !src || preview.getAttribute('src') === src) return;
        if (motion) {
          gsap.timeline()
            .to(preview, { clipPath: 'inset(0 0 100% 0)', duration: 0.35, ease: 'power3.in', onComplete: () => preview.setAttribute('src', src) })
            .to(preview, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'expo.out' });
        } else preview.setAttribute('src', src);
      };
      a.addEventListener('mouseenter', swap);
      a.addEventListener('focus', swap);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const hash = a.getAttribute('href');
        close(() => scrollToTarget(hash));
      });
    });
    return { close, get isOpen() { return isOpen; } };
  })();

  /* ── Opening: finalised logo + tagline, then the home page ───────────── */
  // The drawing itself is pure CSS (starts on first paint, like the original site).
  // JS only decides when the sheet lifts away and the home page takes over.
  const INTRO_HOLD = 3200;      // ms from navigation start: all strokes/words have finished
  const INTRO_SETUP_AT = 2850;  // heavy page setup runs here, after the last stroke ends
  const introActive = () => {
    const intro = $('#intro');
    return !!intro && motion && !html.classList.contains('intro-skip');
  };

  function runIntro(onDone) {
    const intro = $('#intro');
    const skipBtn = $('#intro-skip');
    if (!introActive()) {
      if (intro) intro.style.display = 'none';
      onDone();
      return;
    }
    lockScroll();
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      intro.classList.add('is-out');
      onDone();
      setTimeout(() => { intro.style.display = 'none'; unlockScroll(); }, 1250);
    };
    const skip = () => { intro.classList.add('is-skipped'); leave(); };
    const onKey = (e) => { if (e.key === 'Escape') skip(); };
    const timer = setTimeout(leave, Math.max(0, INTRO_HOLD - performance.now()));
    skipBtn.addEventListener('click', skip, { once: true });
    document.addEventListener('keydown', onKey);
    skipBtn.focus({ preventScroll: true });
  }

  /* ── Hero name: fit SPACE / FRAME / ARCHITECTS to one shared width ───── */
  // Same font size for all three words; each word's width axis (wdth 62–125) is solved so
  // the three lines end on the same edge. Short words that can't stretch far enough get
  // letter-spacing for the remainder.
  function fitBrand() {
    const brand = $('.hero__brand');
    if (!brand) return;
    const words = $$('.hb-word', brand);
    const content = brand.parentElement;
    const cs = getComputedStyle(content);
    const avail = content.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const desk = window.innerWidth >= 1024;
    const target = Math.min(avail, desk ? window.innerWidth * 0.5 : avail);
    const setW = (w, v) => { w.style.fontVariationSettings = '"wdth" ' + v.toFixed(2); w.style.fontStretch = v.toFixed(2) + '%'; };
    const width = (w) => w.offsetWidth;

    brand.style.fontSize = '';
    words.forEach((w) => { w.style.letterSpacing = ''; w.style.marginRight = ''; });
    const longest = words.reduce((a, b) => (b.textContent.length > a.textContent.length ? b : a));

    // 1 · size the font so the longest word, set fairly condensed, fills the target width
    setW(longest, 74);
    const base = parseFloat(getComputedStyle(brand).fontSize);
    const maxFs = Math.min(160, window.innerHeight * (desk ? 0.135 : 0.11));
    const fs = Math.min(maxFs, base * (target / width(longest)));
    brand.style.fontSize = fs.toFixed(2) + 'px';
    const W = width(longest);

    // 2 · solve every other word's width axis to match W
    words.forEach((w) => {
      if (w === longest) { w.dataset.wdth = 74; w.dataset.ls = 0; return; }
      setW(w, 125);
      if (width(w) <= W) {
        const n = w.textContent.length;
        const ls = (W - width(w)) / (n - 1);
        w.style.letterSpacing = ls.toFixed(2) + 'px';
        w.style.marginRight = (-ls).toFixed(2) + 'px';
        w.dataset.wdth = 125; w.dataset.ls = ls;
        return;
      }
      let lo = 62, hi = 125, mid = 100;
      for (let k = 0; k < 18; k++) { mid = (lo + hi) / 2; setW(w, mid); if (width(w) > W) hi = mid; else lo = mid; }
      setW(w, lo);
      w.dataset.wdth = lo; w.dataset.ls = 0;
    });
  }
  let fitTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { fitBrand(); if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 150); });

  /* ── Hero ────────────────────────────────────────────────────────────── */
  const heroCanvas = $('.hero__frame');
  const frame = heroCanvas && window.SpaceFrame ? new window.SpaceFrame(heroCanvas, { reduced: !motion }) : null;

  function heroEntrance() {
    if (frame) frame.start();
    const title = $('.hero__title');
    if (!motion) { title.classList.add('is-split'); return; }
    const split = splitLines(title);
    const isDesk = window.matchMedia('(min-width: 1024px)').matches;
    const tl = gsap.timeline({ defaults: { duration: 1.5 } });
    html.classList.add('hero-in');
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    if (isDesk || isPhone) {
      // Desktop & phones: the drafting sheet opens, then the elevation draws itself and lights up at dusk
      const sk = (s) => $$('.hero__sketch ' + s);
      tl.from('.hero__card', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.4, ease: 'expo.inOut' }, 0)
        .to(sk('.sk-sheet'), { opacity: 1, duration: 1 }, 0.5)
        .to(sk('.sk-ground *'), { strokeDashoffset: 0, duration: 0.9, stagger: 0.1, ease: 'power2.inOut' }, 0.7)
        .to(sk('.sk-mass *'), { strokeDashoffset: 0, duration: 1.1, stagger: 0.09, ease: 'power2.inOut' }, 0.9)
        .to(sk('.sk-detail *'), { strokeDashoffset: 0, duration: 0.9, stagger: 0.05, ease: 'power2.inOut' }, 1.6)
        .to(sk('.sk-veg *'), { strokeDashoffset: 0, duration: 1.4, stagger: 0.08, ease: 'power1.inOut' }, 1.8)
        .to(sk('.sk-dim *'), { strokeDashoffset: 0, duration: 0.9, stagger: 0.08, ease: 'power2.inOut' }, 2.1)
        .to(sk('.sk-text'), { opacity: 1, duration: 0.8 }, 2.4)
        .to(sk('.sk-hatch'), { opacity: 1, duration: 1.2 }, 2.4)
        // dusk: windows and lamps switch on one after another
        .fromTo(sk('.sk-light > *'), { opacity: 0 }, { opacity: (i, el) => parseFloat(el.getAttribute('opacity') || 1), duration: 0.5, stagger: 0.18, ease: 'power2.out' }, 3.0)
        .set(sk('.sk-light'), { opacity: 1 }, 3.0)
        .set(sk('.sk-halo'), { opacity: 1 }, 3.2)
        .fromTo(sk('.sk-halo > *'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.8, stagger: 0.1, ease: 'back.out(2)' }, 3.2);

      // Depth: layers of the drawing shift with the pointer or a finger dragged across it,
      // and with the phone's tilt where the browser allows it without a permission prompt.
      {
        const layer = (sel, k) => { const xs = gsap.quickTo(sk(sel), 'x', { duration: 1, ease: 'power3.out' }); const ys = gsap.quickTo(sk(sel), 'y', { duration: 1, ease: 'power3.out' }); return (px, py) => { xs(px * k); ys(py * k * 0.6); }; };
        const layers = [layer('.sk-veg', 14), layer('.sk-dim, .sk-text', -6), layer('.sk-sheet', -10)];
        $('.hero__card').addEventListener('pointermove', (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          layers.forEach((f) => f(px, py));
        });
        $('.hero__card').addEventListener('pointerleave', () => layers.forEach((f) => f(0, 0)));
        $('.hero__card').addEventListener('pointerup', () => layers.forEach((f) => f(0, 0)));
        if (isPhone && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
          let heroVisible = true;
          new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; }).observe($('.hero'));
          window.addEventListener('deviceorientation', (e) => {
            if (!heroVisible || e.gamma == null) return;
            layers.forEach((f) => f(clamp(e.gamma / 45, -0.5, 0.5), clamp((e.beta - 45) / 60, -0.5, 0.5)));
          }, { passive: true });
        }
      }
    } else {
      tl.from('.hero__window', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' }, 0)
        .from('.hero__img', { scale: 1.4, duration: 2.2 }, 0);
    }
    tl
      .from('.hb-word', { yPercent: 108, stagger: 0.12, duration: 1.4, ease: 'expo.out' }, 0.35)
      .from('.hero__eyebrow', { opacity: 0, x: -24 }, 0.6)
      .from(split.targets, { yPercent: 110, stagger: 0.09, onComplete: () => restore(title, split.original) }, 0.7)
      .from(['.hero__subtitle', ...$$('.hero__btns .btn')], { opacity: 0, y: 20, stagger: 0.08 }, 1)
      .from('.hero__scroll', { opacity: 0, duration: 1 }, 1.3);
    if (isPhone) tl.from('.hero__frame', { opacity: 0, scale: 0.82, y: 30, duration: 2.4, ease: 'expo.out' }, 0);

    // The name "constructs" itself: each word starts fully condensed and expands to the
    // shared measure; then a light sweeps across ARCHITECTS.
    $$('.hb-word').forEach((w, k) => {
      tl.fromTo(w, { fontVariationSettings: '"wdth" 62', letterSpacing: '0px' },
        { fontVariationSettings: '"wdth" ' + (w.dataset.wdth || 100), letterSpacing: (parseFloat(w.dataset.ls) || 0) + 'px', duration: 1.9, ease: 'expo.inOut' }, 0.55 + k * 0.08);
    });
    tl.fromTo('.hero__brand-row--gold .hb-word', { backgroundPosition: '100% 0%' }, { backgroundPosition: '0% 0%', duration: 1.8, ease: 'power2.inOut' }, 1.5);

    // Depth: the three lines drift at different rates with the pointer (desktop).
    if (isDesk && finePointer) {
      const rows = $$('.hero__brand-row');
      const movers = rows.map((r) => gsap.quickTo(r, 'x', { duration: 1.2, ease: 'power3.out' }));
      $('.hero').addEventListener('pointermove', (e) => {
        const px = e.clientX / window.innerWidth - 0.5;
        movers.forEach((m, k) => m(px * (10 + k * 9) * (k % 2 ? -1 : 1)));
      });
      $('.hero').addEventListener('pointerleave', () => movers.forEach((m) => m(0)));
    }
  }

  function heroScroll() {
    if (!motion) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const tl = gsap.timeline({
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: {
          trigger: '.hero', start: 'top top', end: '+=110%', pin: '.hero__pin', scrub: 0.8,
          onUpdate: (self) => frame && frame.setProgress(self.progress),
        },
      });
      // Two images: the small frame's photo cross-fades away while a second, full-bleed
      // photograph grows out from the same frame to fill the screen.
      tl.to('.hero__window', { opacity: 1, duration: 0.04 }, 0)
        .to('.hero__window', { clipPath: 'inset(0% 0% 0% 0%)' }, 0)
        .to('.hero__img', { scale: 1 }, 0)
        .to('.hero__card', { opacity: 0, scale: 1.1, duration: 0.42, ease: 'power1.in' }, 0.04)
        .to('.hero__sketch', { scale: 1.12, duration: 0.42 }, 0.04)
        // The three lines slide apart in alternating directions as the photograph opens
        .to('.hero__brand-row:nth-child(1)', { xPercent: -14, duration: 0.8 }, 0.08)
        .to('.hero__brand-row:nth-child(2)', { xPercent: 12, duration: 0.8 }, 0.08)
        .to('.hero__brand-row:nth-child(3)', { xPercent: -10, duration: 0.8 }, 0.08)
        .to('.hero__brand', { opacity: 0, duration: 0.55 }, 0.3)
        .to('.hero__eyebrow', { opacity: 0, duration: 0.3 }, 0)
        .to(['.hero__bottom'], { y: -60, opacity: 0, duration: 0.6 }, 0.25)
        .to('.hero__scroll', { opacity: 0, duration: 0.2 }, 0);
      return () => frame && frame.setProgress(0);
    });
    mm.add('(max-width: 767px)', () => {
      // Phones: the drawing folds back in 3D as you scroll past it
      gsap.fromTo('.hero__mstage .hero__card', { rotateX: 0, scale: 1, transformPerspective: 900, transformOrigin: '50% 100%' },
        { rotateX: 28, scale: 0.9, y: -20, ease: 'none', scrollTrigger: { trigger: '.hero__mstage', start: 'top 15%', end: 'bottom top', scrub: true } });
    });
    mm.add('(max-width: 1023px)', () => {
      gsap.to('.hero__img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__frame', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__sheet', { yPercent: 8, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__content', { yPercent: -10, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => frame && frame.setProgress(s.progress) } });
    });
  }

  /* ── Generic reveals ─────────────────────────────────────────────────── */
  function reveals() {
    if (!motion) return;

    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.1, duration: 1.3, overwrite: true }),
    });

    $$('[data-split]').forEach((el) => {
      if (el.classList.contains('hero__title')) return;
      const mode = el.dataset.split;
      const split = mode === 'words' ? splitWords(el) : splitLines(el);
      gsap.from(split.targets, {
        yPercent: 115, rotate: mode === 'words' ? 4 : 0, stagger: mode === 'words' ? 0.06 : 0.1, duration: 1.4,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        onComplete: () => { if (mode === 'lines') restore(el, split.original); },
      });
    });

    // Architectural line drawings
    $$('.draw-on-scroll').forEach((p) => {
      p.setAttribute('pathLength', '1');
      gsap.fromTo(p, { strokeDasharray: 1, strokeDashoffset: 1 }, {
        strokeDashoffset: 0, duration: 2.2, ease: 'expo.inOut',
        scrollTrigger: { trigger: p.closest('svg'), start: 'top 85%', once: true },
      });
    });
  }

  /* ── About / Our Story ───────────────────────────────────────────────── */
  // Splits text into per-character spans (keeps <em> and <br>), words kept unbreakable.
  function splitChars(el) {
    const tokens = tokenise(el);
    el.innerHTML = '';
    const chars = [], emChars = [];
    tokens.forEach((tok, i) => {
      if (tok.br) { el.appendChild(document.createElement('br')); return; }
      const word = document.createElement(tok.em ? 'em' : 'span');
      word.className = 'cword';
      [...tok.t].forEach((ch) => {
        const c = document.createElement('span');
        c.className = 'char'; c.textContent = ch;
        word.appendChild(c);
        (tok.em ? emChars : chars).push(c);
      });
      el.appendChild(word);
      if (i < tokens.length - 1 && !tokens[i + 1].br) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('is-split');
    return { chars, emChars };
  }

  // Mono labels decode from random glyphs into their real text.
  function scramble(el, duration = 1.1) {
    const final = el.textContent;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+—';
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, duration, ease: 'none',
      onUpdate: () => {
        const n = Math.floor(o.p * final.length);
        el.textContent = final.slice(0, n) + final.slice(n).replace(/\S/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
      },
      onComplete: () => { el.textContent = final; },
    });
  }

  function about() {
    if (!motion) return;
    const section = $('.about');

    // 1 · Structural column grid assembles, bubbles pop in, whole grid drifts slower than content
    $$('.bp__col', section).forEach((col, i) => {
      gsap.fromTo(col, { scaleY: 0 }, { scaleY: 1, duration: 2.4, delay: i * 0.12, ease: 'expo.inOut', scrollTrigger: { trigger: section, start: 'top 80%', once: true } });
    });
    $$('.bp__row', section).forEach((row) => {
      gsap.fromTo(row, { scaleX: 0 }, { scaleX: 1, duration: 2.2, ease: 'expo.inOut', scrollTrigger: { trigger: row, start: 'top 90%', once: true } });
    });
    $$('.bp__bubble', section).forEach((b) => {
      gsap.from(b, { scale: 0, rotate: -120, opacity: 0, duration: 1, ease: 'back.out(2.2)', scrollTrigger: { trigger: b, start: 'top 92%', once: true } });
    });
    gsap.to('.bp', { y: -120, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });

    // Drafting lamp: fine graph paper follows the pointer
    if (finePointer) {
      let raf = 0, mx = 0, my = 0;
      section.addEventListener('pointermove', (e) => {
        const r = section.getBoundingClientRect();
        mx = e.clientX - r.left; my = e.clientY - r.top;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; section.style.setProperty('--mx', mx + 'px'); section.style.setProperty('--my', my + 'px'); });
        section.classList.add('is-lamp');
      });
      section.addEventListener('pointerleave', () => section.classList.remove('is-lamp'));
    }

    // 2 · Title: characters flip up in 3D; the serif line "breathes" open then settles with scroll
    const title = $('[data-chars]', section);
    const { chars, emChars } = splitChars(title);
    const em = $$('em.cword', title);
    gsap.from(chars, { yPercent: 105, rotateX: -100, opacity: 0, stagger: 0.028, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: title, start: 'top 85%', once: true } });
    gsap.from(emChars, { y: 40, opacity: 0, filter: 'blur(10px)', stagger: 0.035, duration: 1.4, delay: 0.45, ease: 'expo.out', clearProps: 'filter', scrollTrigger: { trigger: title, start: 'top 85%', once: true } });
    gsap.fromTo(em, { letterSpacing: '0.08em' }, { letterSpacing: '-0.02em', ease: 'none', scrollTrigger: { trigger: title, start: 'top 90%', end: 'top 25%', scrub: true } });

    // 3 · Mono labels decode
    $$('.scramble', section).forEach((el) => {
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => scramble(el) });
    });

    // 4 · "2015": the outline is drawn like a plan, then filled solid like a finished build
    const yearLine = $('.about__year-line', section);
    gsap.timeline({ scrollTrigger: { trigger: '.about__est', start: 'top 85%', end: 'top 30%', scrub: 0.6 } })
      .fromTo(yearLine, { strokeDasharray: 3600, strokeDashoffset: 3600 }, { strokeDashoffset: 0, ease: 'none', duration: 0.6 })
      .fromTo('.about__year-clip', { attr: { y: 200 } }, { attr: { y: 0 }, ease: 'power1.inOut', duration: 0.5 }, 0.45);

    // 5 · Lead paragraph lights up word by word as it is read
    const lead = $('[data-lit]', section);
    const words = lead.textContent.trim().split(/\s+/);
    lead.innerHTML = words.map((w) => '<span class="lw">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>').join(' ');
    gsap.fromTo($$('.lw', lead), { opacity: 0.14 }, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 48%', scrub: true } });

    // 6 · Collage: wireframe box → scan line → photograph; depth parallax + pointer tilt
    $$('.ac', section).forEach((fig) => {
      const depth = parseFloat(fig.dataset.depth || 0);
      const img = $('img', fig), mask = $('.ac__mask', fig), wire = $$('.ac__wire path', fig), scan = $('.ac__scan', fig), cap = $('.ac__fig', fig);
      gsap.set(mask, { clipPath: 'inset(0% 0% 100% 0%)' });
      gsap.set(wire, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 82%', once: true } })
        .to(wire, { strokeDashoffset: 0, duration: 1, stagger: 0.25, ease: 'power2.inOut' })
        .from(cap, { opacity: 0, x: -12, duration: 0.6 }, 0.3)
        .set(scan, { opacity: 1, top: '0%' }, 1)
        .to(mask, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power2.inOut' }, 1)
        .to(scan, { top: '100%', duration: 1.4, ease: 'power2.inOut' }, 1)
        .to(scan, { opacity: 0, duration: 0.3 }, 2.3)
        .to(wire[1], { opacity: 0, duration: 0.8 }, 2.2)
        .to(wire[0], { opacity: 0.5, duration: 0.8 }, 2.2);
      gsap.fromTo(img, { scale: 1.25 }, { scale: 1.02, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.to(fig, { yPercent: depth * -100, ease: 'none', scrollTrigger: { trigger: '.about__collage', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    if (finePointer) {
      const collage = $('.about__collage', section);
      const tilts = $$('.ac', section).map((fig) => {
        const d = Math.abs(parseFloat(fig.dataset.depth || 0)) + 0.1;
        const m = $('.ac__mask', fig);
        gsap.set(m, { transformPerspective: 1200 });
        return { d, ry: gsap.quickTo(m, 'rotationY', { duration: 1, ease: 'power3.out' }), rx: gsap.quickTo(m, 'rotationX', { duration: 1, ease: 'power3.out' }), x: gsap.quickTo(m, 'x', { duration: 1, ease: 'power3.out' }) };
      });
      collage.addEventListener('pointermove', (e) => {
        const r = collage.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        tilts.forEach((t) => { t.ry(px * 7); t.rx(-py * 5); t.x(px * t.d * 90); });
      });
      collage.addEventListener('pointerleave', () => tilts.forEach((t) => { t.ry(0); t.rx(0); t.x(0); }));
    }

    // 7 · Pillars rise in 3D like panels being stood up; icons redraw on hover
    gsap.fromTo('.pillar', { rotateX: -75, y: 60, opacity: 0, transformPerspective: 900 }, {
      rotateX: 0, y: 0, opacity: 1, stagger: 0.16, duration: 1.5, ease: 'expo.out',
      scrollTrigger: { trigger: '.pillars', start: 'top 85%', once: true },
    });
    $$('.pillar', section).forEach((p) => {
      const path = $('.pillar__icon path', p);
      p.addEventListener('mouseenter', () => gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut', overwrite: true }));
    });

    // 8 · Stats roll like an odometer (screen readers get the plain number)
    $$('.count', section).forEach((c) => {
      const val = c.dataset.target;
      const sr = document.createElement('span');
      sr.className = 'sr-only'; sr.textContent = val;
      c.parentNode.insertBefore(sr, c);
      c.setAttribute('aria-hidden', 'true');
      c.textContent = '';
      c.classList.add('odo');
      [...val].forEach((d) => {
        const col = document.createElement('span');
        col.className = 'odo__col';
        for (let n = 0; n <= 10 + Number(d); n++) { const s = document.createElement('span'); s.textContent = n % 10; col.appendChild(s); }
        c.appendChild(col);
      });
    });
    ScrollTrigger.create({
      trigger: '.stats', start: 'top 85%', once: true,
      onEnter: () => $$('.odo', section).forEach((c, si) => {
        $$('.odo__col', c).forEach((col, i) => {
          const steps = col.children.length - 1;
          gsap.fromTo(col, { y: 0 }, { y: () => -col.children[0].offsetHeight * steps, duration: 2 + i * 0.35, delay: si * 0.12, ease: 'expo.out' });
        });
      }),
    });
  }

  /* ── Services ────────────────────────────────────────────────────────── */
  function services() {
    const items = $$('.service');
    const visuals = $$('.sv');
    const hud = $('.services__hud-num');
    let active = -1;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      items.forEach((it, j) => it.classList.toggle('is-active', j === i));
      visuals.forEach((v, j) => v.classList.toggle('is-active', j === i));
      if (hud) hud.textContent = pad(i + 1);
    };
    setActive(0);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) setActive(parseInt(en.target.dataset.service, 10)); });
      }, { rootMargin: '-48% 0px -48% 0px' });
      items.forEach((it) => io.observe(it));
    }
    if (!motion) return;
    gsap.fromTo('.services__panel', { clipPath: 'inset(7% 4% 0% 4%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.services', start: 'top bottom', end: 'top 15%', scrub: true },
    });
    gsap.matchMedia().add('(max-width: 1023px)', () => {
      $$('.service__media-m').forEach((fig) => {
        const img = $('img', fig);
        gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: fig, start: 'top 88%', once: true } });
        if (img) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 88%', once: true } });
      });
    });
    items.forEach((it) => {
      gsap.from([$('.service__head', it), $('.service__desc', it), ...$$('.service__items li', it), $('.service__cta', it)], {
        y: 30, opacity: 0, stagger: 0.05, duration: 1.1,
        scrollTrigger: { trigger: it, start: 'top 78%', once: true },
      });
    });
  }

  /* ── Selected works (phones/tablets): snap-rail state ─────────────────── */
  // Highlights the card at the rail's leading edge and updates the progress line + counter.
  function railState(workEls) {
    const rail = $('.works__rail');
    if (!rail) return;
    const bar = $('.works__mbar'), cur = $('.works__mcur');
    let raf = 0;
    const update = () => {
      raf = 0;
      if (getComputedStyle(rail).display === 'contents') { workEls.forEach((w) => w.classList.remove('is-current')); return; }
      const edge = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft);
      let best = 0, bestD = Infinity;
      workEls.forEach((w, i) => {
        const d = Math.abs(w.getBoundingClientRect().left - edge);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4) best = workEls.length - 1;
      workEls.forEach((w, i) => w.classList.toggle('is-current', i === best));
      if (bar) bar.style.setProperty('--p', ((best + 1) / workEls.length).toFixed(4));
      if (cur) cur.textContent = pad(best + 1);
      if (rail.scrollLeft > 20) rail.classList.add('is-scrolled');
      if (motion) {
        workEls.forEach((w) => {
          const m = w.querySelector('.work__media'), r = w.getBoundingClientRect();
          const d = clamp((r.left + r.width / 2 - (edge + r.width / 2)) / r.width, -1.5, 1.5);
          m.style.transform = 'perspective(900px) rotateY(' + (-d * 24).toFixed(2) + 'deg) scale(' + (1 - Math.min(Math.abs(d), 1) * 0.08).toFixed(3) + ')';
          m.style.transformOrigin = d > 0 ? '0% 50%' : '100% 50%';
        });
      }
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    rail.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ── Selected works: horizontal pinned sequence + case overlay ──────── */
  function works() {
    const track = $('.works__track');
    const workEls = $$('.work');
    const current = $('.works__current');
    const progressEl = $('.works__progress');

    if (motion) {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const distance = () => track.scrollWidth - window.innerWidth;
        const tween = gsap.to(track, {
          x: () => -distance(), ease: 'none',
          scrollTrigger: {
            trigger: '.works', start: 'top top', end: () => '+=' + distance(), pin: '.works__pin',
            scrub: 0.9, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: (self) => {
              progressEl.style.setProperty('--p', self.progress.toFixed(4));
              current.textContent = pad(clamp(Math.ceil(self.progress * workEls.length + 0.15), 1, workEls.length));
            },
          },
        });
        workEls.forEach((w) => {
          const img = $('.work__img-wrap img', w);
          const wrap = $('.work__img-wrap', w);
          gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: w, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
          gsap.fromTo(wrap, { rotateY: -14, scale: 0.9, transformPerspective: 1400, transformOrigin: '0% 50%' }, { rotateY: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: w, containerAnimation: tween, start: 'left right', end: 'left 35%', scrub: true } });
          gsap.from($$('.work__info > *', w), { y: 40, opacity: 0, stagger: 0.07, duration: 1.2, scrollTrigger: { trigger: w, containerAnimation: tween, start: 'left 75%', once: true } });
        });
        // Keyboard users: bring a focused project into view along the horizontal track.
        const pin = $('.works__pin');
        const onFocus = (e) => {
          const w = e.target.closest('.work, .works__intro');
          const st = tween.scrollTrigger;
          if (!w || !st) return;
          pin.scrollLeft = 0;
          const x = clamp(w.offsetLeft - window.innerWidth * 0.15, 0, distance());
          window.scrollTo({ top: st.start + (x / distance()) * (st.end - st.start), behavior: 'auto' });
        };
        pin.addEventListener('focusin', onFocus);
        return () => { pin.removeEventListener('focusin', onFocus); gsap.set(track, { clearProps: 'x' }); };
      });
      mm.add('(max-width: 1023px)', () => {
        gsap.from(workEls.slice(0, 3), { x: 80, opacity: 0, stagger: 0.12, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.works__rail', start: 'top 85%', once: true } });
        gsap.from('.works__mnav', { opacity: 0, y: 16, duration: 1, delay: 0.4, scrollTrigger: { trigger: '.works__rail', start: 'top 85%', once: true } });
      });
    }

    // 3D tilt on hover (desktop, fine pointer)
    if (motion && finePointer) {
      $$('.work__media').forEach((m) => {
        const inner = $('.work__img-wrap img', m);
        const rx = gsap.quickTo(m, 'rotationX', { duration: 0.8, ease: 'power3.out' });
        const ry = gsap.quickTo(m, 'rotationY', { duration: 0.8, ease: 'power3.out' });
        gsap.set(m, { transformPerspective: 1200 });
        m.addEventListener('pointermove', (e) => {
          const r = m.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * 6); rx(-py * 5);
        });
        m.addEventListener('pointerleave', () => { rx(0); ry(0); });
        if (inner) inner.draggable = false;
      });
    }

    railState(workEls);
    caseOverlay(workEls);
  }

  function caseOverlay(workEls) {
    const el = $('#case');
    const img = $('#case-img'), title = $('#case-title'), meta = $('#case-meta'), desc = $('#case-desc'), num = $('#case-num');
    const closeBtn = $('#case-close');
    let index = 0, opener = null, isOpen = false;

    const data = workEls.map((w) => {
      const im = $('.work__img-wrap img', w);
      return {
        src: im.getAttribute('src'), alt: im.getAttribute('alt'),
        title: $('.work__title', w).textContent, meta: $('.work__meta', w).textContent,
        desc: $('.work__desc', w).textContent, num: $('.work__num', w).textContent,
      };
    });
    const fill = (i) => {
      const d = data[i];
      img.src = d.src; img.alt = d.alt;
      title.textContent = d.title; meta.textContent = d.meta; desc.textContent = d.desc; num.textContent = d.num;
    };
    const open = (i, trigger) => {
      index = i; opener = trigger || null; isOpen = true;
      fill(i);
      el.hidden = false; lockScroll();
      if (motion) {
        gsap.timeline()
          .fromTo($('.case__curtain', el), { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.6, ease: 'expo.inOut' })
          .fromTo($('.case__inner', el), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0.3)
          .fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.8 }, 0.4)
          .fromTo($$('.case__body > *', el), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07 }, 0.75)
          .set($('.case__curtain', el), { scaleY: 0 });
      }
      setTimeout(() => closeBtn.focus(), motion ? 350 : 0);
    };
    const close = () => {
      if (!isOpen) return;
      isOpen = false;
      const done = () => { el.hidden = true; unlockScroll(); if (opener) opener.focus(); };
      if (motion) gsap.to($('.case__inner', el), { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut', onComplete: done });
      else done();
    };
    const go = (dir) => {
      index = (index + dir + data.length) % data.length;
      if (motion) {
        gsap.timeline()
          .to([img, ...$$('.case__body > *:not(.case__nav)', el)], { opacity: 0, duration: 0.3 })
          .add(() => fill(index))
          .fromTo(img, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 1.2 })
          .fromTo($$('.case__body > *:not(.case__nav)', el), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.9 }, '<0.1');
      } else fill(index);
    };

    $$('[data-open-case]').forEach((b) => b.addEventListener('click', () => open(parseInt(b.dataset.openCase, 10), b)));
    closeBtn.addEventListener('click', close);
    $('#case-prev').addEventListener('click', () => go(-1));
    $('#case-next').addEventListener('click', () => go(1));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      trapTab(el, e);
    });
  }

  /* ── Gallery + lightbox ──────────────────────────────────────────────── */
  const GALLERY = {
    construction: {
      label: 'Construction', folder: 'assets/img/gallery/construction/', prefix: 'construction-',
      dims: ['450x800', '595x800', '600x800', '600x800', '600x800', '640x480', '600x800', '600x800', '640x480', '626x800', '600x800', '514x800', '499x800', '500x800', '560x800', '600x800', '600x800', '450x800'],
    },
    interior: {
      label: 'Interior', folder: 'assets/img/gallery/interior/', prefix: 'interior-',
      dims: ['450x800', '640x360', '450x800', '450x800', '450x800', '450x800', '640x360', '640x360', '450x800', '450x800', '600x800', '450x800', '600x800', '600x800', '600x800', '640x480', '640x480', '640x480', '640x480', '640x480', '640x480', '640x480', '640x480', '640x480', '600x800', '640x480'],
    },
  };
  function gallery() {
    const section = $('#gallery');
    const bento = $('#bento'), gbox = $('#gbox'), actions = $('.gbox__actions'), more = $('#gallery-more');
    const film = $('#gfilm'), track = $('#gfilm-track'), filmBar = $('#gfilm-bar');
    const status = $('#gallery-status'), panel = $('#panel-gallery');
    const tabs = $$('.gtab'), ink = $('.gtab__ink'), views = $$('.gview__btn');
    let cat = 'all', view = 'grid', open = false;

    // ── Data ──
    const make = (k) => GALLERY[k].dims.map((d, i) => {
      const [w, h] = d.split('x').map(Number);
      const n = i + 1, total = GALLERY[k].dims.length;
      return {
        cat: k, label: GALLERY[k].label, n, total, w, h,
        thumb: GALLERY[k].folder + GALLERY[k].prefix + n + '-640.jpg',
        full: GALLERY[k].folder + GALLERY[k].prefix + n + '-1600.jpg',
        fullW: h > w ? Math.round(w * 2.5) : 1600,
        alt: GALLERY[k].label + ' photo ' + n + ' of ' + total,
      };
    });
    const lists = { construction: make('construction'), interior: make('interior') };
    lists.all = [];
    for (let i = 0; i < Math.max(lists.construction.length, lists.interior.length); i++) {
      if (lists.construction[i]) lists.all.push(lists.construction[i]);
      if (lists.interior[i]) lists.all.push(lists.interior[i]);
    }
    const photos = (n) => n + (n === 1 ? ' photo' : ' photos');
    ['all', 'construction', 'interior'].forEach((k) => { const c = $('#' + k + '-count'); if (c) c.textContent = lists[k].length; });

    // ── Tiles ──
    function tile(it, i, list, mode) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gtile';
      const portrait = it.h > it.w, feature = mode === 'grid' && i % 7 === 0;
      if (mode === 'grid') b.classList.add(feature ? (portrait ? 't-fp' : 't-fl') : (portrait ? 't-p' : 't-l'));
      b.dataset.cursor = 'Open';
      b.setAttribute('aria-label', 'Open ' + it.alt);
      const sizes = mode === 'film' ? '(max-width: 767px) 80vw, 50vw'
        : feature || !portrait ? '(max-width: 767px) 100vw, 45vw' : '(max-width: 767px) 50vw, 25vw';
      b.innerHTML =
        '<img src="' + it.thumb + '" srcset="' + it.thumb + ' ' + it.w + 'w, ' + it.full + ' ' + it.fullW + 'w" sizes="' + sizes + '" alt="' + it.alt + '" width="' + it.w + '" height="' + it.h + '" loading="lazy" decoding="async" />' +
        '<span class="gtile__plus" aria-hidden="true"></span>' +
        '<span class="gtile__cap" aria-hidden="true"><span class="gtile__cat mono">' + it.label + '</span><span class="mono">' + pad(it.n) + ' / ' + pad(it.total) + '</span></span>';
      $('img', b).addEventListener('error', () => { status.textContent = 'Some gallery photos could not be loaded.'; }, { once: true });
      b.addEventListener('click', () => lightbox.open(list, i, b));
      return b;
    }

    // ── Collapse / expand (grid view) ──
    const collapsedH = () => Math.max(520, Math.round(window.innerHeight * (window.innerWidth < 768 ? 1.5 : 1.05)));
    function applyCollapse(animate) {
      const full = bento.scrollHeight, short = full <= collapsedH() + 60;
      gbox.classList.toggle('is-short', short);
      gbox.classList.toggle('is-open', open);
      const target = open || short ? full : collapsedH();
      const done = () => { gbox.style.height = open || short ? 'auto' : target + 'px'; if (window.ScrollTrigger) ScrollTrigger.refresh(); };
      if (animate && motion) {
        gsap.fromTo(gbox, { height: gbox.offsetHeight }, { height: target, duration: 1, ease: 'expo.inOut', onComplete: done });
      } else done();
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      $('.gexpand__label', more).textContent = open ? 'Collapse gallery' : 'Expand gallery';
      $('#gexpand-count').textContent = open ? '' : '(' + lists[cat].length + ')';
      // Tiles hidden below the fold of a collapsed sheet are taken out of the tab order
      const limit = collapsedH() - 60;
      $$('.gtile', bento).forEach((t) => {
        const hidden = !open && !short && t.offsetTop > limit;
        t.tabIndex = hidden ? -1 : 0;
        if (hidden) t.setAttribute('aria-hidden', 'true'); else t.removeAttribute('aria-hidden');
      });
    }
    more.addEventListener('click', () => {
      open = !open;
      if (!open) {
        const top = panel.getBoundingClientRect().top + window.scrollY - 140;
        if (window.scrollY > top) window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      }
      applyCollapse(true);
      if (open && motion) {
        const fresh = $$('.gtile', bento).filter((t) => t.offsetTop > collapsedH() - 60);
        gsap.fromTo(fresh, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.05, ease: 'expo.inOut', delay: 0.2 });
      }
    });

    // ── Film strip (drag + buttons + progress) ──
    const filmProgress = () => {
      const max = track.scrollWidth - track.clientWidth;
      filmBar.style.transform = 'scaleX(' + (max > 0 ? Math.max(0.06, (track.scrollLeft + track.clientWidth) / track.scrollWidth) : 1) + ')';
    };
    track.addEventListener('scroll', filmProgress, { passive: true });
    $('#gfilm-prev').addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.8, behavior: reduced ? 'auto' : 'smooth' }));
    $('#gfilm-next').addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.8, behavior: reduced ? 'auto' : 'smooth' }));
    let drag = null;
    track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, left: track.scrollLeft, moved: false }; });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) { drag.moved = true; track.classList.add('is-dragging'); }
      if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => { if (!drag) return; setTimeout(() => track.classList.remove('is-dragging'), 0); drag = null; });

    // ── Render ──
    function render(animate) {
      const list = lists[cat];
      $('#gsheet-cat').textContent = cat === 'all' ? 'All' : GALLERY[cat].label;
      $('#gsheet-count').textContent = photos(list.length);
      panel.setAttribute('aria-labelledby', 'tab-' + cat);
      const host = view === 'grid' ? bento : track;
      (view === 'grid' ? track : bento).innerHTML = '';
      host.innerHTML = '';
      const frag = document.createDocumentFragment();
      list.forEach((it, i) => frag.appendChild(tile(it, i, list, view)));
      host.appendChild(frag);
      if (view === 'grid') applyCollapse(false); else { track.scrollLeft = 0; filmProgress(); }

      if (!motion) return;
      const els = $$('.gtile', host);
      const imgs = els.map((t) => $('img', t));
      if (animate) {
        // Visible tiles build in at once (after a tab / view switch)
        gsap.fromTo(els.slice(0, 14), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.045, ease: 'expo.inOut' });
        gsap.fromTo(imgs.slice(0, 14), { scale: 1.25 }, { scale: 1.02, duration: 1.6, stagger: 0.045, ease: 'expo.out', clearProps: 'transform' });
      } else {
        gsap.set(els, { clipPath: 'inset(100% 0% 0% 0%)' });
        ScrollTrigger.batch(els, {
          start: 'top 92%', once: true,
          onEnter: (b) => {
            gsap.to(b, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, stagger: 0.07, ease: 'expo.inOut' });
            gsap.fromTo(b.map((t) => $('img', t)), { scale: 1.25 }, { scale: 1.02, duration: 1.7, stagger: 0.07, ease: 'expo.out', clearProps: 'transform' });
          },
        });
      }
    }
    function swap() {
      const host = view === 'grid' ? bento : track;
      const els = $$('.gtile', host).slice(0, 14);
      if (motion && els.length) {
        gsap.to(els, { opacity: 0, y: 24, duration: 0.3, stagger: 0.015, ease: 'power2.in', onComplete: () => { render(true); } });
      } else render(false);
    }

    // ── Tabs (with sliding ink) ──
    const placeInk = (animate) => {
      const a = tabs.find((t) => t.classList.contains('is-active'));
      if (!a || !ink) return;
      const props = { x: a.offsetLeft, width: a.offsetWidth };
      if (motion && animate) gsap.to(ink, { ...props, duration: 0.6, ease: 'expo.out' }); else gsap.set(ink, props);
    };
    function selectTab(btn, focus) {
      tabs.forEach((t) => {
        const on = t === btn;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      placeInk(true);
      if (cat === btn.dataset.cat) return;
      cat = btn.dataset.cat; open = false;
      swap();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
        }
      });
    });

    // ── Views ──
    views.forEach((b) => b.addEventListener('click', () => {
      if (view === b.dataset.view) return;
      view = b.dataset.view;
      views.forEach((v) => { const on = v === b; v.classList.toggle('is-active', on); v.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      const grid = view === 'grid';
      gbox.hidden = !grid; actions.hidden = !grid; film.hidden = grid;
      render(true);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }));

    let rT = 0;
    window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { placeInk(false); if (view === 'grid') applyCollapse(false); filmProgress(); }, 150); });
    render(false);
    placeInk(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInk(false));

    if (motion) {
      gsap.fromTo('.gallery__bgword', { xPercent: 10 }, { xPercent: -25, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from(['.gview', '.gsheet'], { opacity: 0, y: 16, stagger: 0.1, duration: 1, scrollTrigger: { trigger: '.gallery__head', start: 'top 85%', once: true } });
    }

    // ── Lightbox: thumbnails, zoom, slideshow, keyboard, swipe ──
    const lightbox = (() => {
      const el = $('#lightbox'), im = $('#lb-img'), frame = $('#lb-frame'), countEl = $('#lb-count'), catEl = $('#lb-cat');
      const thumbs = $('#lb-thumbs'), playBtn = $('#lb-play'), zoomBtn = $('#lb-zoom'), prog = $('#lb-progress');
      const SLIDE = 4;
      let list = [], idx = 0, opener = null, isOpen = false, touchX = null, playing = false, playTl = null, playTimer = 0;

      const preload = (i) => { const it = list[(i + list.length) % list.length]; if (it) { const p = new Image(); p.src = it.full; } };
      const setZoom = (on, x, y) => {
        frame.classList.toggle('is-zoomed', on);
        zoomBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        zoomBtn.setAttribute('aria-label', on ? 'Zoom out' : 'Zoom in');
        if (x != null) { frame.style.setProperty('--zx', x + '%'); frame.style.setProperty('--zy', y + '%'); }
        if (on) stop();
      };
      const buildThumbs = () => {
        thumbs.innerHTML = list.map((it, j) => '<button type="button" class="lbthumb" data-j="' + j + '" aria-label="Show ' + it.alt + '"><img src="' + it.thumb + '" alt="" loading="lazy" decoding="async" /></button>').join('');
      };
      const markThumb = () => {
        $$('.lbthumb', thumbs).forEach((t, j) => { t.classList.toggle('is-active', j === idx); if (j === idx) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
        const t = $$('.lbthumb', thumbs)[idx];
        if (t) thumbs.scrollTo({ left: t.offsetLeft - thumbs.clientWidth / 2 + t.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      };
      const show = (i, dir) => {
        setZoom(false);
        idx = (i + list.length) % list.length;
        const it = list[idx];
        const swapImg = () => {
          im.src = it.full; im.alt = it.alt;
          countEl.textContent = pad(idx + 1) + ' / ' + pad(list.length);
          catEl.textContent = it.label + ' · ' + pad(it.n);
        };
        if (motion && dir) {
          gsap.timeline()
            .to(im, { opacity: 0, x: -40 * dir, duration: 0.22, ease: 'power2.in' })
            .add(swapImg)
            .fromTo(im, { opacity: 0, x: 40 * dir }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out' });
        } else swapImg();
        markThumb();
        preload(idx + 1); preload(idx - 1);
        if (playing) tick();
      };
      const tick = () => {
        if (playTl) playTl.kill();
        clearTimeout(playTimer);
        if (hasGsap) playTl = gsap.fromTo(prog, { scaleX: 0 }, { scaleX: 1, duration: SLIDE, ease: 'none', onComplete: () => show(idx + 1, 1) });
        else playTimer = setTimeout(() => show(idx + 1, 1), SLIDE * 1000);
      };
      const play = () => { playing = true; playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Pause slideshow'); tick(); };
      function stop() {
        playing = false; playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Play slideshow');
        if (playTl) playTl.kill(); clearTimeout(playTimer);
        if (hasGsap) gsap.set(prog, { scaleX: 0 }); else prog.style.transform = 'scaleX(0)';
      }
      const open = (l, i, trigger) => {
        list = l; opener = trigger; isOpen = true;
        buildThumbs();
        el.hidden = false; lockScroll();
        show(i, 0);
        if (motion) {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
          gsap.fromTo(im, { scale: 0.94 }, { scale: 1, duration: 1, ease: 'expo.out', clearProps: 'scale' });
          gsap.from($$('.lbthumb', thumbs).slice(Math.max(0, i - 6), i + 8), { y: 30, opacity: 0, stagger: 0.03, duration: 0.7, delay: 0.15, ease: 'expo.out' });
        }
        $('#lb-close').focus();
      };
      const close = () => {
        if (!isOpen) return;
        isOpen = false; stop(); setZoom(false);
        const done = () => { el.hidden = true; unlockScroll(); if (opener) opener.focus(); };
        if (motion) gsap.to(el, { opacity: 0, duration: 0.35, onComplete: done }); else done();
      };

      $('#lb-close').addEventListener('click', close);
      $('#lb-prev').addEventListener('click', () => show(idx - 1, -1));
      $('#lb-next').addEventListener('click', () => show(idx + 1, 1));
      playBtn.addEventListener('click', () => (playing ? stop() : play()));
      zoomBtn.addEventListener('click', () => setZoom(!frame.classList.contains('is-zoomed'), 50, 50));
      thumbs.addEventListener('click', (e) => { const t = e.target.closest('.lbthumb'); if (t) { const j = +t.dataset.j; show(j, j > idx ? 1 : -1); } });
      im.addEventListener('click', (e) => {
        if (frame.classList.contains('is-zoomed')) { setZoom(false); return; }
        const r = im.getBoundingClientRect();
        setZoom(true, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      });
      frame.addEventListener('pointermove', (e) => {
        if (!frame.classList.contains('is-zoomed') || e.pointerType !== 'mouse') return;
        const r = frame.getBoundingClientRect();
        frame.style.setProperty('--zx', clamp(((e.clientX - r.left) / r.width) * 100, 0, 100) + '%');
        frame.style.setProperty('--zy', clamp(((e.clientY - r.top) / r.height) * 100, 0, 100) + '%');
      });
      $('#lb-stage').addEventListener('click', (e) => { if (e.target.id === 'lb-stage') close(); });
      el.addEventListener('keydown', (e) => {
        const onButton = e.target.closest('button');
        if (e.key === 'Escape') { e.preventDefault(); if (frame.classList.contains('is-zoomed')) setZoom(false); else close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1, 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1, -1); }
        else if ((e.key === ' ' || e.key === 'k') && !onButton) { e.preventDefault(); playing ? stop() : play(); }
        else if (e.key === 'z' || e.key === 'Z') { setZoom(!frame.classList.contains('is-zoomed'), 50, 50); }
        trapTab(el, e);
      });
      let touchY = null;
      el.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; touchY = e.changedTouches[0].clientY; }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        if (touchY === null || frame.classList.contains('is-zoomed') || !motion) return;
        const dy = e.changedTouches[0].clientY - touchY, dx = e.changedTouches[0].clientX - touchX;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) gsap.set(im, { y: dy * 0.6, scale: 1 - Math.min(dy, 300) / 1500, opacity: 1 - Math.min(dy, 300) / 600 });
      }, { passive: true });
      el.addEventListener('touchend', (e) => {
        if (touchX === null || frame.classList.contains('is-zoomed')) { touchX = null; touchY = null; return; }
        const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
        touchX = null; touchY = null;
        if (dy > 110 && Math.abs(dy) > Math.abs(dx)) { close(); if (motion) gsap.to(im, { y: 0, scale: 1, opacity: 1, delay: 0.4, duration: 0 }); return; }
        if (motion) gsap.to(im, { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' });
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }, { passive: true });
      return { open };
    })();
  }

  /* ── Testimonials ────────────────────────────────────────────────────── */
  const STAR = 'M12 2.6 L14.8 8.7 L21.4 9.4 L16.5 13.9 L17.9 20.4 L12 17.1 L6.1 20.4 L7.5 13.9 L2.6 9.4 L9.2 8.7 Z';

  // Replaces the ★ text with drawable SVG stars (the parent keeps its "5 out of 5 stars" label).
  function buildStars() {
    if (!$('#vstar-defs')) {
      document.body.insertAdjacentHTML('beforeend',
        '<svg id="vstar-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
        '<linearGradient id="vstar-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6cc6e"/><stop offset=".55" stop-color="#c9a93a"/><stop offset="1" stop-color="#8f7419"/></linearGradient>' +
        '<clipPath id="vstar-clip"><path d="' + STAR + '"/></clipPath></defs></svg>');
    }
    const star = '<svg class="vstar" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="vs-fill" d="' + STAR + '"/>' +
      '<g clip-path="url(#vstar-clip)"><rect class="vs-shine" x="-12" y="-4" width="5" height="32" transform="rotate(22 12 12)"/></g>' +
      '<path class="vs-line" pathLength="1" d="' + STAR + '"/>' +
      '<g class="vs-sparks"><line class="vs-spark" x1="12" y1="-1.5" x2="12" y2="-4.5"/><line class="vs-spark" x1="23.5" y1="6" x2="26" y2="4"/><line class="vs-spark" x1="0.5" y1="6" x2="-2" y2="4"/><line class="vs-spark" x1="19.5" y1="22.5" x2="21.5" y2="25"/><line class="vs-spark" x1="4.5" y1="22.5" x2="2.5" y2="25"/></g>' +
      '</svg>';
    $$('.voice__stars').forEach((s) => { s.innerHTML = star.repeat(5); });
  }

  function testimonials() {
    const section = $('.voices');
    const slides = $$('.voice'), dots = $$('.vdot'), idx = $$('.vidx__btn');
    const marker = $('.vidx__marker');
    const cur = $('#v-current'), sheet = $('#v-sheet'), bar = $('#v-bar'), stage = $('#voices-stage'), card = $('.voices__card');
    const DURATION = 8;
    let i = 0, timer = null, paused = false, inView = false, started = !motion;

    buildStars();
    slides.forEach((s, j) => s.setAttribute('aria-hidden', j === 0 ? 'false' : 'true'));

    const placeMarker = (animate) => {
      const b = idx[i];
      if (!b || !marker || !b.offsetParent) return;
      const li = b.parentElement;
      const props = { y: li.offsetTop, height: li.offsetHeight };
      if (motion && animate) gsap.to(marker, { ...props, duration: 0.8, ease: 'expo.inOut' });
      else gsap.set(marker, props);
    };

    // Plays the "arrival" choreography for one slide.
    const splitCache = new Map();
    function playIn(slide, dir = 1) {
      if (!motion) return;
      const p = $('.voice__text p', slide);
      if (!splitCache.has(slide)) splitCache.set(slide, splitWords(p).targets);
      const words = splitCache.get(slide);
      const stars = $$('.vstar', slide);
      const tl = gsap.timeline();
      tl.fromTo(card, { rotateY: dir * 7, rotateX: 2 }, { rotateY: 0, rotateX: 0, duration: 1.4, ease: 'expo.out' }, 0)
        .fromTo('.voices__mark', { rotateY: dir * -180, scale: 0.6 }, { rotateY: 0, scale: 1, duration: 1.2, ease: 'expo.out' }, 0)
        .fromTo('.voices__mark path', { strokeDasharray: 1, strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 0.9, stagger: 0.12, ease: 'power2.inOut' }, 0)
        .to('.voices__mark path', { fillOpacity: 0.9, duration: 0.5, stagger: 0.1 }, 0.7)
        .fromTo(words, { yPercent: 110, opacity: 0, filter: 'blur(6px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1, stagger: 0.016, ease: 'expo.out', clearProps: 'filter' }, 0.12)
        .fromTo($('.voice__ring circle', slide), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'expo.out' }, 0.4)
        .fromTo($('.voice__initials', slide), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(2.5)' }, 0.5)
        .fromTo($('.voice__name', slide), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.inOut' }, 0.55)
        .add(() => scramble($('.voice__project', slide), 0.8), 0.65);

      // Stars: outline draws → gold fill pops → sparks burst → a shine sweeps across
      stars.forEach((s, k) => {
        const at = 0.7 + k * 0.12;
        tl.fromTo($('.vs-line', s), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, at)
          .fromTo($('.vs-fill', s), { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(3)' }, at + 0.25)
          .fromTo($$('.vs-spark', s), { opacity: 1, scale: 0.3, svgOrigin: '12 12' }, { opacity: 0, scale: 1.6, svgOrigin: '12 12', duration: 0.7, ease: 'expo.out' }, at + 0.35)
          .fromTo($('.vs-shine', s), { attr: { x: -12 } }, { attr: { x: 30 }, duration: 0.8, ease: 'power2.inOut' }, 1.6 + k * 0.08);
      });
    }

    const roll = (el, text, dir) => {
      if (!motion) { el.textContent = text; return; }
      gsap.timeline()
        .to(el, { yPercent: -100 * dir, opacity: 0, duration: 0.25, ease: 'power2.in' })
        .add(() => { el.textContent = text; })
        .fromTo(el, { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
    };

    const go = (n, dir = 1) => {
      const prev = slides[i];
      i = (n + slides.length) % slides.length;
      const next = slides[i];
      if (prev !== next) {
        prev.classList.remove('is-active'); prev.setAttribute('aria-hidden', 'true');
        next.classList.add('is-active'); next.setAttribute('aria-hidden', 'false');
        playIn(next, dir);
        roll(cur, pad(i + 1), dir);
        roll(sheet, pad(i + 1), dir);
      }
      dots.forEach((d, j) => { d.classList.toggle('is-active', j === i); if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      idx.forEach((b, j) => { b.classList.toggle('is-active', j === i); if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      placeMarker(true);
      restart();
    };

    const restart = () => {
      if (timer) timer.kill();
      if (!motion || !started) return;
      const bars = [bar, ...$$('.vidx__bar')];
      gsap.set(bars, { scaleX: 0 });
      timer = gsap.timeline({ paused: paused || !inView, onComplete: () => go(i + 1) })
        .to([bar, $('.vidx__bar', idx[i])], { scaleX: 1, duration: DURATION, ease: 'none' });
    };
    const setPaused = (p) => { paused = p; if (timer) (paused || !inView ? timer.pause() : timer.resume()); };

    $('#v-prev').addEventListener('click', () => go(i - 1, -1));
    $('#v-next').addEventListener('click', () => go(i + 1, 1));
    dots.forEach((d, j) => d.addEventListener('click', () => go(j, j >= i ? 1 : -1)));
    idx.forEach((b, j) => b.addEventListener('click', () => go(j, j >= i ? 1 : -1)));
    section.addEventListener('pointerenter', () => setPaused(true));
    section.addEventListener('pointerleave', () => setPaused(false));
    section.addEventListener('focusin', () => setPaused(true));
    section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget)) setPaused(false); });
    // Drag the card sideways: it follows the finger, tilts in 3D, and flings to the next review
    let drag = null;
    card.style.touchAction = 'pan-y';
    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, on: false };
    });
    card.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.on = true; setPaused(true);
        try { card.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
      drag.dx = dx;
      if (motion) gsap.set(card, { x: dx, rotationY: dx * 0.06, rotationZ: dx * 0.012, transformPerspective: 1200 });
    });
    const release = () => {
      if (!drag) return;
      const { dx, on } = drag; drag = null;
      if (!on) return;
      const dir = dx < 0 ? 1 : -1;
      if (Math.abs(dx) > 70) {
        if (motion) {
          gsap.to(card, { x: -dir * window.innerWidth * 0.6, rotationY: -dir * 18, opacity: 0, duration: 0.3, ease: 'power2.in',
            onComplete: () => { go(i + dir, dir); gsap.fromTo(card, { x: dir * 80, rotationY: dir * 12, rotationZ: 0, opacity: 0 }, { x: 0, rotationY: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }); } });
        } else go(i + dir, dir);
      } else if (motion) gsap.to(card, { x: 0, rotationY: 0, rotationZ: 0, duration: 0.6, ease: 'elastic.out(1, 0.6)' });
      setPaused(false);
    };
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; setPaused(paused); }, { threshold: 0.3 }).observe(section);
    }
    window.addEventListener('resize', () => placeMarker(false));
    placeMarker(false);

    if (!motion) return;

    // Section entrance: title chars, label decode, index, card standing up in 3D, first slide arrives.
    const title = $('[data-chars]', section);
    const { chars } = splitChars(title);
    gsap.from(chars, { yPercent: 105, rotateX: -100, opacity: 0, stagger: 0.03, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: title, start: 'top 85%', once: true } });
    $$('.scramble', section).forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => scramble(el) }));
    gsap.from($$('.vidx li', section), { x: -40, opacity: 0, stagger: 0.1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.vidx', start: 'top 88%', once: true }, onComplete: () => placeMarker(false) });
    gsap.set($$('.voice__by > *, .voices__mark, .voice__text p', slides[0]).concat($('.voices__mark')), { opacity: 0 });
    ScrollTrigger.create({
      trigger: stage, start: 'top 75%', once: true,
      onEnter: () => {
        gsap.set($$('.voice__by > *, .voice__text p', slides[0]).concat($('.voices__mark')), { opacity: 1 });
        gsap.from(card, { rotateX: 28, y: 90, opacity: 0, duration: 1.6, ease: 'expo.out', transformPerspective: 1400, transformOrigin: '50% 100%' });
        gsap.from('.vc', { scale: 0, duration: 0.8, stagger: 0.08, ease: 'back.out(3)', delay: 0.5 });
        playIn(slides[0], 1);
        started = true; restart();
      },
    });

    // Backdrop: outline word drifts, perspective floor rolls toward the viewer, card tilts with the pointer.
    gsap.fromTo('.voices__bgword', { xPercent: 8 }, { xPercent: -45, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.voices__floor-plane', { backgroundPosition: '0px 0px' }, { backgroundPosition: '0px 480px', ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (finePointer) {
      const ry = gsap.quickTo(card, 'rotationY', { duration: 1, ease: 'power3.out' });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 1, ease: 'power3.out' });
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 8);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
      });
      stage.addEventListener('pointerleave', () => { ry(0); rx(0); });
    }
  }

  /* ── Contact & footer flourishes ─────────────────────────────────────── */
  function finale() {
    if (!motion) return;
    gsap.fromTo('.contact__title', { letterSpacing: '0.02em' }, { letterSpacing: '-0.04em', ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top 80%', end: 'top 10%', scrub: true } });
    gsap.from('.footer__mega span', { yPercent: 100, opacity: 0, stagger: 0.12, duration: 1.6, scrollTrigger: { trigger: '.footer__mega', start: 'top 95%', once: true } });
    gsap.to('.contact__grid', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ── Cursor + magnetic elements ──────────────────────────────────────── */
  function cursor() {
    if (!motion || !finePointer) return;
    html.classList.add('has-cursor');
    const c = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); c.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.add('is-hidden'));
    document.addEventListener('pointerover', (e) => {
      const view = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button');
      c.classList.toggle('is-view', !!view);
      c.classList.toggle('is-link', !view && !!link);
      label.textContent = view ? view.dataset.cursor : '';
    });

    $$('.magnetic').forEach((m) => {
      const xTo = gsap.quickTo(m, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(m, 'y', { duration: 0.6, ease: 'power3' });
      m.addEventListener('pointermove', (e) => {
        const r = m.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.36);
      });
      m.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ── Phones: hero drawing placement ──────────────────────────────────── */
  // On phones the elevation drawing becomes the hero visual, so it moves into the
  // content flow (under the eyebrow); on desktop it returns to the pinned frame.
  function placeHeroCard() {
    const card = $('.hero__card'), stage = $('.hero__mstage'), win = $('.hero__window');
    if (!card || !stage || !win) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches && card.parentElement !== stage) stage.appendChild(card);
      else if (!mq.matches && card.parentElement === stage) win.after(card);
    };
    apply();
    if (mq.addEventListener) mq.addEventListener('change', () => { apply(); if (hasGsap) ScrollTrigger.refresh(); });
  }

  /* ── Interactive 3D massing model (Services) ─────────────────────────── */
  function model() {
    const c = $('.model__canvas');
    if (!c || !window.House3D) return;
    new window.House3D(c, { reduced: !motion });
    if (motion) {
      gsap.from('.model__tick', { scale: 0, duration: 0.8, stagger: 0.12, ease: 'back.out(3)', scrollTrigger: { trigger: '.model', start: 'top 85%', once: true } });
      gsap.fromTo('.model__hint svg', { x: -6 }, { x: 6, duration: 0.9, repeat: 5, yoyo: true, ease: 'sine.inOut', scrollTrigger: { trigger: '.model', start: 'top 70%', once: true } });
    }
  }

  /* ── Crane caricature: builds the house block by block (Contact) ─────── */
  function crane() {
    const fig = $('.build'), svg = $('.build__svg');
    if (!fig || !svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k])); (parent || svg).appendChild(n); return n; };

    // static scene: sun, ground, crane
    const sun = el('circle', { class: 'b-sun', cx: 300, cy: 46, r: 16 });
    el('path', { class: 'b-ground', d: 'M0 238 H360 M0 246 H360' });
    let lattice = 'M50 238 V52 M62 238 V52';
    for (let y = 238; y > 58; y -= 14) lattice += ' M50 ' + y + ' L62 ' + (y - 14) + ' M62 ' + y + ' L50 ' + (y - 14);
    el('path', { class: 'b-crane', d: lattice });
    let jib = 'M18 40 H332 M40 46 H332 M18 40 V46 H40';
    for (let x = 64; x < 330; x += 14) jib += ' M' + x + ' 46 L' + (x + 7) + ' 40 L' + (x + 14) + ' 46';
    el('path', { class: 'b-crane', d: jib });
    el('path', { class: 'b-crane', d: 'M56 40 V16 M56 16 L20 40 M56 16 L330 40' });
    el('rect', { class: 'b-crane b-cab', x: 44, y: 46, width: 24, height: 14 });
    el('rect', { class: 'b-weight', x: 20, y: 46, width: 18, height: 16 });

    // house blocks, drawn at their final positions
    const blocks = [
      { x: 190, y: 196, w: 124, h: 42, win: [[200, 206, 16, 30], [226, 212, 24, 16], [268, 206, 36, 32]] },   // ground floor
      { x: 196, y: 150, w: 100, h: 46, win: [[248, 158, 38, 30], [206, 172, 30, 14]] },                       // balcony box
      { x: 184, y: 140, w: 124, h: 10, win: [] },                                                              // roof slab
      { x: 314, y: 104, w: 10, h: 134, win: [] },                                                              // fin
    ];
    const lights = [];
    blocks.forEach((b) => {
      const g = el('g', { class: 'b-block' });
      el('rect', { class: 'b-body', x: b.x, y: b.y, width: b.w, height: b.h }, g);
      b.win.forEach((w) => { el('rect', { class: 'b-win', x: w[0], y: w[1], width: w[2], height: w[3] }, g); lights.push(el('rect', { class: 'b-light', x: w[0] + 1, y: w[1] + 1, width: w[2] - 2, height: w[3] - 2 }, g)); });
      b.g = g; b.cx = b.x + b.w / 2;
    });
    const trolley = el('rect', { class: 'b-trolley', x: -7, y: 46, width: 14, height: 6 });
    const cable = el('line', { class: 'b-cable', x1: 0, y1: 52, x2: 0, y2: 70 });
    const hook = el('path', { class: 'b-hook', d: 'M0 0 V6 Q0 11 -5 9' });

    const PICK_X = 112, TOP_REST = 70;
    const P = { tx: PICK_X, hy: TOP_REST, step: 0, carry: 0 };
    const render = () => {
      trolley.setAttribute('transform', 'translate(' + P.tx + ',0)');
      cable.setAttribute('x1', P.tx); cable.setAttribute('x2', P.tx); cable.setAttribute('y2', P.hy);
      hook.setAttribute('transform', 'translate(' + P.tx + ',' + P.hy + ')');
      blocks.forEach((b, j) => {
        let dx = 0, dy = 0, op = 1;
        if (j > P.step) op = 0;
        else if (j === P.step && P.step < blocks.length) {
          if (P.carry) { dx = P.tx - b.cx; dy = P.hy + 10 - b.y; }
          else { dx = PICK_X - b.cx; dy = 238 - b.h - b.y; }
        }
        b.g.setAttribute('transform', 'translate(' + dx + ',' + dy + ')');
        b.g.style.opacity = op;
      });
    };

    if (!motion) { P.step = blocks.length; render(); lights.forEach((l) => { l.style.opacity = 1; }); fig.classList.add('is-static'); return; }

    const tl = gsap.timeline({ paused: true, onUpdate: render, defaults: { ease: 'power2.inOut' } });
    tl.set(sun, { attr: { cy: 46 }, opacity: 1 }, 0);
    blocks.forEach((b, j) => {
      tl.set(P, { step: j, carry: 0 })
        .to(P, { tx: PICK_X, hy: 238 - b.h - 10, duration: 0.5 })      // lower to the waiting block
        .set(P, { carry: 1 })
        .to(P, { hy: 64 - b.h * 0.2, duration: 0.55 })                  // lift
        .to(P, { tx: b.cx, duration: 0.7 })                             // travel along the jib
        .to(P, { hy: b.y - 10, duration: 0.55, ease: 'power3.out' })     // set it down
        .set(P, { step: j + 1, carry: 0 })
        .to(P, { hy: TOP_REST, duration: 0.35 });
    });
    tl.to(sun, { attr: { cy: 232 }, opacity: 0.2, duration: tl.duration(), ease: 'none' }, 0)   // sun sets as the house goes up
      .fromTo(lights, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.2, ease: 'power1.out' })
      .to(P, { tx: PICK_X, duration: 0.6 }, '<');
    render();

    tl.timeScale(1.6);
    ScrollTrigger.create({ trigger: fig, start: 'top 80%', once: true, onEnter: () => tl.play(0) });
    fig.addEventListener('click', () => { if (!tl.isActive()) { lights.forEach((l) => { l.style.opacity = 0; }); tl.play(0); } });
  }

  /* ── Phones: quick-action dock ────────────────────────────────────────── */
  function dock() {
    const d = $('.mdock');
    if (!d) return;
    let pastHero = false, nearEnd = false;
    const sync = () => d.classList.toggle('is-visible', pastHero && !nearEnd && !html.classList.contains('is-locked'));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { pastHero = !en[0].isIntersecting; sync(); }, { rootMargin: '0px 0px -40% 0px' }).observe($('.hero'));
      const endIo = new IntersectionObserver((en) => { nearEnd = en.some((x) => x.isIntersecting); sync(); }, { threshold: 0 });
      endIo.observe($('.contact .contact__grid-info')); endIo.observe($('.footer'));
    }
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Touch: the drafting lamp in "Our Story" follows a finger too ──────── */
  function lampTouch() {
    const section = $('.about');
    if (!section || !motion) return;
    let t = 0;
    section.addEventListener('touchmove', (e) => {
      const r = section.getBoundingClientRect(), p = e.touches[0];
      section.style.setProperty('--mx', (p.clientX - r.left) + 'px');
      section.style.setProperty('--my', (p.clientY - r.top) + 'px');
      section.classList.add('is-lamp');
      clearTimeout(t); t = setTimeout(() => section.classList.remove('is-lamp'), 900);
    }, { passive: true });
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function boot() {
    placeHeroCard();
    dock();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBrand);
    if (!motion) {
      services();
      gallery();
      cursor();
      testimonials();
      model();
      crane();
      fitBrand();
      $$('[data-split]').forEach((el) => el.classList.add('is-split'));
      runIntro(() => {});
      heroEntrance();
      works();
      return;
    }
    // Order: the opening (logo + tagline) plays first; the home page animates in as it lifts.
    // The heavy setup (DOM splitting, gallery, ScrollTriggers) is held back until the logo
    // has finished drawing, so nothing competes with the opening for the main thread.
    const fontsReady = document.fonts && document.fonts.ready
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))])
      : Promise.resolve();
    let releaseSetup;
    const setupGate = new Promise((r) => { releaseSetup = r; });
    if (introActive()) setTimeout(releaseSetup, Math.max(0, INTRO_SETUP_AT - performance.now()));
    else releaseSetup();

    let introDone = false, setupDone = false, heroStarted = false;
    const maybeHero = () => {
      if (introDone && setupDone && !heroStarted) { heroStarted = true; heroEntrance(); ScrollTrigger.refresh(); }
    };
    runIntro(() => { introDone = true; releaseSetup(); maybeHero(); });
    Promise.all([fontsReady, setupGate]).then(() => {
      fitBrand();
      services();
      gallery();
      cursor();
      heroScroll();
      reveals();
      about();
      works();
      testimonials();
      model();
      crane();
      lampTouch();
      finale();
      ScrollTrigger.refresh();
      setupDone = true;
      maybeHero();
    });
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }


  // Global Escape for the menu when focus is outside it (e.g. after a click)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.isOpen) menu.close(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
