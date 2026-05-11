/* ============================================
   SUPERSHOES — Scroll Engine + Animations
   Image + decode() for quality, dirty-check
   writes, cached DOM, no DPR cap
   ============================================ */

(function () {
  'use strict';

  var FRAMES1_COUNT = 121;
  var FRAMES2_COUNT = 121;
  var TOTAL_FRAMES = FRAMES1_COUNT + FRAMES2_COUNT;
  var PRIORITY_BATCH = 30;
  var CHUNK_SIZE = 20;

  // DOM refs
  var loader = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  var loaderStatus = document.getElementById('loaderStatus');
  var canvas = document.getElementById('frameCanvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  var animSection = document.querySelector('.section-hero-anim');
  var heroOverlay = document.getElementById('heroOverlay');
  var progressBar = document.getElementById('animProgress');
  // Custom cursor removed per taste-skill (banned)
  var nav = document.getElementById('mainNav');
  var navBurger = document.getElementById('navBurger');
  var mobileMenu = document.getElementById('mobileMenu');
  var mobileVideo = document.getElementById('mobileVideo');

  // Cached overlay elements — never querySelector in hot path
  var overlayEls = [
    document.querySelector('.overlay-1'),
    document.querySelector('.overlay-2'),
    document.querySelector('.overlay-3'),
    document.querySelector('.overlay-4')
  ];
  var overlayRanges = [
    { start: 0.15, end: 0.30 },
    { start: 0.35, end: 0.50 },
    { start: 0.55, end: 0.70 },
    { start: 0.80, end: 0.95 }
  ];
  var FADE = 0.05;

  // State
  var frames = new Array(TOTAL_FRAMES);
  var loadedCount = 0;
  var currentFrameIndex = -1;
  var ticking = false;
  var isMobile = window.innerWidth <= 768;

  // Dirty-check
  var lastHeroOp = -1;
  var lastOverlayOps = [-1, -1, -1, -1];
  var lastProgressW = -1;
  var navScrolled = false;

  // Canvas dimensions
  var csW = 0, csH = 0;

  // --- Frame loading ---

  function getFramePath(i) {
    if (i < FRAMES1_COUNT) return 'frames1/frame_' + String(i + 1).padStart(4, '0') + '.jpg';
    return 'frames2/frame_' + String(i - FRAMES1_COUNT + 1).padStart(4, '0') + '.jpg';
  }

  // Use Image + decode() — stores compressed JPEG in memory,
  // browser manages decoded pixel cache automatically.
  // Much better memory than createImageBitmap (which holds
  // uncompressed RGBA for all 242 frames = ~800MB+)
  function loadFrame(index) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        // Pre-decode so first drawImage is jank-free
        if (img.decode) {
          img.decode().then(function () {
            frames[index] = img;
            loadedCount++;
            resolve(img);
          }).catch(function () {
            frames[index] = img;
            loadedCount++;
            resolve(img);
          });
        } else {
          frames[index] = img;
          loadedCount++;
          resolve(img);
        }
      };
      img.onerror = function () {
        loadedCount++;
        resolve(null);
      };
      img.src = getFramePath(index);
    });
  }

  async function loadAllFrames() {
    var i, start, end, batch;

    batch = [];
    for (i = 0; i < Math.min(PRIORITY_BATCH, TOTAL_FRAMES); i++) batch.push(loadFrame(i));
    await Promise.all(batch);
    updateLoaderProgress();

    for (start = PRIORITY_BATCH; start < TOTAL_FRAMES; start += CHUNK_SIZE) {
      end = Math.min(start + CHUNK_SIZE, TOTAL_FRAMES);
      batch = [];
      for (i = start; i < end; i++) batch.push(loadFrame(i));
      await Promise.all(batch);
      updateLoaderProgress();
    }
  }

  function updateLoaderProgress() {
    var pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    loaderBar.style.width = pct + '%';
    loaderStatus.textContent = pct < 100 ? 'Loading frames... ' + pct + '%' : 'Ready';
  }

  // --- Canvas ---

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    csW = window.innerWidth;
    csH = window.innerHeight;
    canvas.width = csW * dpr;
    canvas.height = csH * dpr;
    canvas.style.width = csW + 'px';
    canvas.style.height = csH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // High-quality upscaling for 720p source on hi-DPI screens
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  function drawFrame(index) {
    var img = frames[index];
    if (!img) return;

    var iw = img.naturalWidth, ih = img.naturalHeight;
    var ir = iw / ih, cr = csW / csH;
    var dw, dh, dx, dy;

    if (cr > ir) {
      dw = csW; dh = csW / ir; dx = 0; dy = (csH - dh) / 2;
    } else {
      dh = csH; dw = csH * ir; dx = (csW - dw) / 2; dy = 0;
    }

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // --- Scroll engine ---

  function getProgress() {
    var rect = animSection.getBoundingClientRect();
    var top = -rect.top;
    var range = animSection.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return Math.max(0, Math.min(1, top / range));
  }

  function onFrame() {
    if (isMobile) { ticking = false; return; }

    var p = getProgress();

    // Canvas frame
    var fi = Math.min(Math.floor(p * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1);
    if (fi !== currentFrameIndex && fi >= 0) {
      currentFrameIndex = fi;
      drawFrame(fi);
    }

    // Hero overlay (dirty-check)
    var ho;
    if (p <= 0.04) ho = 1;
    else if (p <= 0.14) ho = 1 - (p - 0.04) / 0.10;
    else ho = 0;
    ho = Math.round(Math.max(0, Math.min(1, ho)) * 100) / 100;
    if (ho !== lastHeroOp) {
      lastHeroOp = ho;
      heroOverlay.style.opacity = ho;
    }

    // Overlay text (dirty-check)
    for (var i = 0; i < 4; i++) {
      if (!overlayEls[i]) continue;
      var r = overlayRanges[i], op = 0;
      if (p >= r.start && p <= r.end) {
        if (p < r.start + FADE) op = (p - r.start) / FADE;
        else if (p <= r.end - FADE) op = 1;
        else op = (r.end - p) / FADE;
      }
      op = Math.round(Math.max(0, Math.min(1, op)) * 100) / 100;
      if (op !== lastOverlayOps[i]) {
        lastOverlayOps[i] = op;
        overlayEls[i].style.opacity = op;
      }
    }

    // Progress bar (dirty-check)
    var pw = Math.round(p * 1000) / 10;
    if (pw !== lastProgressW) {
      lastProgressW = pw;
      progressBar.style.width = pw + '%';
    }

    ticking = false;
  }

  function onScroll() {
    var st = window.scrollY || window.pageYOffset;
    var s = st > 80;
    if (s !== navScrolled) {
      navScrolled = s;
      nav.classList.toggle('scrolled', s);
    }
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }

  // --- Observers ---

  function initObservers() {
    // Feature cards
    var cards = document.querySelectorAll('.feature-card');
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); co.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    cards.forEach(function (c, i) { c.style.transitionDelay = (i * 0.12) + 's'; co.observe(c); });

    // Stats
    var statsSection = document.getElementById('statsBar');
    var counted = false;
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !counted) { counted = true; animateStats(); so.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    so.observe(statsSection);

    // Fade sections
    var sels = '.section-product, .section-features, .section-tech, .section-athlete, .section-reviews, .section-specs, .section-cta';
    var fadeSections = document.querySelectorAll(sels);
    fadeSections.forEach(function (s) { s.classList.add('fade-section'); });
    var fo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); fo.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    fadeSections.forEach(function (s) { fo.observe(s); });
  }

  function animateStats() {
    document.querySelectorAll('.stat-number').forEach(function (el) {
      var target = parseInt(el.dataset.target, 10);
      var suffix = el.dataset.suffix || '';
      var dur = 1400, t0 = performance.now();
      function tick(now) {
        var p = Math.min((now - t0) / dur, 1);
        var eased = 1 - (1 - p) * (1 - p);
        el.textContent = Math.round(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // Custom cursor removed — taste-skill bans custom cursors

  // --- Mobile ---

  function initMobileMenu() {
    navBurger.addEventListener('click', function () {
      navBurger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(function (l) {
      l.addEventListener('click', function () {
        navBurger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  function initMobileFallback() {
    if (!isMobile) return;
    animSection.classList.add('mobile-fallback');
    mobileVideo.style.display = 'block';
    animSection.querySelector('.hero-anim-sticky').appendChild(mobileVideo);
    mobileVideo.play().catch(function () {});
  }

  // --- Resize ---

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        sizeCanvas();
        if (currentFrameIndex >= 0) drawFrame(currentFrameIndex);
      }
    }, 150);
  }

  // --- Smooth scroll ---

  function initSmoothNav() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (id === '#') return;
        var t = document.querySelector(id);
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }

  // --- Init ---

  async function init() {
    document.body.style.overflow = 'hidden';

    if (!isMobile) {
      sizeCanvas();
      await loadAllFrames();
      if (frames[0]) { currentFrameIndex = 0; drawFrame(0); }
    } else {
      loaderBar.style.transition = 'width 0.6s ease-out';
      loaderBar.style.width = '100%';
      loaderStatus.textContent = 'Ready';
      await new Promise(function (r) { setTimeout(r, 1000); });
    }

    document.body.style.overflow = '';
    loader.classList.add('done');

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    initObservers();
    initMobileMenu();
    initMobileFallback();
    initSmoothNav();
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
