/* ===== Language Toggle ===== */
function setLang(lang) {
  if (lang === 'nl') {
    document.body.classList.add('nl');
  } else {
    document.body.classList.remove('nl');
  }
  localStorage.setItem('aquafresh-lang', lang);
  updateEstimate();
}

function toggleLang() {
  var isNl = document.body.classList.contains('nl');
  setLang(isNl ? 'en' : 'nl');
}

/* Restore saved language */
(function () {
  var saved = localStorage.getItem('aquafresh-lang');
  if (saved === 'nl') document.body.classList.add('nl');
})();

/* ===== Mobile Nav ===== */
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
var RATES = {
  // per m2 base rates
  exterior: 8,
  interior: 10,
  full: 15,

  // surcharges (flat euro amounts)
  closed: 30,     // closed cabin surcharge
  canvas: 25,     // canvas cleaning
  teak: 40,       // teak / wood treatment
  metal: 35,      // metal polishing

  // minimum prices
  minExterior: 75,
  minInterior: 75,
  minFull: 125
};

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

  // Replace PHONE_NUMBER with the actual WhatsApp Business number
  var waNumber = '31612345678'; // TODO: Replace with actual number
  var url = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}
