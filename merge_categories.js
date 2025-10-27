// merge_categories.js
// Usage: node merge_categories.js data merged.spots.json
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
console.log('Usage: node merge_categories.js <data_dir> <output_file.json>');
process.exit(1);
}
const DATADIR = process.argv[2];
const OUT = process.argv[3];

function parse(file){
const t = fs.readFileSync(file, 'utf8');
return JSON.parse(t);
}

const index = parse(path.join(DATADIR, 'index.json'));
const seen = new Set();
const merged = [];
index.forEach(entry => {
const p = path.join(DATADIR, entry.slug, 'spots.json');
const arr = parse(p);
arr.forEach(s => {
const id = s.id || `${s.name}-${(s.geo && s.geo.lat)||s.lat}-${(s.geo && s.geo.lng)||s.lng||s.lon}`;
if (seen.has(id)) return;
seen.add(id);
merged.push(s);
});
});
fs.writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf8');
console.log(`✓ Merged ${merged.length} unique spots → ${OUT}`);
