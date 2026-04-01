/* ===== Language Toggle ===== */
function setLang(lang) {
  if (lang === 'nl') {
    document.body.classList.add('nl');
    document.documentElement.lang = 'nl';
  } else {
    document.body.classList.remove('nl');
    document.documentElement.lang = 'en';
  }
  localStorage.setItem('aquafresh-lang', lang);
  updateEstimate();
}

function toggleLang() {
  var isNl = document.body.classList.contains('nl');
  setLang(isNl ? 'en' : 'nl');
}

/* Restore saved language — default is Dutch */
(function () {
  var saved = localStorage.getItem('aquafresh-lang');
  if (saved === 'en') {
    document.body.classList.remove('nl');
    document.documentElement.lang = 'en';
  } else {
    document.body.classList.add('nl');
    document.documentElement.lang = 'nl';
  }
})();

/* ===== Scroll Reveal ===== */
document.addEventListener('DOMContentLoaded', function () {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
});
function toggleNav() {
  document.querySelector('.nav-links').classList.toggle('open');
}

/* ===== FAQ Accordion ===== */
document.addEventListener('click', function (e) {
  var q = e.target.closest('.faq-q');
  if (!q) return;
  var item = q.parentElement;
  var wasOpen = item.classList.contains('open');
  // close all
  document.querySelectorAll('.faq-item.open').forEach(function (el) {
    el.classList.remove('open');
  });
  if (!wasOpen) item.classList.add('open');
});

/* ===== Pricing Logic ===== */
/* Defaults — overridden by admin panel via localStorage */
var DEFAULT_RATES = {
  exterior: 8, interior: 10, full: 15,
  closed: 30, canvas: 25, teak: 40, metal: 35,
  minExterior: 75, minInterior: 75, minFull: 125
};

function loadRates() {
  try {
    var saved = localStorage.getItem('aquafresh-pricing');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return DEFAULT_RATES;
}
var RATES = loadRates();

/* ===== Contact Info (admin-configurable) ===== */
function loadContact() {
  try {
    var saved = localStorage.getItem('aquafresh-contact');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return null;
}

/* Apply admin-configured contact info to the page */
(function applyContactInfo() {
  var c = loadContact();
  if (!c) return;

  /* Update WhatsApp links */
  if (c.whatsapp) {
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      a.href = 'https://wa.me/' + c.whatsapp;
    });
  }
  /* Update email links */
  if (c.email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.href = 'mailto:' + c.email;
      a.textContent = c.email;
    });
  }
  /* Update phone links */
  if (c.phone) {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.href = 'tel:' + c.phone.replace(/\s/g, '');
      a.textContent = c.phone;
    });
  }
})();

/* ===== Google Calendar Availability ===== */
(function applyCalendar() {
  try {
    var saved = localStorage.getItem('aquafresh-calendar');
    if (!saved) return;
    var cal = JSON.parse(saved);
    if (!cal.enabled || !cal.calendarId) return;

    /* Inject calendar embed into booking section */
    var bookingForm = document.querySelector('.booking-form');
    if (!bookingForm) return;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:28px;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:14px 20px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;font-weight:600;font-size:.9rem;color:#334155;';
    header.innerHTML = '<span class="lang-nl">Beschikbaarheid</span><span class="lang-en">Availability</span>';

    var iframe = document.createElement('iframe');
    iframe.src = 'https://calendar.google.com/calendar/embed?src='
      + encodeURIComponent(cal.calendarId)
      + '&ctz=Europe%2FAmsterdam&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0';
    iframe.style.cssText = 'width:100%;height:350px;border:none;display:block;';
    iframe.loading = 'lazy';
    iframe.title = 'Availability Calendar';

    wrapper.appendChild(header);
    wrapper.appendChild(iframe);
    bookingForm.insertBefore(wrapper, bookingForm.firstChild);
  } catch (e) { /* ignore */ }
})();

function updateEstimate() {
  var length = parseFloat(document.getElementById('boat-length').value) || 0;
  var width = parseFloat(document.getElementById('boat-width').value) || 0;
  var service = document.getElementById('service-type').value;
  var boatType = document.getElementById('boat-type').value;
  var canvas = document.getElementById('canvas').value;
  var material = document.getElementById('material').value;

  var area = length * width;
  var breakdown = [];
  var isNl = document.body.classList.contains('nl');

  if (area <= 0 || !service) {
    document.getElementById('estimate-price').textContent = '--';
    document.getElementById('estimate-breakdown').innerHTML = '';
    return;
  }

  // base rate
  var rateKey = service;
  var rate = RATES[rateKey] || RATES.exterior;
  var base = area * rate;
  var minKey = 'min' + service.charAt(0).toUpperCase() + service.slice(1);
  var minPrice = RATES[minKey] || 75;
  if (base < minPrice) base = minPrice;

  breakdown.push({
    label: isNl
      ? 'Basis (' + area.toFixed(1) + ' m\u00B2 \u00D7 \u20AC' + rate + ')'
      : 'Base (' + area.toFixed(1) + ' m\u00B2 \u00D7 \u20AC' + rate + ')',
    value: base
  });

  var total = base;

  // surcharges
  if (boatType === 'closed') {
    total += RATES.closed;
    breakdown.push({
      label: isNl ? 'Gesloten boot toeslag' : 'Closed cabin surcharge',
      value: RATES.closed
    });
  }
  if (canvas === 'yes') {
    total += RATES.canvas;
    breakdown.push({
      label: isNl ? 'Canvas reiniging' : 'Canvas cleaning',
      value: RATES.canvas
    });
  }
  if (material === 'teak') {
    total += RATES.teak;
    breakdown.push({
      label: isNl ? 'Teak / hout behandeling' : 'Teak / wood treatment',
      value: RATES.teak
    });
  }
  if (material === 'metal') {
    total += RATES.metal;
    breakdown.push({
      label: isNl ? 'Metaal polijsten' : 'Metal polishing',
      value: RATES.metal
    });
  }

  // total line
  breakdown.push({
    label: isNl ? 'Geschatte prijs' : 'Estimated price',
    value: total
  });

  document.getElementById('estimate-price').textContent = '\u20AC' + total.toFixed(0);

  var html = '';
  for (var i = 0; i < breakdown.length; i++) {
    html += '<div class="line"><span>' + breakdown[i].label + '</span><span>\u20AC' + breakdown[i].value.toFixed(0) + '</span></div>';
  }
  document.getElementById('estimate-breakdown').innerHTML = html;
}

/* Bind change events */
document.addEventListener('DOMContentLoaded', function () {
  var ids = ['boat-length', 'boat-width', 'service-type', 'boat-type', 'canvas', 'material'];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateEstimate);
      el.addEventListener('change', updateEstimate);
    }
  });
});

/* ===== Form Submission -> WhatsApp ===== */
function submitBooking(e) {
  e.preventDefault();

  var name = document.getElementById('customer-name').value.trim();
  var phone = document.getElementById('customer-phone').value.trim();
  var boatName = document.getElementById('boat-name').value.trim();
  var location = document.getElementById('boat-location').value.trim();
  var date = document.getElementById('preferred-date').value;
  var time = document.getElementById('preferred-time').value;
  var length = document.getElementById('boat-length').value;
  var width = document.getElementById('boat-width').value;
  var service = document.getElementById('service-type').value;
  var boatType = document.getElementById('boat-type').value;
  var canvas = document.getElementById('canvas').value;
  var material = document.getElementById('material').value;
  var notes = document.getElementById('notes').value.trim();
  var estimate = document.getElementById('estimate-price').textContent;

  var isNl = document.body.classList.contains('nl');

  // Validation
  if (!name || !phone || !length || !width || !service) {
    alert(isNl
      ? 'Vul alsjeblieft alle verplichte velden in.'
      : 'Please fill in all required fields.');
    return;
  }

  // Build WhatsApp message
  var msg;
  if (isNl) {
    msg = '*Nieuwe boeking - Aquafresh*\n\n'
      + 'Naam: ' + name + '\n'
      + 'Telefoon: ' + phone + '\n'
      + 'Boot: ' + boatName + '\n'
      + 'Locatie: ' + location + '\n'
      + 'Datum: ' + date + ' ' + time + '\n'
      + 'Lengte: ' + length + 'm\n'
      + 'Breedte: ' + width + 'm\n'
      + 'Service: ' + service + '\n'
      + 'Type: ' + boatType + '\n'
      + 'Canvas: ' + canvas + '\n'
      + 'Materiaal: ' + material + '\n'
      + 'Geschatte prijs: ' + estimate + '\n'
      + 'Opmerkingen: ' + (notes || '-') + '\n\n'
      + 'Stuur alsjeblieft een foto van de boot en een locatie-pin in het gesprek.';
  } else {
    msg = '*New Booking - Aquafresh*\n\n'
      + 'Name: ' + name + '\n'
      + 'Phone: ' + phone + '\n'
      + 'Boat: ' + boatName + '\n'
      + 'Location: ' + location + '\n'
      + 'Date: ' + date + ' ' + time + '\n'
      + 'Length: ' + length + 'm\n'
      + 'Width: ' + width + 'm\n'
      + 'Service: ' + service + '\n'
      + 'Type: ' + boatType + '\n'
      + 'Canvas: ' + canvas + '\n'
      + 'Material: ' + material + '\n'
      + 'Estimated price: ' + estimate + '\n'
      + 'Notes: ' + (notes || '-') + '\n\n'
      + 'Please also send a photo of the boat and a location pin in the chat.';
  }

  var contact = loadContact();
  var waNumber = (contact && contact.whatsapp) ? contact.whatsapp : '31612345678';
  var url = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

/* ===== Sync Pricing Display ===== */
(function syncPricingDisplay() {
  var r = loadRates();
  /* Update pricing rows — find by label text and update the sibling value */
  var rows = document.querySelectorAll('.pricing-row');
  var map = {
    'Exterieur Reiniging': r.exterior, 'Exterior Cleaning': r.exterior,
    'Interieur Reiniging': r.interior, 'Interior Cleaning': r.interior,
    'Complete Reiniging': r.full, 'Full Clean': r.full,
    'Gesloten kajuitboot': r.closed, 'Closed cabin boat': r.closed,
    'Canvas reiniging': r.canvas, 'Canvas cleaning': r.canvas,
    'Teak / hout behandeling': r.teak, 'Teak / wood treatment': r.teak,
    'Metaal polijsten': r.metal, 'Metal polishing': r.metal
  };
  rows.forEach(function (row) {
    var label = row.querySelector('.pr-label');
    var value = row.querySelector('.pr-value');
    if (!label || !value) return;
    var text = label.textContent.trim();
    if (map[text] !== undefined) {
      var v = map[text];
      /* Rates (per m2) vs surcharges (flat) */
      if (text.indexOf('Reiniging') !== -1 || text.indexOf('Cleaning') !== -1 || text.indexOf('Clean') !== -1) {
        value.innerHTML = '&euro;' + v + ' / m&sup2;';
      } else {
        value.innerHTML = '+ &euro;' + v;
      }
    }
  });
})();

/* ===== Water Canvas Animation ===== */
(function () {
  var canvas = document.getElementById('water-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w, h, t = 0;
  var bubbles = [];

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
  }

  // Create bubbles
  function initBubbles() {
    bubbles = [];
    for (var i = 0; i < 20; i++) {
      bubbles.push({
        x: Math.random() * w,
        y: h + Math.random() * h,
        r: 2 + Math.random() * 6,
        speed: 0.3 + Math.random() * 0.8,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
        opacity: 0.15 + Math.random() * 0.3
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    t += 0.008;

    // Draw multiple wave layers
    drawWave(h * 0.35, 0.6, 80, 'rgba(21,101,192,0.12)', t);
    drawWave(h * 0.45, 0.8, 60, 'rgba(13,71,161,0.10)', t * 1.2 + 1);
    drawWave(h * 0.55, 1.0, 50, 'rgba(21,101,192,0.08)', t * 0.7 + 2);
    drawWave(h * 0.65, 0.5, 40, 'rgba(100,181,246,0.06)', t * 1.5 + 3);
    drawWave(h * 0.75, 0.9, 35, 'rgba(144,202,249,0.05)', t * 0.9 + 4);

    // Draw caustic light spots
    drawCaustics();

    // Draw bubbles
    drawBubbles();

    requestAnimationFrame(draw);
  }

  function drawWave(baseY, speed, amplitude, color, offset) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var x = 0; x <= w; x += 4) {
      var y = baseY
        + Math.sin(x * 0.003 + offset * speed) * amplitude * 0.5
        + Math.sin(x * 0.006 + offset * speed * 1.3) * amplitude * 0.3
        + Math.cos(x * 0.001 + offset * speed * 0.5) * amplitude * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawCaustics() {
    for (var i = 0; i < 8; i++) {
      var cx = (Math.sin(t * 0.5 + i * 1.7) * 0.5 + 0.5) * w;
      var cy = (Math.cos(t * 0.3 + i * 2.1) * 0.5 + 0.5) * h;
      var r = 40 + Math.sin(t + i) * 20;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(100,181,246,0.06)');
      grad.addColorStop(1, 'rgba(100,181,246,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawBubbles() {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      var bx = b.x + Math.sin(b.wobble) * 15;

      // Reset when off screen
      if (b.y < -b.r * 2) {
        b.y = h + b.r * 2;
        b.x = Math.random() * w;
      }

      // Draw bubble
      var fadeIn = Math.min(1, (h - b.y) / (h * 0.2));
      var fadeOut = Math.min(1, b.y / (h * 0.15));
      var alpha = b.opacity * fadeIn * fadeOut;

      ctx.beginPath();
      ctx.arc(bx, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Highlight
      ctx.beginPath();
      ctx.arc(bx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.6) + ')';
      ctx.fill();
    }
  }

  window.addEventListener('resize', function () { resize(); initBubbles(); });
  resize();
  initBubbles();
  draw();
})();
