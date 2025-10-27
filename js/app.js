// Family Spot's Map – app.js (v1.2 multi-source)
let map, markersLayer, osmLayer, esriLayer;
const markerById = new Map();
window.ALL_SPOTS = [];
window.ORIGINAL_SPOTS = [];
window.activeBadges = window.activeBadges || new Set();
let imgFilter = 'all';

function initMap() {
map = L.map('map', { preferCanvas: true }).setView([54.5, 9.3], 6);
osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
maxZoom: 19, attribution: 'Esri'
});
markersLayer = L.layerGroup().addTo(map);
}

function getLatLng(s){
if (s && s.geo && typeof s.geo.lat==='number' && typeof s.geo.lng==='number') return [s.geo.lat, s.geo.lng];
if (typeof s.lat==='number' && typeof s.lng==='number') return [s.lat, s.lng];
if (typeof s.lat==='number' && typeof s.lon==='number') return [s.lat, s.lon];
return null;
}

function spotBadgesHTML(spot){
const keys = spot.badges || FSM.getBadges(spot);
return `<div class="badges">${
keys.map(k => `<span class="badge" title="${k}" data-k="${k}">${k}</span>`).join('')
}</div>`;
}

function cardHTML(s){
const meta = `Safety ${s.SafetyScore ?? '-'} · Sanity ${s.SanityScore ?? '-'} · ${s.ResetScore ? 'Reset '+s.ResetScore : ''}`;
return `
<h3>${s.name || 'Spot'}</h3>
<div class="meta">${meta}</div>
${spotBadgesHTML(s)}
`;
}

// farbige Marker nach ResetScore
function markerForSpot(s){
const ll = getLatLng(s);
const r = (s.ResetScore || FSM.resetScore(s));
const color = r === 'ALL' ? '#2ecc71' // grün
: r === '90' ? '#f39c12' // orange
: r === '30' ? '#f1c40f' // gelb
: '#3498db'; // blau (kein Reset)
return L.circleMarker(ll, {
radius: 8, weight: 2, color, fillColor: color, fillOpacity: 0.6
});
}

function renderSpots(spots){
const list = document.getElementById('list');
list.innerHTML = '';
markersLayer.clearLayers();
markerById.clear();
const bounds = [];

spots.forEach(s => {
const ll = getLatLng(s);
if (!ll) return;
const m = markerForSpot(s);
const html = `
<div class="popup">
<strong>${s.name || 'Spot'}</strong><br>
<small>Safety ${s.SafetyScore ?? '-'} | Sanity ${s.SanityScore ?? '-'} | Reset ${s.ResetScore ?? '-'}</small>
${spotBadgesHTML(s)}
</div>
`;
m.bindPopup(html).addTo(markersLayer);
markerById.set(s.id || `${ll[0]},${ll[1]}`, m);
bounds.push(ll);

const card = document.createElement('div');
card.className = 'card';
card.innerHTML = cardHTML(s);
card.addEventListener('click', () => {
m.openPopup();
map.setView(m.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
});
list.appendChild(card);
});

if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.1));
updateStats(spots);
}

function updateStats(spots){
const total = (window.ORIGINAL_SPOTS||[]).length || (window.ALL_SPOTS||[]).length;
const ok = spots.filter(s => !!getLatLng(s)).length;
const warn = spots.filter(s => (s.SafetyScore??0)<=1 || (s.SanityScore??0)<=1).length;
const err = total - ok;
document.getElementById('statTotal').textContent = total;
document.getElementById('statOk').textContent = ok;
document.getElementById('statWarn').textContent = warn;
document.getElementById('statErr').textContent = err;
}

function buildCategoryOptionsFromIndex(idx){
const sel = document.getElementById('category');
const current = sel.value;
sel.innerHTML = `<option value="">Alle Kategorien</option>` +
idx.map(e => `<option value="${e.slug}">${e.name} (${e.count})</option>`).join('');
sel.value = current || '';
}

function buildCategoryOptionsFromSpots(spots){
const set = new Set();
spots.forEach(s=>{
const t = s.type;
if (!t) return;
if (Array.isArray(t)) t.forEach(x=> set.add(String(x)));
else set.add(String(t));
});
const sel = document.getElementById('category');
const current = sel.value;
sel.innerHTML = `<option value="">Alle Kategorien</option>` +
Array.from(set).sort().map(v=>`<option value="${v}">${v}</option>`).join('');
sel.value = current || '';
}

async function fetchJson(url){
const res = await fetch(url, { cache: 'no-store' });
if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
const txt = await res.text();
return FSM.parseJsonLenient(txt);
}

// 1) Versuche data/index.json (Ordnerstruktur), 2) Fallback: spots.json
async function loadData() {
try {
const index = await fetchJson('data/index.json');
if (Array.isArray(index) && index.length) {
const arrays = await Promise.all(index.map(e => fetchJson(e.file)));
const spots = arrays.flat();
window.ORIGINAL_SPOTS = spots.slice();
window.ALL_SPOTS = spots.map(FSM.applyDerived);
buildCategoryOptionsFromIndex(index);
renderSpots(window.ALL_SPOTS);
updateBadgeCounts();
return;
}
throw new Error('Empty index.json');
} catch (e) {
try {
const raw = await fetchJson('spots.json');
window.ORIGINAL_SPOTS = Array.isArray(raw) ? raw.slice() : [];
window.ALL_SPOTS = window.ORIGINAL_SPOTS.map(FSM.applyDerived);
buildCategoryOptionsFromSpots(window.ALL_SPOTS);
renderSpots(window.ALL_SPOTS);
updateBadgeCounts();
} catch (err) {
console.error('Daten konnten nicht geladen werden:', err);
alert('⚠️ Keine Daten geladen (weder data/index.json noch spots.json).');
}
}
}

// Filter
function setBadgeActive(key, on) {
const btns = document.querySelectorAll(`#toolbar [data-b="${key}"]`);
btns.forEach(b => b.classList.toggle('on', !!on));
if (on) activeBadges.add(key); else activeBadges.delete(key);
applyFilters();
}

function applyFilters(){
const all = (window.ALL_SPOTS || []);
const q = document.getElementById('search').value.trim().toLowerCase();
const cat = document.getElementById('category').value;
let filtered = all.filter(s => FSM.matchBadges(s, activeBadges));

if (imgFilter==='has') filtered = filtered.filter(s => !!s.image);
if (imgFilter==='none') filtered = filtered.filter(s => !s.image);

if (cat) {
filtered = filtered.filter(s => {
if (!s.type) return false;
if (Array.isArray(s.type)) return s.type.map(String).includes(cat);
return String(s.type)===cat;
});
}

if (q) {
filtered = filtered.filter(s => {
const hay = [
s.name, s.city, s.region, s.country,
Array.isArray(s.type)? s.type.join(' ') : s.type,
Array.isArray(s.tags)? s.tags.join(' ') : s.tags
].filter(Boolean).join(' ').toLowerCase();
return hay.includes(q);
});
}

renderSpots(filtered);
}

function wireToolbar(){
document.querySelectorAll('#toolbar [data-b]').forEach(btn=>{
btn.addEventListener('click', ()=>{
const key = btn.dataset.b;
const on = !btn.classList.contains('on');
setBadgeActive(key, on);
});
});
document.getElementById('btnShowAll')?.addEventListener('click', ()=>{
activeBadges.clear();
document.querySelectorAll('#toolbar [data-b]').forEach(b=>b.classList.remove('on'));
document.getElementById('search').value = '';
document.getElementById('category').value = '';
imgFilter = 'all';
document.querySelectorAll('.panel-filters button').forEach(b=>b.classList.remove('on'));
const allBtn = document.querySelector('.panel-filters [data-img="all"]');
if (allBtn) allBtn.classList.add('on');
applyFilters();
});
document.getElementById('search')?.addEventListener('input', applyFilters);
document.getElementById('category')?.addEventListener('change', applyFilters);
}

function updateBadgeCounts(){
const all = window.ALL_SPOTS || [];
document.querySelectorAll('#toolbar [data-b]').forEach(btn=>{
const key = btn.dataset.b;
const rule = FSM.badgeRules[key];
let count = 0;
if (rule) {
count = all.reduce((n,s)=> n + (rule(s) ? 1 : 0), 0);
} else if (key.startsWith('RST')) {
const target = key.replace('RST','');
count = all.reduce((n,s)=> n + ((s.ResetScore||FSM.resetScore(s)) === target ? 1 : 0), 0);
}
const el = btn.querySelector('.count');
if (el) el.textContent = count ? `(${count})` : '';
});
}

function wirePanelFilters(){
document.querySelectorAll('.panel-filters button').forEach(btn=>{
btn.addEventListener('click', ()=>{
document.querySelectorAll('.panel-filters button').forEach(b=>b.classList.remove('on'));
btn.classList.add('on');
imgFilter = btn.getAttribute('data-img');
applyFilters();
});
});
}

function wireHeader(){
document.querySelectorAll('.flag').forEach(btn=> btn.addEventListener('click', ()=> btn.classList.toggle('on')));
const sat = document.getElementById('btnSat');
if (sat) sat.addEventListener('click', ()=>{
if (map.hasLayer(esriLayer)) { map.removeLayer(esriLayer); osmLayer.addTo(map); }
else { map.removeLayer(osmLayer); esriLayer.addTo(map); }
});
const rev = document.getElementById('btnReview');
if (rev) rev.addEventListener('click', ()=>{
const sb = document.getElementById('sidebar');
const on = !sb.classList.contains('open');
sb.classList.toggle('open', on);
sb.style.display = on ? 'block' : 'none';
});
}

document.addEventListener('DOMContentLoaded', async () => {
initMap();
wireHeader();
wireToolbar();
wirePanelFilters();
await loadData();
updateBadgeCounts();
});
