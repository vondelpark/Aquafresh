/* ===== Aquafresh — Cleaner Job Page ===== */

var params = new URLSearchParams(window.location.search);
var JOB_ID = params.get('id');
var JOB_KEY = params.get('k');
var compressedPhoto = null;

function $(id) { return document.getElementById(id); }

/* ---- Load job details ---- */
(function loadJob() {
  if (!JOB_ID || !JOB_KEY) return showError();

  fetch('/api/job?id=' + encodeURIComponent(JOB_ID) + '&k=' + encodeURIComponent(JOB_KEY))
    .then(function (res) {
      if (!res.ok) throw new Error('not found');
      return res.json();
    })
    .then(render)
    .catch(showError);
})();

function showError() {
  $('loading').style.display = 'none';
  $('error').style.display = 'block';
}

function render(job) {
  $('loading').style.display = 'none';
  $('content').style.display = 'block';

  $('j-id').textContent = job.booking_id;
  $('j-date').textContent = job.preferred_date;
  $('j-time').textContent = job.preferred_time;
  $('j-tier').textContent = job.service_tier;
  $('j-price').textContent = '€' + job.quoted_amount_eur;
  $('j-name').textContent = job.customer_name;
  $('j-phone').textContent = job.phone_number;
  $('j-phone').href = 'tel:+' + String(job.phone_number).replace(/^\+/, '');
  $('j-boat').textContent = job.boat_length_m + 'm × ' + job.boat_width_m + 'm (' + job.estimated_area_m2 + ' m²)';
  $('j-location').textContent = job.boat_location;

  // Status badge
  var statusEl = $('j-status');
  if (job.booking_status === 'Completed') {
    statusEl.textContent = 'Voltooid';
    statusEl.className = 'status done';
    $('done-banner').style.display = 'block';
    $('complete-card').style.display = 'none';
  } else if (job.payment_status === 'Paid') {
    statusEl.textContent = 'Betaald';
    statusEl.className = 'status paid';
  } else {
    statusEl.textContent = 'Wacht op betaling';
    statusEl.className = 'status pending';
  }

  // Maps link
  if (job.boat_latitude && job.boat_longitude) {
    $('j-map').href = 'https://maps.google.com/?q=' + job.boat_latitude + ',' + job.boat_longitude;
    $('j-map').style.display = 'block';
  } else if (job.boat_location) {
    $('j-map').href = 'https://maps.google.com/?q=' + encodeURIComponent(job.boat_location);
    $('j-map').style.display = 'block';
  }

  // Customer notes
  if (job.notes) {
    $('j-notes').textContent = job.notes;
    $('notes-card').style.display = 'block';
  }

  // Boat photo
  if (job.has_photo) {
    $('j-photo').src = '/api/media?id=' + encodeURIComponent(JOB_ID) + '&k=' + encodeURIComponent(JOB_KEY);
    $('photo-card').style.display = 'block';
  }
}

/* ---- After-photo: compress client-side ---- */
$('after-photo').addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) { compressedPhoto = null; $('preview').style.display = 'none'; return; }

  var img = new Image();
  var reader = new FileReader();
  reader.onload = function (ev) { img.src = ev.target.result; };
  img.onload = function () {
    var maxDim = 1000;
    var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    compressedPhoto = canvas.toDataURL('image/jpeg', 0.65);
    $('preview').src = compressedPhoto;
    $('preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
});

/* ---- Mark complete ---- */
function completeJob() {
  var btn = $('btn-complete');
  btn.disabled = true;
  btn.textContent = 'Versturen…';

  fetch('/api/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: JOB_ID,
      k: JOB_KEY,
      comments: $('comments').value.trim(),
      photo: compressedPhoto
    })
  })
  .then(function (res) { return res.json(); })
  .then(function (data) {
    if (data.status === 'completed' || data.status === 'already_completed') {
      $('done-banner').style.display = 'block';
      $('complete-card').style.display = 'none';
      $('j-status').textContent = 'Voltooid';
      $('j-status').className = 'status done';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('Er ging iets mis. Probeer opnieuw.');
      btn.disabled = false;
      btn.textContent = '✅ Markeer als voltooid';
    }
  })
  .catch(function () {
    alert('Verbinding mislukt. Probeer opnieuw.');
    btn.disabled = false;
    btn.textContent = '✅ Markeer als voltooid';
  });
}
