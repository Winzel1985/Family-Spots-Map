/* Family Spot’s Map — app.js */
let map, osm, esri, cluster, markers = [];
let data = [];

init();

async function init(){
  document.getElementById('year').textContent = new Date().getFullYear();

  // Karte
  map = L.map('map', {zoomControl:true}).setView([51.16, 10.45], 6);
  osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  // Satellit (Esri World Imagery)
  esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics'
  });

  // MarkerCluster oder LayerGroup
  cluster = L.markerClusterGroup ? L.markerClusterGroup({showCoverageOnHover:false, maxClusterRadius:50}) : L.layerGroup();
  map.addLayer(cluster);

  await loadData();          // lädt spots.json (oder Fallback)
  buildCategoryFilter();     // Dropdown befüllen
  renderMarkers(data);       // Marker setzen
  bindUI();                  // Buttons & Suche aktivieren
}

async function loadData(){
  try {
    const res = await fetch('spots.json?v=' + Date.now());
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const arr = await res.json();
    if(!Array.isArray(arr)) throw new Error('spots.json ist kein Array.');
    data = arr;
  } catch (e) {
    console.warn('spots.json konnte nicht geladen werden – Fallback benutzt.', e);
    data = DEFAULT_SPOTS; // minimaler Fallback, damit die Seite startet
  }
}

/* ------- Rendering ------- */

function renderMarkers(arr){
  cluster.clearLayers();
  markers = [];
  arr.forEach((spot) => {
    if(!validSpot(spot)) return;
    const m = L.marker([spot.lat, spot.lon], {title: spot.name});
    m.bindPopup(popupHtml(spot), {minWidth: 260});
    cluster.addLayer(m);
    markers.push(m);
  });
  if(arr.length){
    const b = L.latLngBounds(arr.filter(validSpot).map(s => [s.lat, s.lon]));
    try{ map.fitBounds(b, {padding:[30,30]}); }catch{}
  }
  updateQA(arr);
}

function validSpot(s){
  return s && typeof s.lat === 'number' && typeof s.lon === 'number'
         && !isNaN(s.lat) && !isNaN(s.lon);
}

function popupHtml(s){
  const usp = (s.usp || []).map(u => `<span class="chip">${escapeHtml(u)}</span>`).join(' ');
  const gmaps = `https://www.google.com/maps?q=${s.lat},${s.lon}`;
  const amap  = `https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name||'Ziel')}`;
  const cat   = s.category ? `<span class="chip">${escapeHtml(s.category)}</span>` : '';
  return `
    <div class="popup">
      <h3>${escapeHtml(s.name || 'Ohne Titel')}</h3>
      <div class="meta">${escapeHtml(s.city || '')}${s.country ? ' · ' + escapeHtml(s.country) : ''}</div>
      <div class="chips">${cat} ${usp}</div>
      ${s.poetry ? `<p class="poetry">„${escapeHtml(s.poetry)}”</p>` : ''}
      <div class="actions">
        <a class="btn-cta" href="${gmaps}" target="_blank" rel="noopener">📍 Google</a>
        <a class="btn-cta" href="${amap}"  target="_blank" rel="noopener">🍎 Apple</a>
      </div>
    </div>`;
}

/* ------- UI ------- */

function buildCategoryFilter(){
  const sel = document.getElementById('categoryFilter');
  const cats = Array.from(new Set(data.map(s => s.category).filter(Boolean))).sort();
  sel.innerHTML = `<option value="">Alle Kategorien</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function bindUI(){
  // Import
  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arr = JSON.parse(evt.target.result);
        if(!Array.isArray(arr)) throw new Error('JSON muss ein Array sein.');
        data = arr;
        buildCategoryFilter();
        renderMarkers(data);
      } catch(err) {
        alert('Ungültiges JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  // Export
  document.getElementById('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spots_export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });

  // Suche & Filter
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  document.getElementById('btnReset').addEventListener('click', () => {
    searchInput.value = ''; categoryFilter.value = '';
    renderMarkers(data);
  });

  function applyFilter(){
    const q = searchInput.value.trim().toLowerCase();
    const cat = categoryFilter.value;
    const filtered = data.filter(s => {
      if(cat && s.category !== cat) return false;
      if(!q) return true;
      const hay = [s.name, s.city, s.category, (s.usp||[]).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
    renderMarkers(filtered);
  }
  searchInput.addEventListener('input', applyFilter);
  categoryFilter.addEventListener('change', applyFilter);

  // Satellit
  let satelliteOn = false;
  const btnSat = document.getElementById('btnSatellite');
  btnSat.addEventListener('click', () => {
    satelliteOn = !satelliteOn;
    if(satelliteOn){ map.removeLayer(osm); esri.addTo(map); }
    else { map.removeLayer(esri); osm.addTo(map); }
    btnSat.classList.toggle('active', satelliteOn);
  });

  // Review Panel
  const panel = document.getElementById('reviewPanel');
  document.getElementById('btnReview').addEventListener('click', () => panel.classList.toggle('hidden'));
  document.getElementById('btnCloseReview').addEventListener('click', () => panel.classList.add('hidden'));
  document.getElementById('btnShowAll').addEventListener('click', () => renderList(data));
  document.getElementById('btnShowNoImg').addEventListener('click', () => renderList(data.filter(s => !s.img)));
  document.getElementById('btnShowWithImg').addEventListener('click', () => renderList(data.filter(s => s.img)));
  renderList(data);
}

/* ------- Review & QA ------- */

function renderList(arr){
  const box = document.getElementById('listContainer');
  box.innerHTML = '';
  arr.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="card-title">${escapeHtml(s.name || 'Ohne Titel')}</div>
      <div class="card-sub">${escapeHtml(s.city || '')}${s.country ? ' · ' + escapeHtml(s.country) : ''} — ${escapeHtml(s.category || '')}</div>
      ${s.poetry ? `<div class="poetry">„${escapeHtml(s.poetry)}”</div>` : ''}
      <div class="card-actions">
        <button class="btn small" data-action="focus">Auf Karte</button>
      </div>
    `;
    el.querySelector('[data-action="focus"]').addEventListener('click', () => {
      if(validSpot(s)){ map.setView([s.lat, s.lon], 13); }
    });
    box.appendChild(el);
  });
  updateQA(arr);
}

function updateQA(arr){
  const total = arr.length;
  const warn = arr.filter(s => !s.poetry || !s.usp || s.usp.length === 0).length;
  const err  = arr.filter(s => !validSpot(s)).length;
  const ok   = Math.max(0, total - warn - err);
  setText('#qaTotal', total);
  setText('#qaOk', ok);
  setText('#qaWarn', warn);
  setText('#qaErr', err);
}

/* ------- Helpers ------- */
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}
function setText(sel,val){ const el = document.querySelector(sel); if(el) el.textContent = val; }

/* ------- Fallback-Daten, falls spots.json fehlt ------- */
const DEFAULT_SPOTS = [
{"id":"demo_rheinpark_koeln","category":"playground_adventure","city":"Köln","country":"DE","name":"Rheinpark Köln (Demo)","lat":50.948,"lon":6.983,"poetry":"Zwischen Luft und Lachen wächst jedes Abenteuer Flügel.","verified":true},
{"id":"demo_tiger_turtle_duisburg","category":"family_attraction","city":"Duisburg","country":"DE","name":"Tiger & Turtle (Demo)","lat":51.394,"lon":6.794,"poetry":"Achterbahn zu Fuß – Mut im Kreis, Staunen im Herzen.","verified":true}
];
