/**
 * EXP-049: Independent replication of INV-020/021/022, an edge-order falsification control,
 *          and a correction to EXP-042's attribution of its STL residuals.
 *
 * WHY THIS EXISTS
 * ---------------
 * v0.4.8 (EXP-042..046) established that face vertex arrays are triangle strips, that Block1
 * annotates strip edges (zero = face-interior, nonzero = face-boundary), and that a third
 * all-zero byte array follows Block2. Those results were produced by one implementation
 * (`v0.4.8/research-common.js`, a forward precursor-array scan). This experiment re-derives them
 * through a DIFFERENT code path and adds a control that v0.4.8 does not contain.
 *
 * INDEPENDENCE, STATED HONESTLY
 * -----------------------------
 *  - INDEPENDENT: face discovery. `parser/v0.1` locates faces by scanning for the gap marker
 *    [12,100,2,vertexCount]; v0.4.8 scans forward from the [4,8,2,S] precursor array. These are
 *    different discovery strategies, so agreeing on the face set is a real cross-check.
 *  - INDEPENDENT: the Block3 offsets here are computed from parser/v0.1's own block2Start and
 *    secCount plus arithmetic in this file. parser/v0.1 has no concept of Block3 and never reads
 *    it, so this does not inherit v0.4.8's offset math.
 *  - INDEPENDENT: strip triangulation, the edge enumeration, the face-level edge-incidence
 *    classification and the STL reader are all written here.
 *  - NOT INDEPENDENT: the openswx container decompressor is shared (v0.4.8 flags this same
 *    limitation for itself). A container-level decoding error would affect both paths equally.
 *
 * PART 5 is a new result, not a replication: it corrects how EXP-042 attributes its own
 * STL comparison residuals.
 *
 * No semantic meaning is assigned to any token value. Nothing is promoted to KNOWN_INVARIANTS.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.join(__dirname, '..');
const core = require(path.join(REPO_ROOT, 'parser', 'v0.1', 'src', 'parser-core.js'));
const CORPUS = path.join(REPO_ROOT, 'test files original');

const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));

function listSLDPRT(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.sldprt$/i.test(e.name)) out.push(p);
    }
  })(dir);
  return out.sort();
}

const rel = (p) => path.relative(REPO_ROOT, p);
const sha = (p) => require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------- geometry helpers (all written here) ----------
const VKEY = (v) => v.map((x) => Math.round(x * 1e9)).join(',');
const EKEY = (a, b) => { const x = VKEY(a), y = VKEY(b); return x < y ? x + '|' + y : y + '|' + x; };

function faceVertices(f) {
  const v = [];
  for (let k = 0; k < f.vertexCount; k++) v.push([f.vertices[k * 3], f.vertices[k * 3 + 1], f.vertices[k * 3 + 2]]);
  return v;
}
function faceNormals(f) {
  const n = [];
  for (let k = 0; k < f.vertexCount; k++) n.push([f.normals[k * 3], f.normals[k * 3 + 1], f.normals[k * 3 + 2]]);
  return n;
}
// Strip triangulation: within a strip, flip winding on odd index. Never span strips.
function stripTriangles(verts, lens) {
  const tris = []; let off = 0;
  for (const L of lens) {
    for (let i = 0; i + 2 < L; i++) {
      const a = off + i, b = off + i + 1, c = off + i + 2;
      tris.push(i % 2 === 0 ? [a, b, c] : [a, c, b]);
    }
    off += L;
  }
  return tris;
}
// Block1 section edge order, per v0.4.8's documented mapping:
//   ID(0,1), then for each new vertex i>=2: ID(i-2,i), ID(i-1,i)
// (equivalently: for i in 0..L-3 emit (i,i+1),(i,i+2), then the final (L-2,L-1))
function stripEdgeOrder(base, L) {
  const e = [[base + 0, base + 1]];
  for (let i = 2; i < L; i++) { e.push([base + i - 2, base + i]); e.push([base + i - 1, base + i]); }
  return e;
}
function unitNormal(p, q, r) {
  const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const L = Math.hypot(n[0], n[1], n[2]);
  return L ? [n[0] / L, n[1] / L, n[2] / L] : null;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// deterministic LCG shuffle, for the falsification control
function shuffled(arr, seed) {
  const a = arr.slice(); let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- binary STL ----------
function readSTL(p) {
  // These files begin with the ASCII bytes "solid" but are BINARY STL (size == 84 + 50n).
  const b = fs.readFileSync(p);
  if (b.length < 84) return null;
  const n = b.readUInt32LE(80);
  if (b.length !== 84 + 50 * n) return null;
  const t = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50, v = [];
    for (let k = 0; k < 3; k++) v.push([b.readFloatLE(o + 12 + k * 12), b.readFloatLE(o + 16 + k * 12), b.readFloatLE(o + 20 + k * 12)]);
    t.push({ normal: [b.readFloatLE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8)], v });
  }
  return t;
}

// ============================================================
// Run
// ============================================================
const results = { experiment: 'EXP-049', date: '2026-09-15', parts: {} };
const files = listSLDPRT(CORPUS);

let T = { files: 0, unsupported: [], faces: 0, strips: 0, verts: 0, tris: 0, normalAgree: 0,
  tokens: 0, nzBoundary: 0, nzInterior: 0, zBoundary: 0, zInterior: 0,
  ctrlNzBoundary: 0, ctrlNzInterior: 0, ctrlZBoundary: 0, ctrlZInterior: 0,
  b3Header: 0, b3Bad: 0, b3NEqB1: 0, b3Bytes: 0, b3Nonzero: 0 };
const perFile = [];

for (const p of files) {
  let parsed, dl;
  try {
    const buf = fs.readFileSync(p);
    parsed = core.parseSLDPRT(buf, inflateRaw, inflateZlib);
    dl = core.findDisplayLists(buf, inflateRaw, inflateZlib);
  } catch (e) { T.unsupported.push({ file: rel(p), reason: e.message }); continue; }
  if (!parsed || !parsed.faces || !parsed.faces.length) { T.unsupported.push({ file: rel(p), reason: 'no faces (legacy OLE2 / unsupported)' }); continue; }
  const D = Buffer.isBuffer(dl) ? dl : (dl && (dl.buffer || dl.data || dl[0]));
  T.files++;
  const F = { file: rel(p), sha256: sha(p), faces: 0, strips: 0, tris: 0, normalAgree: 0,
    tokens: 0, nzBoundary: 0, nzInterior: 0, zBoundary: 0, zInterior: 0, b3Bytes: 0, b3Nonzero: 0 };

  for (const f of parsed.faces) {
    const lens = Array.from(f.loopSizes || []);
    if (!lens.length || lens.length !== f.secCount) continue;
    const V = faceVertices(f), Nrm = faceNormals(f), b1 = Array.from(f.b1Body || []);
    T.faces++; F.faces++; T.strips += lens.length; F.strips += lens.length; T.verts += f.vertexCount;

    // --- strip triangles + winding vs stored normals
    const tris = stripTriangles(V, lens);
    T.tris += tris.length; F.tris += tris.length;
    for (const [a, b, c] of tris) {
      const n = unitNormal(V[a], V[b], V[c]);
      if (n && dot(n, Nrm[a]) > 0) { T.normalAgree++; F.normalAgree++; }
    }

    // --- face-level edge incidence (an edge interior to the FACE is shared by 2 of its triangles)
    const inc = new Map();
    for (const [a, b, c] of tris) for (const [u, w] of [[a, b], [b, c], [a, c]]) {
      const k = EKEY(V[u], V[w]); inc.set(k, (inc.get(k) || 0) + 1);
    }

    // --- walk Block1 in documented edge order; also run the shuffled control
    let cur = 0, off = 0, ok = true; const pairs = [];
    for (const L of lens) {
      const expect = 2 * L - 3;
      if (b1[cur] !== 1) { ok = false; break; }
      const body = b1.slice(cur + 1, cur + 1 + expect);
      const edges = stripEdgeOrder(off, L);
      if (body.length !== expect || edges.length !== expect) { ok = false; break; }
      const ctrl = shuffled(edges, 0x5eed + off + L);
      for (let t = 0; t < expect; t++) pairs.push({ v: body[t], k: EKEY(V[edges[t][0]], V[edges[t][1]]), ck: EKEY(V[ctrl[t][0]], V[ctrl[t][1]]) });
      cur += 1 + expect; off += L;
    }
    if (ok) for (const { v, k, ck } of pairs) {
      T.tokens++; F.tokens++;
      const interior = (inc.get(k) || 0) >= 2;
      if (v !== 0) { interior ? (T.nzInterior++, F.nzInterior++) : (T.nzBoundary++, F.nzBoundary++); }
      else { interior ? (T.zInterior++, F.zInterior++) : (T.zBoundary++, F.zBoundary++); }
      const ci = (inc.get(ck) || 0) >= 2;
      if (v !== 0) { ci ? T.ctrlNzInterior++ : T.ctrlNzBoundary++; } else { ci ? T.ctrlZInterior++ : T.ctrlZBoundary++; }
    }

    // --- Block3, offsets derived here from parser/v0.1's block2Start + secCount
    if (D && Buffer.isBuffer(D)) {
      const b2end = f.block2Start + 16 + f.secCount * 4;   // [4,8,2,S] header + S words
      if (b2end + 16 <= D.length) {
        const h = [0, 4, 8, 12].map((o) => D.readUInt32LE(b2end + o));
        if (h[0] === 1 && h[1] === 8 && h[2] === 2) {
          T.b3Header++; const N = h[3];
          if (N === f.b1Len) T.b3NEqB1++;
          for (let i = 0; i < N && b2end + 16 + i < D.length; i++) {
            T.b3Bytes++; F.b3Bytes++;
            if (D[b2end + 16 + i] !== 0) { T.b3Nonzero++; F.b3Nonzero++; }
          }
        } else T.b3Bad++;
      }
    }
  }
  perFile.push(F);
}

results.parts.part1_replication = {
  note: 'Face discovery via parser/v0.1 gap-marker scan — a different strategy from v0.4.8 forward precursor scan.',
  modernFilesDecoded: T.files, unsupported: T.unsupported,
  faces: T.faces, strips: T.strips, serializedVertices: T.verts,
  stripTriangles: T.tris, trianglesAgreeingWithStoredNormal: T.normalAgree,
  perFile,
};
results.parts.part2_block1_edge_partition = {
  totalEdgeTokens: T.tokens,
  nonzero_on_faceBoundary: T.nzBoundary, nonzero_on_faceInterior: T.nzInterior,
  zero_on_faceInterior: T.zInterior, zero_on_faceBoundary: T.zBoundary,
  exceptions: T.nzInterior + T.zBoundary,
  ruleHolds: T.nzInterior === 0 && T.zBoundary === 0,
};
results.parts.part3_edge_order_control = {
  note: 'Same tokens, same incidence map, edge order deterministically shuffled within each strip.',
  nonzero_on_faceBoundary: T.ctrlNzBoundary, nonzero_on_faceInterior: T.ctrlNzInterior,
  zero_on_faceInterior: T.ctrlZInterior, zero_on_faceBoundary: T.ctrlZBoundary,
  exceptions: T.ctrlNzInterior + T.ctrlZBoundary,
};
results.parts.part4_block3 = {
  note: 'Offsets derived from parser/v0.1 block2Start + secCount; v0.1 never reads Block3.',
  facesWithValidHeader: T.b3Header, malformedHeaders: T.b3Bad,
  facesWhereN_equals_block1WordCount: T.b3NEqB1,
  payloadBytes: T.b3Bytes, nonzeroBytes: T.b3Nonzero,
};

// ---------- PART 5: STL completeness audit ----------
const AXIS = { '-1,0,0': '-X', '1,0,0': '+X', '0,-1,0': '-Y', '0,1,0': '+Y', '0,0,-1': '-Z', '0,0,1': '+Z' };
const CTRL = path.join(CORPUS, 'controlled');
const stlAudit = [];
for (const d of fs.readdirSync(CTRL).filter((x) => /^C\d\d_/.test(x)).sort()) {
  const sp = path.join(CTRL, d, 'model.STL');
  if (!fs.existsSync(sp)) continue;
  const T2 = readSTL(sp);
  if (!T2) { stlAudit.push({ model: d, error: 'not a binary STL' }); continue; }
  const groups = new Set(T2.map((t) => t.normal.map((x) => Math.round(x * 100) / 100).join(',')));
  const missing = Object.keys(AXIS).filter((k) => !groups.has(k)).map((k) => AXIS[k]);
  stlAudit.push({ model: d, sha256: sha(sp), stlTriangles: T2.length,
    missingAxisAlignedFaceGroups: missing, complete: missing.length === 0 });
}
results.parts.part5_stl_completeness = {
  note: 'A missing axis-aligned facet-normal group means that planar face is absent from the STL export entirely.',
  models: stlAudit,
  incomplete: stlAudit.filter((x) => x.missingAxisAlignedFaceGroups && x.missingAxisAlignedFaceGroups.length)
    .map((x) => ({ model: x.model, missing: x.missingAxisAlignedFaceGroups })),
};

fs.writeFileSync(path.join(__dirname, 'EXP049_RESULTS.json'), JSON.stringify(results, null, 2));

console.log('EXP-049 — independent replication\n');
console.log('PART 1  files decoded', T.files, '| faces', T.faces, '| strips', T.strips,
  '| vertices', T.verts, '| triangles', T.tris, '| normal-agreeing', T.normalAgree);
console.log('        unsupported:', T.unsupported.map((u) => path.basename(u.file)).join(', '));
console.log('\nPART 2  Block1 edge tokens', T.tokens);
console.log('          nonzero on face-BOUNDARY :', T.nzBoundary);
console.log('          zero    on face-INTERIOR :', T.zInterior);
console.log('          nonzero on face-INTERIOR :', T.nzInterior, '   <- must be 0');
console.log('          zero    on face-BOUNDARY :', T.zBoundary, '   <- must be 0');
console.log('        rule holds:', results.parts.part2_block1_edge_partition.ruleHolds);
console.log('\nPART 3  shuffled-edge-order CONTROL exceptions:', results.parts.part3_edge_order_control.exceptions);
console.log('\nPART 4  Block3 headers', T.b3Header, '| malformed', T.b3Bad,
  '| N==b1Len', T.b3NEqB1, '| bytes', T.b3Bytes, '| NONZERO', T.b3Nonzero);
console.log('\nPART 5  STL completeness (controlled corpus):');
for (const m of stlAudit) console.log('       ', m.model.padEnd(30),
  String(m.stlTriangles).padStart(4), 'tris ',
  m.complete ? 'complete' : 'MISSING ' + m.missingAxisAlignedFaceGroups.join(','));
console.log('\nWrote v0.4.9/EXP049_RESULTS.json');
