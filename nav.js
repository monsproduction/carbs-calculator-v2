(function () {
  'use strict';

  /* ============================================
     Theme Toggle  (shared across all pages)
     ============================================ */
  var saved = localStorage.getItem('fuel-theme') || 'dark';
  applyTheme(saved);

  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('fuel-theme', next);
    });
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var sun = document.querySelector('.icon-sun');
    var moon = document.querySelector('.icon-moon');
    if (sun) sun.style.display = t === 'dark' ? 'block' : 'none';
    if (moon) moon.style.display = t === 'light' ? 'block' : 'none';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#08090d' : '#f5f5f7');
    var label = document.getElementById('themeLabel');
    if (label) label.textContent = t === 'dark' ? 'Hellmodus' : 'Dunkelmodus';
  }

  /* ============================================
     Sidebar Toggle  (mobile slide-in)
     ============================================ */
  var menuBtn = document.getElementById('menuToggle');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (menuBtn) menuBtn.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (menuBtn) menuBtn.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }
  if (overlay) overlay.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) closeSidebar();
  });

  /* ============================================
     Active Page Highlighting
     ============================================ */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
    if (item.dataset.page === page) item.classList.add('active');
  });

})();
