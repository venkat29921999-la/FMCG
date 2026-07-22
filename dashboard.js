/* =========================================================
   MERIDIAN — DASHBOARD.JS
   Shared logic for dashboard-user.html and dashboard-admin.html
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     0. STORAGE HELPERS
     --------------------------------------------------------- */
  function getSession () {
    try { return JSON.parse(localStorage.getItem('meridian_session') || 'null'); }
    catch (e) { return null; }
  }
  function getUsers () {
    try { return JSON.parse(localStorage.getItem('meridian_users') || '[]'); }
    catch (e) { return []; }
  }
  function saveUsers (list) { localStorage.setItem('meridian_users', JSON.stringify(list)); }

  /* ---------------------------------------------------------
     1. AUTH GUARD — must run before anything renders
     --------------------------------------------------------- */
  const session = getSession();
  const pageRole = document.body.getAttribute('data-role'); // 'user' | 'admin'

  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  if (session.role !== pageRole) {
    window.location.href = (session.role === 'admin') ? 'dashboard-admin.html' : 'dashboard-user.html';
    return;
  }

  /* ---------------------------------------------------------
     2. POPULATE USER IDENTITY
     --------------------------------------------------------- */
  function initials (name) {
    if (!name) return 'M';
    const parts = name.trim().split(/\s+/);
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function greeting () {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = session.name || 'Meridian User'; });
  document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = session.email || ''; });
  document.querySelectorAll('[data-user-avatar]').forEach(el => { el.textContent = initials(session.name); });
  document.querySelectorAll('[data-user-greeting]').forEach(el => { el.textContent = greeting() + ', ' + (session.name ? session.name.split(' ')[0] : 'there'); });
  document.querySelectorAll('[data-today]').forEach(el => {
    el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  });

  /* ---------------------------------------------------------
     3. LOGOUT
     --------------------------------------------------------- */
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.removeItem('meridian_session');
      window.location.href = 'login.html';
    });
  });

  /* ---------------------------------------------------------
     4. SIDEBAR / MOBILE MENU
     --------------------------------------------------------- */
  const sidebar = document.getElementById('dashSidebar');
  const overlay = document.getElementById('dashOverlay');
  const hamburger = document.getElementById('dashHamburger');
  const sidebarClose = document.getElementById('dashSidebarClose');

  function openSidebar () { sidebar && sidebar.classList.add('is-open'); overlay && overlay.classList.add('is-open'); }
  function closeSidebar () { sidebar && sidebar.classList.remove('is-open'); overlay && overlay.classList.remove('is-open'); }

  hamburger && hamburger.addEventListener('click', openSidebar);
  sidebarClose && sidebarClose.addEventListener('click', closeSidebar);
  overlay && overlay.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

  /* ---------------------------------------------------------
     5. SECTION ROUTER (single page tab system)
     --------------------------------------------------------- */
  const navLinks = document.querySelectorAll('.dash-nav a[data-section]');
  const sections = document.querySelectorAll('.dash-section');

  function showSection (id) {
    sections.forEach(s => s.classList.toggle('is-active', s.getAttribute('data-section') === id));
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('data-section') === id));
    document.querySelectorAll('.dash-section.is-active [data-reveal]').forEach(el => el.classList.add('is-visible'));
    const content = document.getElementById('dashContent');
    if (content) content.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeSidebar();
    const search = document.getElementById('dashSearchInput');
    if (search) search.value = '';
    runSearchFilter('');
  }

  navLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showSection(a.getAttribute('data-section'));
    });
  });
  if (navLinks.length) showSection(navLinks[0].getAttribute('data-section'));

  /* ---------------------------------------------------------
     6. SCROLL / LOAD REVEAL
     --------------------------------------------------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealIO.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  function observeReveal (scope) {
    (scope || document).querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => revealIO.observe(el));
  }
  observeReveal();

  /* ---------------------------------------------------------
     7. ANIMATED COUNTERS (works for static + dynamically-set data-count)
     --------------------------------------------------------- */
  function animateCount (el, target, isPlain, prefix, suffix) {
    const dur = 1300;
    const start = performance.now();
    function tick (now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(target * eased);
      el.textContent = (prefix || '') + (isPlain ? val : val.toLocaleString()) + (suffix || '');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = (prefix || '') + (isPlain ? target : target.toLocaleString()) + (suffix || '');
    }
    requestAnimationFrame(tick);
  }
  function initCounters () {
    document.querySelectorAll('[data-count]').forEach(el => {
      if (el.dataset.counted) return;
      const target = parseFloat(el.getAttribute('data-count'));
      const isPlain = el.hasAttribute('data-plain');
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      const cIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            el.dataset.counted = '1';
            animateCount(el, target, isPlain, prefix, suffix);
            cIO.unobserve(el);
          }
        });
      }, { threshold: 0.5 });
      cIO.observe(el);
    });
  }

  /* ---------------------------------------------------------
     8. TOAST
     --------------------------------------------------------- */
  let toastTimer;
  function toast (msg, icon) {
    let el = document.getElementById('dashToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dashToast';
      el.className = 'dash-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = '<i class="fa-solid ' + (icon || 'fa-circle-check') + '"></i><span>' + msg + '</span>';
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }

  /* ---------------------------------------------------------
     9. NOTIFICATION DROPDOWN
     --------------------------------------------------------- */
  const notifBtn = document.getElementById('dashNotifBtn');
  const notifPanel = document.getElementById('dashNotifPanel');
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', e => {
      e.stopPropagation();
      notifPanel.classList.toggle('is-open');
    });
    document.addEventListener('click', e => {
      if (!notifPanel.contains(e.target) && e.target !== notifBtn) notifPanel.classList.remove('is-open');
    });
  }

  /* ---------------------------------------------------------
     10. IMAGE FALLBACK (graceful, matches site pattern)
     --------------------------------------------------------- */
  function attachImgFallback (img) {
    img.addEventListener('error', function handler () {
      const wrap = img.parentElement;
      if (!wrap || wrap.classList.contains('img-fallback')) return;
      wrap.classList.add('img-fallback');
      const note = document.createElement('div');
      note.className = 'img-fallback-icon';
      note.innerHTML = '<i class="fa-solid fa-image"></i><span>' + (img.alt || 'Meridian') + '</span>';
      wrap.appendChild(note);
    }, { once: true });
  }

  /* =========================================================
     11. EMAIL DATA
     ========================================================= */
  const EMAIL_DATA = {
    user: [
      { id: 1, from: 'Meridian Support', initials: 'MS', subject: 'Your order MER-10221 has shipped', preview: 'Good news — your Eau de Parfum Collection is on its way and should arrive within 3–5 business days.', time: '2h ago', tag: 'Shipping', unread: true, flagged: false },
      { id: 2, from: 'Billing Team', initials: 'BT', subject: 'Payment receipt for order MER-10234', preview: 'Thanks for your purchase. Your receipt for Concentrate Laundry Pearls is attached to this message.', time: '1d ago', tag: 'Billing', unread: true, flagged: false },
      { id: 3, from: 'Meridian Rewards', initials: 'MR', subject: 'You just earned 120 reward points', preview: 'Your recent purchases pushed you closer to Gold tier — keep stacking those points all month.', time: '2d ago', tag: 'Rewards', unread: false, flagged: true },
      { id: 4, from: 'Product Team', initials: 'PT', subject: 'New arrivals in Personal Care', preview: 'We just added three new botanical fragrances to the Personal Care line — take an early look.', time: '4d ago', tag: 'News', unread: false, flagged: false },
      { id: 5, from: 'Meridian Support', initials: 'MS', subject: 'How was your recent delivery?', preview: 'We would love your feedback on your last order so we can keep improving how we ship.', time: '6d ago', tag: 'Feedback', unread: false, flagged: false },
      { id: 6, from: 'Sustainability Desk', initials: 'SD', subject: 'Your 2026 impact summary is ready', preview: 'See how your purchases contributed to recyclable packaging and carbon offset goals this year.', time: '1w ago', tag: 'Impact', unread: false, flagged: false }
    ],
    admin: [
      { id: 1, from: 'Priya Nandakumar', initials: 'PN', subject: 'Refund request — order MER-10198', preview: 'Customer is requesting a partial refund due to a damaged shipment. Case #4521 is attached.', time: '32m ago', tag: 'Support', unread: true, flagged: true },
      { id: 2, from: 'Logistics — Nairobi Hub', initials: 'LN', subject: 'Delay flagged on 3 shipments', preview: 'Weather disruption at the Nairobi hub may delay 3 outbound shipments by roughly 24–48 hours.', time: '1h ago', tag: 'Ops', unread: true, flagged: false },
      { id: 3, from: 'HR Team', initials: 'HR', subject: 'New hire onboarding — Plant 4', preview: 'Six new production associates start Monday at Plant 4. Please review the onboarding checklist.', time: '3h ago', tag: 'Internal', unread: true, flagged: false },
      { id: 4, from: 'Northgate Retail', initials: 'NR', subject: 'Q3 fill-rate review meeting', preview: 'Requesting a call this week to review fill-rate performance ahead of the retail partnership renewal.', time: '1d ago', tag: 'Partner', unread: false, flagged: true },
      { id: 5, from: 'Finance Desk', initials: 'FD', subject: 'Monthly revenue report is ready', preview: 'The June revenue and margin report has been generated and is ready for your review.', time: '2d ago', tag: 'Finance', unread: false, flagged: false },
      { id: 6, from: 'Quality Assurance', initials: 'QA', subject: 'Batch audit passed — Plant 2', preview: 'Batch #2291 completed its ISO 22000 audit with zero non-conformities. Report attached.', time: '3d ago', tag: 'QA', unread: false, flagged: false }
    ]
  };
  const emailData = EMAIL_DATA[pageRole] || [];

  function unreadCount () { return emailData.filter(e => e.unread).length; }
  function updateUnreadBadges () {
    const n = unreadCount();
    document.querySelectorAll('[data-unread-badge]').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
    });
    const dot = document.getElementById('dashNotifDot');
    if (dot) dot.style.display = n > 0 ? '' : 'none';
  }

  /* ---- preview widget (Overview panel — top unread-first, static) ---- */
  function renderEmailPreview () {
    const el = document.getElementById('emailPreviewList');
    if (!el) return;
    const items = emailData.slice().sort((a, b) => (b.unread - a.unread)).slice(0, 4);
    el.innerHTML = items.map(buildEmailItemHTML).join('') || emptyStateHTML('fa-inbox', 'No messages yet');
    el.querySelectorAll('.email-item').forEach(row => {
      row.addEventListener('click', () => showSection('messages'));
    });
  }

  /* ---- full widget (Messages section — filterable, interactive) ---- */
  let currentEmailFilter = 'all';
  function buildEmailItemHTML (item) {
    return (
      '<div class="email-item' + (item.unread ? ' is-unread' : '') + '" data-id="' + item.id + '" data-reveal>' +
        '<div class="email-avatar">' + item.initials + '</div>' +
        '<div class="email-body">' +
          '<div class="email-top-row"><span class="email-from">' + item.from + '</span><span class="email-time">' + item.time + '</span></div>' +
          '<div class="email-subject">' + item.subject + '</div>' +
          '<p class="email-preview">' + item.preview + '</p>' +
          '<span class="email-tag">' + item.tag + '</span>' +
        '</div>' +
        '<button type="button" class="email-flag' + (item.flagged ? ' is-flagged' : '') + '" aria-label="Flag message"><i class="fa-solid fa-flag"></i></button>' +
      '</div>'
    );
  }
  function emptyStateHTML (icon, msg) {
    return '<div class="empty-state"><i class="fa-solid ' + icon + '"></i><p>' + msg + '</p></div>';
  }
  function renderFullEmails (searchTerm) {
    const el = document.getElementById('emailFullList');
    if (!el) return;
    searchTerm = (searchTerm || '').toLowerCase();
    let items = emailData.slice();
    if (currentEmailFilter === 'unread') items = items.filter(e => e.unread);
    if (currentEmailFilter === 'flagged') items = items.filter(e => e.flagged);
    if (searchTerm) items = items.filter(e => (e.from + ' ' + e.subject + ' ' + e.preview).toLowerCase().indexOf(searchTerm) !== -1);

    el.innerHTML = items.map(buildEmailItemHTML).join('') || emptyStateHTML('fa-envelope-open', 'No messages match this view');
    observeReveal(el);

    el.querySelectorAll('.email-item').forEach(row => {
      const id = parseInt(row.getAttribute('data-id'), 10);
      row.addEventListener('click', () => {
        const item = emailData.find(e => e.id === id);
        if (item && item.unread) {
          item.unread = false;
          updateUnreadBadges();
          renderFullEmails(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
          renderEmailPreview();
        }
      });
      const flagBtn = row.querySelector('.email-flag');
      flagBtn && flagBtn.addEventListener('click', e => {
        e.stopPropagation();
        const item = emailData.find(e2 => e2.id === id);
        if (item) {
          item.flagged = !item.flagged;
          toast(item.flagged ? 'Message flagged' : 'Flag removed', 'fa-flag');
          renderFullEmails(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
        }
      });
    });
  }
  function wireEmailTabs () {
    const tabs = document.querySelectorAll('#emailFullTabs button');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentEmailFilter = btn.getAttribute('data-filter');
        renderFullEmails(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
      });
    });
  }

  /* =========================================================
     12. ORDERS (user dashboard)
     ========================================================= */
  const IMG = {
    laundry: 'Assest//commercial_laundry.webp',
    perfume: 'Assest//perfume.webp',
    water: 'Assest//water_bottle.webp',
    vitamins: 'Assest//pills.webp',
    pantry: 'Assest//milk_pouring.webp',
    skincare: 'Assest//skincare_tube.webp'
  };
  const STATUS_MAP = {
    processing: { label: 'Processing', cls: 'status-pending' },
    shipped: { label: 'Shipped', cls: 'status-active' },
    delivered: { label: 'Delivered', cls: 'status-done' }
  };
  const ORDER_DATA = [
    { id: 'MER-10234', name: 'Concentrate Laundry Pearls', sku: 'HC-009', qty: 2, date: 'Jul 18, 2026', status: 'delivered', img: IMG.laundry },
    { id: 'MER-10221', name: 'Eau de Parfum Collection', sku: 'PC-027', qty: 1, date: 'Jul 15, 2026', status: 'shipped', img: IMG.perfume },
    { id: 'MER-10198', name: 'Sparkling Spring Water · 12pk', sku: 'FB-014', qty: 3, date: 'Jul 09, 2026', status: 'processing', img: IMG.water },
    { id: 'MER-10176', name: 'Daily Vitamins — Family Pack', sku: 'HW-011', qty: 1, date: 'Jun 30, 2026', status: 'delivered', img: IMG.vitamins },
    { id: 'MER-10152', name: 'Organic Dairy Bundle', sku: 'FB-002', qty: 2, date: 'Jun 21, 2026', status: 'shipped', img: IMG.pantry },
    { id: 'MER-10130', name: 'Skin & Hair Care Duo', sku: 'PC-014', qty: 1, date: 'Jun 10, 2026', status: 'delivered', img: IMG.skincare }
  ];

  function buildOrderRowHTML (o) {
    const s = STATUS_MAP[o.status];
    return (
      '<div class="order-row" data-reveal data-search="' + (o.name + ' ' + o.id + ' ' + o.sku).toLowerCase() + '">' +
        '<div class="order-media">' +
          '<img class="order-thumb" src="' + o.img + '" alt="' + o.name + '" loading="lazy">' +
          '<span class="order-sku">' + o.sku + '</span>' +
        '</div>' +
        '<div class="order-info"><b>' + o.name + '</b><span>' + o.id + ' · Qty ' + o.qty + ' · ' + o.date + '</span></div>' +
        '<span class="order-status ' + s.cls + '">' + s.label + '</span>' +
      '</div>'
    );
  }
  let currentOrderFilter = 'all';
  function renderOrders (searchTerm) {
    const el = document.getElementById('orderFullList');
    if (!el) return;
    searchTerm = (searchTerm || '').toLowerCase();
    let items = ORDER_DATA.slice();
    if (currentOrderFilter !== 'all') items = items.filter(o => o.status === currentOrderFilter);
    if (searchTerm) items = items.filter(o => (o.name + ' ' + o.id + ' ' + o.sku).toLowerCase().indexOf(searchTerm) !== -1);
    el.innerHTML = items.map(buildOrderRowHTML).join('') || emptyStateHTML('fa-box-open', 'No orders match this view');
    el.querySelectorAll('.order-thumb').forEach(attachImgFallback);
    observeReveal(el);
    el.querySelectorAll('.order-row').forEach(row => row.addEventListener('click', () => toast('Opening order details…', 'fa-box-open')));
  }
  function renderOrderPreview () {
    const el = document.getElementById('orderPreviewList');
    if (!el) return;
    const items = ORDER_DATA.slice(0, 3);
    el.innerHTML = items.map(buildOrderRowHTML).join('');
    el.querySelectorAll('.order-thumb').forEach(attachImgFallback);
    observeReveal(el);
  }
  function wireOrderTabs () {
    const tabs = document.querySelectorAll('#orderFullTabs button');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentOrderFilter = btn.getAttribute('data-filter');
        renderOrders(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
      });
    });
  }

  /* ---- shipment tracker ---- */
  const SHIP_STEPS = ['Ordered', 'Processed', 'Shipped', 'Delivered'];
  function buildShipTrackHTML (status) {
    const idx = { processing: 1, shipped: 2, delivered: 3 }[status];
    return '<div class="ship-track">' + SHIP_STEPS.map((label, i) => {
      let cls = '';
      if (status === 'delivered') cls = 'is-done';
      else if (i < idx) cls = 'is-done';
      else if (i === idx) cls = 'is-active';
      const icon = cls === 'is-done' ? '<i class="fa-solid fa-check"></i>' : (i + 1);
      return '<div class="ship-step ' + cls + '"><span>' + icon + '</span><b>' + label + '</b></div>';
    }).join('') + '</div>';
  }
  function renderShipments () {
    const el = document.getElementById('shipmentList');
    if (!el) return;
    const active = ORDER_DATA.filter(o => o.status !== 'delivered');
    if (!active.length) { el.innerHTML = emptyStateHTML('fa-truck-fast', 'No active shipments — everything has been delivered.'); return; }
    el.innerHTML = active.map(o => (
      '<div class="dash-panel" data-reveal style="margin-bottom:20px;">' +
        '<div class="dash-panel-head"><h3><i class="fa-solid fa-truck-fast"></i> ' + o.name + '</h3><span class="order-sku">' + o.id + '</span></div>' +
        buildShipTrackHTML(o.status) +
      '</div>'
    )).join('');
    observeReveal(el);
  }

  /* =========================================================
     13. USERS TABLE (admin dashboard)
     ========================================================= */
  function roleToggleIcon (role) { return role === 'admin' ? 'fa-user' : 'fa-user-shield'; }
  function buildUserRowHTML (u, idx) {
    const isSelf = session.email && u.email.toLowerCase() === session.email.toLowerCase();
    return (
      '<tr data-search="' + (u.name + ' ' + u.email).toLowerCase() + '">' +
        '<td><div class="dash-user-chip"><div class="dash-avatar" style="width:34px;height:34px;font-size:13px;">' + initials(u.name) + '</div><b>' + u.name + (isSelf ? ' <span style="color:var(--gold);font-size:11px;">(You)</span>' : '') + '</b></div></td>' +
        '<td>' + u.email + '</td>' +
        '<td><span class="role-pill role-' + u.role + '">' + u.role + '</span></td>' +
        '<td><span class="order-status status-done">Active</span></td>' +
        '<td style="white-space:nowrap;">' +
          '<a href="404.html" type="button" class="dash-icon-btn" style="width:32px;height:32px;" data-action="role" data-idx="' + idx + '" title="Toggle role"><i class="fa-solid ' + roleToggleIcon(u.role) + '" style="font-size:12px;"></i></a> ' +
          // '<a href="404.html" type="button" class="dash-icon-btn" style="width:32px;height:32px;" data-action="delete" data-idx="' + idx + '" title="Remove user" ' + (isSelf ? 'disabled' : '') + '><i class="fa-solid fa-trash" style="font-size:12px;"></i></a>' +
        '</td>' +
      '</tr>'
    );
  }
  function renderUsersTable (searchTerm) {
    const el = document.getElementById('usersTableBody');
    if (!el) return;
    searchTerm = (searchTerm || '').toLowerCase();
    const users = getUsers();
    let rows = users.map((u, i) => ({ u, i }));
    if (searchTerm) rows = rows.filter(r => (r.u.name + ' ' + r.u.email).toLowerCase().indexOf(searchTerm) !== -1);

    el.innerHTML = rows.map(r => buildUserRowHTML(r.u, r.i)).join('') ||
      '<tr><td colspan="5">' + emptyStateHTML('fa-users', 'No registered users yet — accounts appear here once people sign up or sign in.') + '</td></tr>';

    document.querySelectorAll('[data-count-users]').forEach(el2 => { el2.textContent = users.length; });

    el.querySelectorAll('[data-action="role"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const users2 = getUsers();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!users2[idx]) return;
        users2[idx].role = users2[idx].role === 'admin' ? 'user' : 'admin';
        saveUsers(users2);
        toast('Role updated for ' + users2[idx].name, 'fa-user-shield');
        renderUsersTable(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
        renderRecentSignups();
      });
    });
    el.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const users2 = getUsers();
        const target = users2[idx];
        if (!target) return;
        if (!confirm('Remove ' + target.name + ' (' + target.email + ')? This cannot be undone.')) return;
        users2.splice(idx, 1);
        saveUsers(users2);
        toast('User removed', 'fa-trash');
        renderUsersTable(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
        renderRecentSignups();
      });
    });
  }
  function renderRecentSignups () {
    const el = document.getElementById('recentSignupsList');
    if (!el) return;
    const users = getUsers().slice(-5).reverse();
    if (!users.length) { el.innerHTML = emptyStateHTML('fa-user-plus', 'No signups yet.'); return; }
    el.innerHTML = users.map(u => (
      '<div class="order-row" data-reveal>' +
        '<div class="dash-avatar" style="width:38px;height:38px;font-size:13px;">' + initials(u.name) + '</div>' +
        '<div class="order-info"><b>' + u.name + '</b><span>' + u.email + '</span></div>' +
        '<span class="role-pill role-' + u.role + '">' + u.role + '</span>' +
      '</div>'
    )).join('');
    observeReveal(el);
  }

  /* ---------------------------------------------------------
     14. ADMIN ORDERS TABLE (all customers)
     --------------------------------------------------------- */
  const ADMIN_ORDERS = [
    { id: 'MER-10301', customer: 'Priya Nandakumar', product: 'Sparkling Spring Water · 12pk', amount: '$482', status: 'processing' },
    { id: 'MER-10298', customer: 'Daniel Whitfield', product: 'Eau de Parfum Collection', amount: '$1,240', status: 'shipped' },
    { id: 'MER-10287', customer: 'Amara Chen', product: 'Concentrate Laundry Pearls', amount: '$690', status: 'delivered' },
    { id: 'MER-10276', customer: 'Lucas Meier', product: 'Daily Vitamins — Family Pack', amount: '$320', status: 'delivered' },
    { id: 'MER-10259', customer: 'Fatima Rahman', product: 'Skin & Hair Care Duo', amount: '$560', status: 'shipped' },
    { id: 'MER-10241', customer: 'Grace Okafor', product: 'Organic Dairy Bundle', amount: '$275', status: 'processing' },
    { id: 'MER-10230', customer: 'Marco Rossi', product: 'Botanical Tonics Set', amount: '$410', status: 'delivered' },
    { id: 'MER-10219', customer: 'Hana Kobayashi', product: 'Active Supplements Pack', amount: '$395', status: 'shipped' }
  ];
  let currentAdminOrderFilter = 'all';
  function buildAdminOrderRowHTML (o) {
    const s = STATUS_MAP[o.status];
    return (
      '<tr data-search="' + (o.customer + ' ' + o.product + ' ' + o.id).toLowerCase() + '">' +
        '<td><span class="order-sku">' + o.id + '</span></td>' +
        '<td>' + o.customer + '</td>' +
        '<td>' + o.product + '</td>' +
        '<td>' + o.amount + '</td>' +
        '<td><span class="order-status ' + s.cls + '">' + s.label + '</span></td>' +
      '</tr>'
    );
  }
  function renderAdminOrders (searchTerm) {
    const el = document.getElementById('adminOrdersBody');
    if (!el) return;
    searchTerm = (searchTerm || '').toLowerCase();
    let items = ADMIN_ORDERS.slice();
    if (currentAdminOrderFilter !== 'all') items = items.filter(o => o.status === currentAdminOrderFilter);
    if (searchTerm) items = items.filter(o => (o.customer + ' ' + o.product + ' ' + o.id).toLowerCase().indexOf(searchTerm) !== -1);
    el.innerHTML = items.map(buildAdminOrderRowHTML).join('') || '<tr><td colspan="5">' + emptyStateHTML('fa-receipt', 'No orders match this view') + '</td></tr>';
  }
  function wireAdminOrderTabs () {
    const tabs = document.querySelectorAll('#adminOrderTabs button');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentAdminOrderFilter = btn.getAttribute('data-filter');
        renderAdminOrders(document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '');
      });
    });
  }

  /* ---------------------------------------------------------
     15. MINI REVENUE BAR CHART (admin overview)
     --------------------------------------------------------- */
  function renderMiniBars () {
    const el = document.getElementById('miniBars');
    if (!el) return;
    const data = [
      { label: 'Feb', value: 62 }, { label: 'Mar', value: 74 }, { label: 'Apr', value: 68 },
      { label: 'May', value: 81 }, { label: 'Jun', value: 90 }, { label: 'Jul', value: 96 }
    ];
    const max = Math.max.apply(null, data.map(d => d.value));
    el.innerHTML = data.map(d => '<div class="bar" data-h="' + Math.round((d.value / max) * 140) + '"><span>' + d.label + '</span></div>').join('');
    const bars = el.querySelectorAll('.bar');
    const barIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          bars.forEach((bar, i) => {
            setTimeout(() => { bar.style.height = bar.getAttribute('data-h') + 'px'; }, i * 90);
          });
          barIO.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    barIO.observe(el);
  }

  /* ---------------------------------------------------------
     15b. GENERIC data-toast TRIGGERS (decorative quick actions)
     --------------------------------------------------------- */
  document.querySelectorAll('[data-toast]').forEach(el => {
    el.addEventListener('click', () => {
      const parts = el.getAttribute('data-toast').split('|');
      toast(parts[0], parts[1]);
    });
  });

  /* ---------------------------------------------------------
     16. TOGGLE SWITCHES (settings)
     --------------------------------------------------------- */
  document.querySelectorAll('.toggle-switch').forEach(t => {
    t.addEventListener('click', () => {
      t.classList.toggle('is-on');
      toast(t.classList.contains('is-on') ? 'Preference enabled' : 'Preference disabled', 'fa-sliders');
    });
  });

  /* ---------------------------------------------------------
     17. TOPBAR SEARCH — routes to whichever section is active
     --------------------------------------------------------- */
  function runSearchFilter (term) {
    const active = document.querySelector('.dash-section.is-active');
    if (!active) return;
    const id = active.getAttribute('data-section');
    if (id === 'messages') renderFullEmails(term);
    else if (id === 'orders' && pageRole === 'user') renderOrders(term);
    else if (id === 'orders' && pageRole === 'admin') renderAdminOrders(term);
    else if (id === 'users') renderUsersTable(term);
  }
  const searchInput = document.getElementById('dashSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => runSearchFilter(searchInput.value));
  }

  /* ---------------------------------------------------------
     18. INIT — build every dynamic module that exists on this page
     --------------------------------------------------------- */
  renderEmailPreview();
  wireEmailTabs();
  renderFullEmails('');
  updateUnreadBadges();

  if (pageRole === 'user') {
    renderOrderPreview();
    wireOrderTabs();
    renderOrders('');
    renderShipments();
  }
  if (pageRole === 'admin') {
    renderUsersTable('');
    renderRecentSignups();
    wireAdminOrderTabs();
    renderAdminOrders('');
    renderMiniBars();

    const totalUsersEl = document.getElementById('statTotalUsers');
    if (totalUsersEl) totalUsersEl.setAttribute('data-count', String(getUsers().length));
  }

  document.querySelectorAll('.product-media img, .order-thumb').forEach(attachImgFallback);

  initCounters();

})();