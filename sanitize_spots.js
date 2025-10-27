
// sanitize_spots.js – JSON bereinigen (BOM/NBSP/trailing commas)
// Nutzung: node sanitize_spots.js input.json output.json
const fs = require('fs');

function clean(text) {
let t = text;
if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
t = t.replace(/\u00a0/g, ' ');
t = t.replace(/,\s*([}\]])/g, '$1');
t = t.replace(/[\r\t]+/g, '');
return t;
}

const [,, input, output] = process.argv;
if (!input || !output) {
console.error('Usage: node sanitize_spots.js input.json output.json');
process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const cleaned = clean(raw);
try {
const data = JSON.parse(cleaned);
fs.writeFileSync(output, JSON.stringify(data, null, 2), 'utf8');
console.log(`OK → ${output} (${Array.isArray(data) ? data.length : 1} records)`);
} catch (e) {
console.error('Failed to parse after cleaning:', e.message);
fs.writeFileSync(output.replace(/\.json$/i, '.clean.txt'), cleaned, 'utf8');
process.exit(2);
}
