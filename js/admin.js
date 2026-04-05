/* ===== Admin Panel Logic ===== */

/* --- Credentials (hardcoded for static site) --- */
var ADMIN_EMAIL = 'admin@aquafreshboats.nl';
var ADMIN_PASS = 'admin 123';

/* --- Default pricing (matches app.js RATES) --- */
var DEFAULT_PRICING = {
  exterior: 8,
  interior: 10,
  full: 15,
  closed: 30,
  canvas: 25,
  teak: 40,
  metal: 35,
  minExterior: 75,
  minInterior: 75,
  minFull: 125
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
  var saved = localStorage.getItem('aquafresh-pricing');
  var data = saved ? JSON.parse(saved) : DEFAULT_PRICING;

  document.getElementById('rate-exterior').value = data.exterior;
  document.getElementById('rate-interior').value = data.interior;
  document.getElementById('rate-full').value = data.full;
  document.getElementById('surcharge-closed').value = data.closed;
  document.getElementById('surcharge-canvas').value = data.canvas;
  document.getElementById('surcharge-teak').value = data.teak;
  document.getElementById('surcharge-metal').value = data.metal;
  document.getElementById('min-exterior').value = data.minExterior;
  document.getElementById('min-interior').value = data.minInterior;
  document.getElementById('min-full').value = data.minFull;
}

function savePricing() {
  var data = {
    exterior: parseFloat(document.getElementById('rate-exterior').value) || 0,
    interior: parseFloat(document.getElementById('rate-interior').value) || 0,
    full: parseFloat(document.getElementById('rate-full').value) || 0,
    closed: parseFloat(document.getElementById('surcharge-closed').value) || 0,
    canvas: parseFloat(document.getElementById('surcharge-canvas').value) || 0,
    teak: parseFloat(document.getElementById('surcharge-teak').value) || 0,
    metal: parseFloat(document.getElementById('surcharge-metal').value) || 0,
    minExterior: parseFloat(document.getElementById('min-exterior').value) || 0,
    minInterior: parseFloat(document.getElementById('min-interior').value) || 0,
    minFull: parseFloat(document.getElementById('min-full').value) || 0
  };
  localStorage.setItem('aquafresh-pricing', JSON.stringify(data));
  flashStatus('pricing-status', 'Pricing saved!');
}

function resetPricing() {
  localStorage.removeItem('aquafresh-pricing');
  loadPricing();
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
