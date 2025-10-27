// split_by_category.js
// Usage: node split_by_category.js spots.json data --mode=replicate
// Modes: replicate | primary
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
console.log('Usage: node split_by_category.js <input_spots.json> <out_dir> [--mode=replicate|primary]');
process.exit(1);
}
const INPUT = args[0];
const OUTDIR = args[1];
const MODE = (args.find(a=>a.startsWith('--mode='))||'--mode=replicate').split('=')[1];

function parseLenient(text){
let t = text;
if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
t = t.replace(/\u00a0/g, ' ');
t = t.replace(/,\s*([}\]])/g, '$1');
t = t.replace(/[\r\t]+/g, '');
return JSON.parse(t);
}

const TYPE_MAP = Object.freeze({
'playground_adventure': 'playground',
'playground': 'playground',
'pumptrack': 'pumptrack',
'waterplay': 'water',
'beach': 'water',
'lake': 'water',
'pool': 'water',
'family_attraction': 'attraction',
'attraction': 'attraction',
'cafe-nearby': 'cafe',
'cafe': 'cafe',
'wc': 'wc',
'toilet': 'wc',
'stellplatz': 'stellplatz',
'camping': 'stellplatz'
});
const DEFAULT_SLUG = 'other';
const PRIORITY = ['pumptrack','water','playground','stellplatz','attraction','cafe','wc', DEFAULT_SLUG];

function slugify(s) {
return String(s || '').trim().toLowerCase()
.replace(/[ä]/g,'ae').replace(/[ö]/g,'oe').replace(/[ü]/g,'ue').replace(/[ß]/g,'ss')
.replace(/[^a-z0-9\-_.]+/g, '-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function deriveCategories(spot) {
let cats = [];
const t = spot.type;
if (Array.isArray(t)) cats = t.slice();
else if (t) cats = [t];
cats = cats.map(x => TYPE_MAP[String(x).toLowerCase()] || String(x).toLowerCase());
if (cats.length === 0) cats = [DEFAULT_SLUG];
return Array.from(new Set(cats.map(slugify)));
}

function pickPrimary(cats) {
for (const p of PRIORITY) if (cats.includes(p)) return p;
return cats[0] || DEFAULT_SLUG;
}

(function main(){
const raw = fs.readFileSync(INPUT, 'utf8');
const data = parseLenient(raw);
if (!Array.isArray(data)) throw new Error('Input is not an array');

fs.mkdirSync(OUTDIR, { recursive: true });

const out = {};
data.forEach(spot => {
const cats = deriveCategories(spot);
if (MODE === 'primary') (out[pickPrimary(cats)] ||= []).push(spot);
else cats.forEach(c => (out[c] ||= []).push(spot));
});

const index = [];
for (const [slug, arr] of Object.entries(out)) {
const dir = path.join(OUTDIR, slug);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'spots.json'), JSON.stringify(arr, null, 2), 'utf8');
index.push({ slug, name: slug.charAt(0).toUpperCase()+slug.slice(1), count: arr.length, file: `data/${slug}/spots.json` });
}
index.sort((a,b)=> a.slug.localeCompare(b.slug));
fs.writeFileSync(path.join(OUTDIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');

console.log(`✓ Split complete → ${Object.keys(out).length} categories`);
index.forEach(i => console.log(` - ${i.slug}: ${i.count} → ${i.file}`));
})();

