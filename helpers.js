/* Family Spot's Map – helpers.js (v1) */
(function (global) {
'use strict';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function safetyScore(s) {
const road = (s.road_distance_m ?? 0) >= 50 ? 1 : 0;
const lowRisk = (String(s.risk_profile || '').includes('low')) ? 1 : 0;
const fence = s.fenced ? 1 : 0;
const sight = (s.trees ? 0 : 1) + ((s.surface_area_m2 ?? 0) >= 1200 ? 1 : 0);
return clamp(fence + road + lowRisk + sight, 0, 4);
}

function sanityScore(s) {
const wc = (s.toilet === 'yes' || s.toilet === 'yes_baby') ? 1 : 0;
const baby = (s.toilet === 'yes_baby') ? 1 : 0;
const cafe = ((s.cafe_distance_m ?? 999) <= 150 || (s.ice_distance_m ?? 999) <= 150) ? 1 : 0;
const shade = (s.shade_score ?? 0) >= 2 ? 1 : 0;
const parking = (s.parking_height_limit_m ?? 3) >= 2.6 ? 1 : 0;
return clamp(wc + baby + cafe + shade + parking, 0, 5);
}

function resetScore(s) {
const S = safetyScore(s);
const N = sanityScore(s);
const seats = (s.benches_count ?? 0) + (s.picnic_tables ?? 0);
const area = s.surface_area_m2 ?? 0;
const hasWater = (s.waterplay && s.waterplay !== 'none');
if (N>=4 && S>=3 && area>=1500 && (hasWater || area>=2000)) return 'ALL';
if (N>=3 && S>=2 && seats>=2 && area>=800) return '90';
if (N>=2 && S>=2 && seats>=1) return '30';
return 'none';
}

const badgeRules = {
FEN: s => !!s.fenced,
SHA: s => (s.shade_score ?? 0) >= 2,
WTR: s => !!(s.waterplay && s.waterplay !== 'none'),
PTK: s => ['multi','toddler'].includes(s.pumptrack_levels),
CAF: s => (s.cafe_distance_m ?? 999) <= 150 || (s.ice_distance_m ?? 999) <= 150,
WC: s => s.toilet === 'yes' || s.toilet === 'yes_baby',
BRM: s => !!s.nursing_room || !!s.changing_table,
WND: s => (s.wind_shelter ?? 0) >= 2,
STL: s => !!s.pitch_family,
RST30: s => (s.ResetScore || resetScore(s)) === '30',
RST90: s => (s.ResetScore || resetScore(s)) === '90',
RSTALL: s => (s.ResetScore || resetScore(s)) === 'ALL'
};

function getBadges(s) { const a=[]; for (const k in badgeRules) try{ if(badgeRules[k](s)) a.push(k);}catch(e){} return a; }
function matchBadges(s, set) { if (!set || set.size===0) return true; for (const b of set){const r=badgeRules[b]; if (!r) continue; if (!r(s)) return false;} return true; }

function applyDerived(s) {
const spot = Object.assign({}, s);
spot.SafetyScore = safetyScore(spot);
spot.SanityScore = sanityScore(spot);
spot.ResetScore = resetScore(spot);
spot.badges = getBadges(spot);
return spot;
}

function parseJsonLenient(text) {
if (typeof text !== 'string') throw new Error('parseJsonLenient expects a string');
let t = text;
if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
t = t.replace(/\u00a0/g, ' ');
t = t.replace(/,\s*([}\]])/g, '$1');
t = t.replace(/[\r\t]+/g, '');
return JSON.parse(t);
}

global.FSM = { safetyScore, sanityScore, resetScore, getBadges, matchBadges, applyDerived, parseJsonLenient, badgeRules };
})(typeof window !== 'undefined' ? window : globalThis);
