'use strict';
/**
 * EXP-050: The off-cone display samples are chord points, not a metadata failure.
 *
 * OPEN THREAD (knowledge/evidence/2026-09-15_v0.4.8-EXP048.md):
 *   "localize off-cone samples on bottom face 35 and the 19 Pocket Wheel faces identified in
 *    EXP-047; distinguish chord/interpolation samples, stale display data and correspondence
 *    issues without changing original coordinates."
 *
 * EXP-047 scores each tag-4003 face by coneMinus = MAX over vertices of
 *   | rho_i - |radius - h_i*tan(angle)| |,  threshold 1e-7 m,  27/47 pass.
 * Being a maximum, one deviant vertex fails a whole face, and the score cannot separate "the
 * stored surface is wrong" from "one sample is not on it". This experiment replaces the max with
 * the per-vertex distribution and applies four discriminators.
 *
 *   D1  Deviation SIGN. Inside the cone (rho < expected) vs outside. Random error or stale data
 *       deviates both ways; a secant of a convex surface can only fall inside.
 *   D2  CHORD test. For each failing vertex, the minimum distance to a segment joining two
 *       vertices of the same face that DO lie on the cone. Near zero => the vertex is an
 *       interpolated point on a straight span, not an independent surface sample.
 *   D3  Independent cone REFIT (least squares rho = R - T*h). If a refit rescued the face, the
 *       stored parameters would be the problem. It does not; recorded to show that was tested.
 *   D4  CO-OWNERSHIP. The surface tags of the other faces sharing each failing vertex, which
 *       says whether deviant samples sit on boundaries shared with a different surface type.
 *
 * Original coordinates are never modified, and EXP-047's 1e-7 m threshold is kept exactly --
 * no failure is rescued by loosening it.
 *
 * Reuses v0.4.8's forward metadata decoder deliberately: the aim is to explain EXP-047's own
 * numbers on its own terms, so a different decoder would confound the comparison.
 */

const fs = require('fs'), path = require('path');
const C = require('./research-common');
const { forward } = require('./exp045_forward_metadata');

const TOL = 1e-7, CONE_TAG = 4003;
const VKEY = (v) => v.map((x) => Math.round(x * 1e9)).join(',');

function stats(a) {
  const s = a.slice().sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
  return { min: s[0], median: q(0.5), p90: q(0.9), max: s[s.length - 1] };
}
function fitCone(h, rho) {
  const n = h.length; let sh = 0, sr = 0, shh = 0, shr = 0;
  for (let i = 0; i < n; i++) { sh += h[i]; sr += rho[i]; shh += h[i] * h[i]; shr += h[i] * rho[i]; }
  const den = n * shh - sh * sh; if (Math.abs(den) < 1e-30) return null;
  const slope = (n * shr - sh * sr) / den, inter = (sr - slope * sh) / n;
  return { fittedRadius: inter, fittedAngleRad: Math.atan(-slope),
    maxResidual: Math.max(...h.map((z, i) => Math.abs(rho[i] - (inter + slope * z)))) };
}
function distToSegment(p, a, b) {
  const ab = C.sub(b, a), ap = C.sub(p, a), L2 = C.dot(ab, ab);
  if (L2 === 0) return C.norm(ap);
  const t = Math.max(0, Math.min(1, C.dot(ap, ab) / L2));
  return C.norm(C.sub(p, a.map((x, i) => x + t * ab[i])));
}

const models = [];
const totals = { coneFaces: 0, passingFaces: 0, failingFaces: 0,
  failingVertices: 0, deviationInside: 0, deviationOutside: 0,
  failingOnChord: 0, worstChordDistance: 0, refitRescuedFaces: 0,
  failingByCoOwnerTag: {}, perModelFailingFaces: {} };

for (const file of C.corpus()) {
  let m; try { m = C.read(file); } catch (e) { continue; }
  if (!m || !m.faces || !m.faces.length) continue;

  const tagOf = [], owners = new Map();
  m.faces.forEach((f, fi) => {
    let mt; try { mt = forward(m, f); } catch (e) {}
    tagOf[fi] = mt ? mt.tag : null;
    for (let i = 0; i < f.pos.h[3]; i++) {
      const k = VKEY(C.vertex(f, i));
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k).add(fi);
    }
  });

  const rows = [];
  m.faces.forEach((f, fi) => {
    let meta; try { meta = forward(m, f); } catch (e) { return; }
    if (!meta || meta.tag !== CONE_TAG) return;
    totals.coneFaces++;

    const a = meta.direction, len = C.norm(a), axis = a.map((x) => x / len);
    const o = meta.parameters.slice(0, 3);
    const radius = meta.parameters[6], angle = meta.parameters[7];

    const V = [], h = [], rho = [], resid = [];
    for (let i = 0; i < f.pos.h[3]; i++) {
      const v = C.vertex(f, i); V.push(v);
      const d = C.sub(v, o), z = C.dot(d, axis);
      const r = C.norm(d.map((x, k) => x - z * axis[k]));
      h.push(z); rho.push(r); resid.push(r - Math.abs(radius - z * Math.tan(angle)));
    }
    const absRes = resid.map(Math.abs);
    const coneMinus = Math.max(...absRes);
    const failIdx = absRes.map((v, i) => (v > TOL ? i : -1)).filter((i) => i >= 0);
    const passed = failIdx.length === 0;
    passed ? totals.passingFaces++ : totals.failingFaces++;

    const fit = fitCone(h, rho);
    if (!passed && fit && fit.maxResidual <= TOL) totals.refitRescuedFaces++;

    let inside = 0, outside = 0, onChord = 0, worstChord = 0;
    const coOwner = {};
    for (const i of failIdx) {
      totals.failingVertices++;
      resid[i] < 0 ? (inside++, totals.deviationInside++) : (outside++, totals.deviationOutside++);
      const partners = [...(owners.get(VKEY(V[i])) || [])].filter((x) => x !== fi).map((x) => tagOf[x]).sort();
      const key = partners.length ? partners.join('+') : 'none';
      coOwner[key] = (coOwner[key] || 0) + 1;
      totals.failingByCoOwnerTag[key] = (totals.failingByCoOwnerTag[key] || 0) + 1;

      // D2: nearest chord between two ON-cone vertices of this same face
      const cand = V.map((v, j) => ({ j, d: C.norm(C.sub(V[i], v)) }))
        .filter((x) => x.j !== i && absRes[x.j] <= TOL).sort((p, q) => p.d - q.d);
      let best = Infinity;
      for (let x = 0; x < Math.min(6, cand.length); x++)
        for (let y = x + 1; y < Math.min(6, cand.length); y++)
          best = Math.min(best, distToSegment(V[i], V[cand[x].j], V[cand[y].j]));
      if (best <= TOL) { onChord++; totals.failingOnChord++; }
      if (best !== Infinity && best > worstChord) worstChord = best;
      if (best !== Infinity && best > totals.worstChordDistance) totals.worstChordDistance = best;
    }
    if (!passed) {
      const key = path.relative(C.ROOT, file);
      totals.perModelFailingFaces[key] = (totals.perModelFailingFaces[key] || 0) + 1;
    }

    rows.push({ faceIndex: fi, vertices: V.length, passed, coneMinus,
      storedRadius: radius, storedAngleRad: angle,
      failingVertices: failIdx.length,
      failingFraction: +(failIdx.length / V.length).toFixed(4),
      absResidualStats: stats(absRes),
      deviationInside: inside, deviationOutside: outside,
      failingOnChord: onChord, worstChordDistance: worstChord,
      refit: fit, refitRescues: !!(fit && fit.maxResidual <= TOL),
      failingCoOwnerTags: coOwner });
  });
  if (rows.length) models.push({ file: path.relative(C.ROOT, file), sha256: C.sha256(fs.readFileSync(file)), faces: rows });
}

const out = { experiment: 'EXP-050', date: '2026-09-15',
  question: 'Localize the off-cone display samples left open by EXP-047/048.',
  method: 'Per-vertex cone residual distribution; deviation sign; distance to a chord between two on-cone vertices of the same face; independent least-squares cone refit; co-owning surface tags. Tolerance held at EXP-047 1e-7 m; no failure rescued.',
  toleranceMetres: TOL, scriptSha256: C.sha256(fs.readFileSync(__filename)),
  dependencies: ['research-common.js', 'exp045_forward_metadata.js'].map((p) => ({ path: p, sha256: C.sha256(fs.readFileSync(path.join(__dirname, p))) })),
  totals, models };
C.writeJSON('EXP050_RESULTS.json', out);

console.log('EXP-050 — off-cone sample localization\n');
console.log('cone faces', totals.coneFaces, '| passing', totals.passingFaces, '| failing', totals.failingFaces);
console.log('failing faces by model:');
for (const k of Object.keys(totals.perModelFailingFaces)) console.log('   ', k.replace('test files original/', ''), totals.perModelFailingFaces[k]);
console.log('\nD1  deviation sign  INSIDE the cone:', totals.deviationInside, '| OUTSIDE:', totals.deviationOutside);
console.log('D2  failing vertices lying on a chord between two on-cone vertices:',
  totals.failingOnChord, '/', totals.failingVertices,
  '| worst distance-to-chord', totals.worstChordDistance.toExponential(3), 'm');
console.log('D3  faces rescued by an independent cone refit:', totals.refitRescuedFaces, '/', totals.failingFaces);
console.log('D4  failing vertices by co-owning surface tag:', JSON.stringify(totals.failingByCoOwnerTag));
console.log('\nWrote EXP050_RESULTS.json');
