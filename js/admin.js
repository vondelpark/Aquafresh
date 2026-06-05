/* ===== Admin Panel Logic ===== */

/* --- Credentials (hardcoded for static site) --- */
var ADMIN_EMAIL = 'admin@aquafreshboats.nl';
var ADMIN_PASS = 'admin 123';

/* --- Default pricing (matches app.js TIERS and lib/pricing.js) --- */
var DEFAULT_PRICING = {
  basic: 1.50,
  extra: 2.00,
  heavy: 2.50
};

var DEFAULT_CONTACT = {
  email: 'aquafreshboats@gmail.com',
  phone: '+31 6 1951 1991',
  whatsapp: '31619511991',
  location: 'Amsterdam, Nederland'
};

/* ===== Authentication ===== */
function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-password').value;
  var errorEl = document.getElementById('login-error');

  if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
    sessionStorage.setItem('aquafresh-admin', '1');
    showDashboard();
    errorEl.textContent = '';
  } else {
    errorEl.textContent = 'Invalid email or password.';
  }
}

function handleLogout() {
  sessionStorage.removeItem('aquafresh-admin');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadPricing();
  loadContact();
  loadCalendar();
}

/* Auto-login if session active */
(function () {
  if (sessionStorage.getItem('aquafresh-admin') === '1') {
    showDashboard();
  }
})();

/* ===== Panel Navigation ===== */
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(function (p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-link').forEach(function (l) {
    l.classList.remove('active');
  });
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  var link = document.querySelector('.sidebar-link[data-panel="' + name + '"]');
  if (link) link.classList.add('active');
}

/* ===== Flash save status ===== */
function flashStatus(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || 'Saved!';
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 2500);
}

/* ===== Pricing ===== */
function loadPricing() {
  // Load from localStorage immediately so fields are never empty
  var saved = localStorage.getItem('aquafresh-pricing');
  var local = saved ? JSON.parse(saved) : DEFAULT_PRICING;
  document.getElementById('rate-basic').value = local.basic;
  document.getElementById('rate-extra').value = local.extra;
  document.getElementById('rate-heavy').value = local.heavy;

  // Then try to sync from API (Redis) if available
  fetch('/api/pricing')
    .then(function (res) {
      if (!res.ok) throw new Error('API error');
      return res.json();
    })
    .then(function (data) {
      if (data.basic) {
        document.getElementById('rate-basic').value = data.basic;
        document.getElementById('rate-extra').value = data.extra;
        document.getElementById('rate-heavy').value = data.heavy;
        localStorage.setItem('aquafresh-pricing', JSON.stringify(data));
      }
    })
    .catch(function () { /* use localStorage values already loaded */ });
}

function savePricing() {
  var data = {
    basic: parseFloat(document.getElementById('rate-basic').value) || 0,
    extra: parseFloat(document.getElementById('rate-extra').value) || 0,
    heavy: parseFloat(document.getElementById('rate-heavy').value) || 0
  };

  // Always save to localStorage immediately (website reads this)
  localStorage.setItem('aquafresh-pricing', JSON.stringify(data));

  // Also save to API (Redis) so the WhatsApp bot picks it up
  fetch('/api/pricing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_PASS
    },
    body: JSON.stringify(data)
  })
  .then(function (res) { return res.json(); })
  .then(function (result) {
    if (result.status === 'saved') {
      flashStatus('pricing-status', 'Pricing saved!');
    } else {
      flashStatus('pricing-status', 'Saved locally. Server sync will work once Redis is configured.');
    }
  })
  .catch(function () {
    flashStatus('pricing-status', 'Saved locally. Server sync will work once Redis is configured.');
  });
}

function resetPricing() {
  var data = DEFAULT_PRICING;
  // Reset on server
  fetch('/api/pricing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_PASS
    },
    body: JSON.stringify(data)
  }).catch(function () {});

  localStorage.setItem('aquafresh-pricing', JSON.stringify(data));
  document.getElementById('rate-basic').value = data.basic;
  document.getElementById('rate-extra').value = data.extra;
  document.getElementById('rate-heavy').value = data.heavy;
  flashStatus('pricing-status', 'Reset to defaults.');
}

/* ===== Contact ===== */
function loadContact() {
  var saved = localStorage.getItem('aquafresh-contact');
  var data = saved ? JSON.parse(saved) : DEFAULT_CONTACT;

  document.getElementById('contact-email').value = data.email || '';
  document.getElementById('contact-phone').value = data.phone || '';
  document.getElementById('contact-whatsapp').value = data.whatsapp || '';
  document.getElementById('contact-location').value = data.location || '';
}

function saveContact() {
  var data = {
    email: document.getElementById('contact-email').value.trim(),
    phone: document.getElementById('contact-phone').value.trim(),
    whatsapp: document.getElementById('contact-whatsapp').value.trim(),
    location: document.getElementById('contact-location').value.trim()
  };
  localStorage.setItem('aquafresh-contact', JSON.stringify(data));
  flashStatus('contact-status', 'Contact info saved!');
}

/* ===== Calendar ===== */
function loadCalendar() {
  var saved = localStorage.getItem('aquafresh-calendar');
  var data = saved ? JSON.parse(saved) : {};

  document.getElementById('calendar-id').value = data.calendarId || '';
  document.getElementById('calendar-api-key').value = data.apiKey || '';
  document.getElementById('calendar-enabled').checked = !!data.enabled;
}

function saveCalendar() {
  var data = {
    calendarId: document.getElementById('calendar-id').value.trim(),
    apiKey: document.getElementById('calendar-api-key').value.trim(),
    enabled: document.getElementById('calendar-enabled').checked
  };
  localStorage.setItem('aquafresh-calendar', JSON.stringify(data));
  flashStatus('calendar-status', 'Calendar settings saved!');
}

function previewCalendar() {
  var calId = document.getElementById('calendar-id').value.trim();
  var container = document.getElementById('calendar-preview-container');
  var preview = document.getElementById('calendar-preview');

  if (!calId) {
    container.style.display = 'none';
    preview.innerHTML = '';
    return;
  }

  var src = 'https://calendar.google.com/calendar/embed?src='
    + encodeURIComponent(calId)
    + '&ctz=Europe%2FAmsterdam&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0';

  preview.innerHTML = '<iframe src="' + src + '" title="Google Calendar" loading="lazy"></iframe>';
  container.style.display = 'block';
}
