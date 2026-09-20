/**
 * SLDPRT Parser Core (v0.1, parser series; originally v0.5 of the research progression)
 *
 * Isomorphic (Node + browser) implementation of the validated extraction
 * pipeline established through v0.4.6 of the SLDPRT reverse-engineering
 * research. This file contains ONLY logic backed by verified invariants
 * (KNOWN_INVARIANTS.md) or the corrected offset arithmetic from v0.4.5/
 * v0.4.6 (RESEARCH_DASHBOARD.md, OPEN_QUESTIONS.md OQ-016/OQ-018).
 *
 * It does not reuse the pre-v0.4 heuristic extractors in v0.2.x/v0.3.x
 * (which predate the Block1/Block2 grammar research and use ad hoc
 * normal-discontinuity loop-splitting heuristics that were later falsified
 * -- see FH-005, FAILED_HYPOTHESES.md). It reimplements, deliberately, the
 * same face-extraction/validation pipeline already proven in:
 *   - v0.4.3/exp018_independent_extraction.js  (INV-002/004/005/006 gates)
 *   - v0.4.3/exp021_alternative_headers.js     (normals unit-length check)
 *   - v0.4.5/exp024_rejected_candidate_audit_corrected.js (corrected B2
 *     offset, INV-016/017/018 checks, per-candidate rejection categories)
 *
 * Invariants relied on (see knowledge/KNOWN_INVARIANTS.md for evidence):
 *   INV-001  Modern geometry lives in Contents/DisplayLists
 *   INV-002  Face block layout (positions, gap, normals, Block1, Block2)
 *   INV-003  Normals are unit vectors distinct from positions
 *   INV-004  Gap marker is exactly [12, 100, 2, vertexCount]
 *   INV-005  Block1 header is [4, 8, 2, N] (N = body length in u32s)
 *   INV-006  Block2 header is [4, 8, 2, M] (M = body length in u32s)
 *   INV-007  Block2 body decodes to loop vertex counts via (raw+2)/2
 *   INV-008  Block1 body starts with ONE (value 1)
 *   INV-009  Block1 ONE count equals Block2 entry count
 *   INV-016  b1len = 2 * (vertexCount - sectionCount)      [N = b1len]
 *   INV-017  sectionBodyTokenCount = Block2[i] - 1
 *   INV-018  sum(Block2) = b1len
 *
 * CORRECTED (v0.4.5) offset formula used here -- NOT the buggy v0.4.4 one:
 *   block2Start = block1Start + (N + 4) * 4
 *   (N read from block1Start + 12, after validating header shape [4,8,2,N])
 *
 * NOT claimed as verified, and explicitly flagged wherever used:
 *   - Vertex-to-loop ORDERING. INV-007 only proves loop sizes decoded from
 *     Block2 SUM to vertexCount; it says nothing about which vertices
 *     belong to which loop. This module offers a "sequential loop
 *     segmentation" as a labeled HYPOTHESIS (loopModel: 'sequential-assumed')
 *     for rendering purposes only -- it is not a research conclusion. See
 *     ../README.md and OQ-019.
 *   - Block1 VALUE-token semantics, alternative [4,8,2,N] header meaning,
 *     and everything else still marked UNKNOWN in KNOWN_INVARIANTS.md /
 *     OPEN_QUESTIONS.md are NOT interpreted anywhere in this file.
 *
 * OUT OF SCOPE (explicitly unsupported, reported as a clear parser error,
 * not silently skipped):
 *   - The legacy OLE2 container format (SW2000-s01, plate4, chainwheel in
 *     the current corpus). RESEARCH_DASHBOARD.md's Current Corpus table
 *     already documents these as "OLE2, not parseable by current pipeline".
 *     This module does not attempt OLE2 parsing and does not claim to.
 *
 * This module performs NO writing/conversion back into SLDPRT and makes no
 * claim of full format support. It is read-only, and only extracts what the
 * validated invariants above establish.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SLDPRTParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Low-level byte utilities (isomorphic: works on Node Buffer or browser
  // Uint8Array, since both expose .buffer/.byteOffset/.byteLength).
  // ---------------------------------------------------------------------

  function toUint8(bufLike) {
    if (bufLike instanceof Uint8Array) return bufLike;
    return new Uint8Array(bufLike);
  }

  function toDataView(bufLike) {
    var u8 = toUint8(bufLike);
    return new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }

  function findAll(u8, pattern) {
    var r = [];
    var plen = pattern.length;
    var limit = u8.length - plen;
    for (var i = 0; i <= limit; i++) {
      var ok = true;
      for (var j = 0; j < plen; j++) {
        if (u8[i + j] !== pattern[j]) { ok = false; break; }
      }
      if (ok) r.push(i);
    }
    return r;
  }

  function rolByte(b, s) {
    s &= 7;
    if (!s) return b;
    return ((b << s) | (b >>> (8 - s))) & 0xFF;
  }

  // ---------------------------------------------------------------------
  // openswx container decompression (v2/v3 "modern" SLDPRT format).
  // `inflateRaw`/`inflateZlib` are injected so this file stays isomorphic:
  // Node passes zlib.inflateRawSync/zlib.inflateSync, the browser passes
  // pako.inflateRaw/pako.inflate. Each must be a function(bytes) -> bytes
  // that throws on failure.
  // ---------------------------------------------------------------------

  function decompressOpenSX(buffer, inflateRaw, inflateZlib) {
    var buf = toUint8(buffer);
    var dv = toDataView(buf);
    var key = buf[7];
    var magic = [20, 0, 6, 0, 8, 0];
    var streams = {};
    var matches = findAll(buf, magic);

    for (var mi = 0; mi < matches.length; mi++) {
      var matchPos = matches[mi];
      var sigStart = matchPos - 4;
      if (sigStart < 0 || sigStart + 30 > buf.length) continue;

      var compSize = dv.getUint32(sigStart + 18, true);
      var nameSize = dv.getUint32(sigStart + 26, true);

      if (nameSize > 1024 || compSize > 50e6) continue;

      var nameStart = sigStart + 30;
      var dataStart = nameStart + nameSize;
      var dataEnd = dataStart + compSize;

      if (dataEnd > buf.length) continue;

      if (dv.getUint32(sigStart + 14, true) >= 65536 && compSize > 0) {
        var name = '';
        for (var i = 0; i < nameSize; i++) {
          name += String.fromCharCode(rolByte(buf[nameStart + i], key));
        }
        if (!name) continue;

        var slice = buf.subarray(dataStart, dataEnd);
        var data = null;
        try {
          data = inflateRaw(slice);
        } catch (e) {
          try {
            data = inflateZlib(slice);
          } catch (e2) { /* leave data null */ }
        }

        if (data && data.length > 0 && !streams[name]) {
          streams[name] = data;
        }
      }
    }

    return streams;
  }

  function findDisplayLists(buffer, inflateRaw, inflateZlib) {
    var streams = decompressOpenSX(buffer, inflateRaw, inflateZlib);
    var names = Object.keys(streams);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var data = streams[name];
      if (name.toLowerCase().indexOf('displaylist') !== -1 && data.length > 100) {
        var dv = toDataView(data);
        if (dv.getUint32(0, true) === 1 && dv.getUint32(4, true) === 1) {
          return data;
        }
      }
    }
    return null;
  }

  function isOLE2(buffer) {
    var u8 = toUint8(buffer);
    return u8.length >= 4 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
  }

  // ---------------------------------------------------------------------
  // Face extraction. Reproduces the validated pipeline from
  // v0.4.5/exp024_rejected_candidate_audit_corrected.js, with the corrected
  // Block1->Block2 offset formula, PLUS a normals unit-length check
  // (INV-003 / EXP-019 H1) that was validated but not wired into EXP-024's
  // category list. This is an additive, invariant-backed check, not a new
  // hypothesis.
  // ---------------------------------------------------------------------

  var FACE_MARKER = [12, 0, 0, 0, 100, 0, 0, 0];
  var NORMAL_TOLERANCE = 0.001; // matches EXP-021's threshold

  // Rejection categories, in pipeline order. Mirrors EXP-024-CORRECTED plus
  // two additional invariant-backed stages (OVERFLOW_NORMALS, INVALID_NORMALS).
  var REJECT_STAGES = [
    'INVALID_OFFSET', 'INVALID_EC', 'INVALID_GAP_WORD2', 'INVALID_VC',
    'OVERFLOW_VERTICES', 'INVALID_VERTEX_DATA', 'OVERFLOW_GAP', 'INVALID_GAP',
    'OVERFLOW_NORMALS', 'INVALID_NORMALS',
    'OVERFLOW_B1_HEADER', 'INVALID_B1_HEADER_SHAPE', 'INVALID_B1_LEN', 'OVERFLOW_B1_BODY',
    'OVERFLOW_B2_HEADER', 'INVALID_B2_HEADER_SHAPE', 'INVALID_B2_LEN', 'OVERFLOW_B2_BODY',
    'INV016_FAIL', 'INV017_FAIL', 'INV018_FAIL',
  ];

  function extractFaces(displayListsBuffer) {
    var dl = toUint8(displayListsBuffer);
    var dv = toDataView(dl);
    var matches = findAll(dl, FACE_MARKER);

    var faces = [];
    var rejected = [];

    for (var mi = 0; mi < matches.length; mi++) {
      var mp = matches[mi];
      var faceStartOffset = mp - 4;
      if (faceStartOffset < 0) {
        rejected.push({ mp: mp, category: 'INVALID_OFFSET' });
        continue;
      }

      var edgeCount = dv.getUint32(faceStartOffset, true);
      if (edgeCount < 1 || edgeCount > 500) {
        rejected.push({ mp: mp, category: 'INVALID_EC', ec: edgeCount });
        continue;
      }

      if (dv.getUint32(mp + 8, true) !== 2) {
        rejected.push({ mp: mp, category: 'INVALID_GAP_WORD2', ec: edgeCount });
        continue;
      }

      var vertexCount = dv.getUint32(mp + 12, true);
      if (vertexCount < 3 || vertexCount > 6000) {
        rejected.push({ mp: mp, category: 'INVALID_VC', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var verticesStart = mp + 16;
      if (verticesStart + vertexCount * 12 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_VERTICES', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var vertices = new Float32Array(vertexCount * 3);
      var vertexValid = true;
      for (var vi = 0; vi < vertexCount; vi++) {
        var off = verticesStart + vi * 12;
        var x = dv.getFloat32(off, true);
        var y = dv.getFloat32(off + 4, true);
        var z = dv.getFloat32(off + 8, true);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z) ||
            Math.abs(x) > 1e5 || Math.abs(y) > 1e5 || Math.abs(z) > 1e5) {
          vertexValid = false; break;
        }
        vertices[vi * 3] = x; vertices[vi * 3 + 1] = y; vertices[vi * 3 + 2] = z;
      }
      if (!vertexValid) {
        rejected.push({ mp: mp, category: 'INVALID_VERTEX_DATA', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var verticesEnd = verticesStart + vertexCount * 12;
      var gapStart = verticesEnd;
      if (gapStart + 16 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_GAP', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var gap = [
        dv.getUint32(gapStart, true), dv.getUint32(gapStart + 4, true),
        dv.getUint32(gapStart + 8, true), dv.getUint32(gapStart + 12, true),
      ];
      if (gap[0] !== 12 || gap[1] !== 100 || gap[2] !== 2 || gap[3] !== vertexCount) {
        rejected.push({ mp: mp, category: 'INVALID_GAP', ec: edgeCount, vc: vertexCount, gap: gap });
        continue;
      }

      var normalsStart = gapStart + 16;
      var normalsEnd = normalsStart + vertexCount * 12;
      if (normalsEnd > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_NORMALS', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var normals = new Float32Array(vertexCount * 3);
      var normalsOk = true;
      for (var ni = 0; ni < vertexCount; ni++) {
        var noff = normalsStart + ni * 12;
        var nx = dv.getFloat32(noff, true);
        var ny = dv.getFloat32(noff + 4, true);
        var nz = dv.getFloat32(noff + 8, true);
        var mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (Math.abs(mag - 1.0) > NORMAL_TOLERANCE) { normalsOk = false; break; }
        normals[ni * 3] = nx; normals[ni * 3 + 1] = ny; normals[ni * 3 + 2] = nz;
      }
      if (!normalsOk) {
        rejected.push({ mp: mp, category: 'INVALID_NORMALS', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var block1Start = normalsEnd;
      if (block1Start + 16 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_B1_HEADER', ec: edgeCount, vc: vertexCount });
        continue;
      }

      var b1Header = [
        dv.getUint32(block1Start, true), dv.getUint32(block1Start + 4, true),
        dv.getUint32(block1Start + 8, true), dv.getUint32(block1Start + 12, true),
      ];
      if (b1Header[0] !== 4 || b1Header[1] !== 8 || b1Header[2] !== 2) {
        rejected.push({ mp: mp, category: 'INVALID_B1_HEADER_SHAPE', ec: edgeCount, vc: vertexCount, b1Header: b1Header });
        continue;
      }

      var N = b1Header[3]; // Block1 body length, per INV-005 -- NOT block1Start+0 (the v0.4.4 bug)
      if (N < 1 || N > 500000) {
        rejected.push({ mp: mp, category: 'INVALID_B1_LEN', ec: edgeCount, vc: vertexCount, b1Len: N });
        continue;
      }
      if (block1Start + 16 + N * 4 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_B1_BODY', ec: edgeCount, vc: vertexCount, b1Len: N });
        continue;
      }

      var b1Body = new Uint32Array(N);
      for (var bi = 0; bi < N; bi++) {
        b1Body[bi] = dv.getUint32(block1Start + 16 + bi * 4, true);
      }

      // CORRECTED (v0.4.5) offset formula -- see module header comment.
      var block2Start = block1Start + (N + 4) * 4;

      if (block2Start + 16 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_B2_HEADER', ec: edgeCount, vc: vertexCount, b1Len: N });
        continue;
      }

      var b2Header = [
        dv.getUint32(block2Start, true), dv.getUint32(block2Start + 4, true),
        dv.getUint32(block2Start + 8, true), dv.getUint32(block2Start + 12, true),
      ];
      if (b2Header[0] !== 4 || b2Header[1] !== 8 || b2Header[2] !== 2) {
        rejected.push({ mp: mp, category: 'INVALID_B2_HEADER_SHAPE', ec: edgeCount, vc: vertexCount, b1Len: N, b2Header: b2Header });
        continue;
      }

      var M = b2Header[3]; // secCount / Block2 body length
      if (M < 1 || M > 100000) {
        rejected.push({ mp: mp, category: 'INVALID_B2_LEN', ec: edgeCount, vc: vertexCount, b1Len: N, b2Len: M });
        continue;
      }
      if (block2Start + 16 + M * 4 > dl.length) {
        rejected.push({ mp: mp, category: 'OVERFLOW_B2_BODY', ec: edgeCount, vc: vertexCount, b1Len: N, b2Len: M });
        continue;
      }

      var b2Body = new Uint32Array(M);
      for (var b2i = 0; b2i < M; b2i++) {
        b2Body[b2i] = dv.getUint32(block2Start + 16 + b2i * 4, true);
      }

      // INV-016: b1len = 2 * (vertexCount - sectionCount)
      var expectedB1Len = 2 * (vertexCount - M);
      if (N !== expectedB1Len) {
        rejected.push({ mp: mp, category: 'INV016_FAIL', ec: edgeCount, vc: vertexCount, b1Len: N, expectedB1Len: expectedB1Len, secCount: M });
        continue;
      }

      // INV-017: ONE-delimited section body token counts == Block2[i] - 1.
      // Splitting algorithm matches v0.4.2a/audit_v042a.js and
      // v0.4.5/exp024_rejected_candidate_audit_corrected.js: a ONE closes
      // the current section (if non-empty) and starts a new one; any
      // trailing partial section after the last ONE is also a section.
      var sectionLens = [];
      var cur = 0;
      for (var si = 0; si < b1Body.length; si++) {
        if (b1Body[si] === 1) {
          if (cur > 0) sectionLens.push(cur);
          cur = 0;
        } else {
          cur++;
        }
      }
      if (cur > 0) sectionLens.push(cur);

      var inv017Pass = sectionLens.length === b2Body.length;
      if (inv017Pass) {
        for (var li = 0; li < sectionLens.length; li++) {
          if (sectionLens[li] !== b2Body[li] - 1) { inv017Pass = false; break; }
        }
      }
      if (!inv017Pass) {
        rejected.push({ mp: mp, category: 'INV017_FAIL', ec: edgeCount, vc: vertexCount, b1Len: N, b2Len: M, sectionLensCount: sectionLens.length });
        continue;
      }

      // INV-018: sum(Block2) = b1len
      var b2Sum = 0;
      for (var si2 = 0; si2 < b2Body.length; si2++) b2Sum += b2Body[si2];
      if (b2Sum !== N) {
        rejected.push({ mp: mp, category: 'INV018_FAIL', ec: edgeCount, vc: vertexCount, b1Len: N, b2Len: M, b2Sum: b2Sum });
        continue;
      }

      // --- HYPOTHESIS, not a verified invariant: sequential loop
      // segmentation. INV-007 only proves the decoded loop sizes SUM to
      // vertexCount; it does not establish vertex-to-loop membership. This
      // labels the assumption explicitly so downstream (viewer) code and
      // any consumer of this data cannot mistake it for a verified fact.
      var loopSizes = [];
      var loopSizeSum = 0;
      for (var lsi = 0; lsi < b2Body.length; lsi++) {
        var loopSize = (b2Body[lsi] + 2) / 2; // INV-007
        loopSizes.push(loopSize);
        loopSizeSum += loopSize;
      }
      var loopSumMatchesVertexCount = loopSizeSum === vertexCount; // sanity re-check of INV-007 on this face

      faces.push({
        // --- source offsets (all faces get these, per requirement) ---
        markerOffset: mp,
        faceStartOffset: faceStartOffset,
        verticesStart: verticesStart,
        gapStart: gapStart,
        normalsStart: normalsStart,
        block1Start: block1Start,
        block2Start: block2Start,

        // --- established, verified data ---
        edgeCount: edgeCount,
        vertexCount: vertexCount,
        vertices: vertices,     // Float32Array, length vertexCount*3, xyz per vertex
        normals: normals,       // Float32Array, length vertexCount*3, xyz per vertex
        gap: gap,
        b1Header: b1Header,
        b1Len: N,
        b1Body: b1Body,         // raw Block1 body, Uint32Array
        b2Header: b2Header,
        secCount: M,            // Block2 body length / section count (INV-006/009)
        b2Body: b2Body,         // raw Block2 body, Uint32Array
        sectionLens: sectionLens, // ONE-delimited section token counts (INV-017)

        // --- HYPOTHESIS data, explicitly labeled, not verified ---
        loopModel: 'sequential-assumed',
        loopSizes: loopSizes,               // decoded via INV-007 (raw+2)/2, order = Block2 order
        loopSumMatchesVertexCount: loopSumMatchesVertexCount,
      });
    }

    return { faces: faces, rejected: rejected };
  }

  // ---------------------------------------------------------------------
  // Top-level entry point. Handles format detection only; does not
  // implement OLE2 parsing (out of scope, reported as a clear error).
  // ---------------------------------------------------------------------

  function parseSLDPRT(buffer, inflateRaw, inflateZlib) {
    var result = {
      format: null,
      displayListsLength: 0,
      faces: [],
      rejected: [],
      errors: [],
      warnings: [],
      stats: null,
    };

    var buf = toUint8(buffer);

    if (isOLE2(buf)) {
      result.format = 'OLE2 (legacy, SW2000-era)';
      result.errors.push(
        'This file uses the legacy OLE2 compound-document container. ' +
        'This parser (v0.1) only supports the modern openswx-based container ' +
        '(the format validated through v0.4.6 of the research). OLE2 support ' +
        'is out of scope for this prototype -- see knowledge/RESEARCH_DASHBOARD.md ' +
        '"Current Corpus" table and knowledge/FORMAT_TIMELINE.md.'
      );
      return result;
    }

    result.format = 'openswx (modern, SW2015+)';

    var dl;
    try {
      dl = findDisplayLists(buf, inflateRaw, inflateZlib);
    } catch (e) {
      result.errors.push('Failed while decompressing openswx container: ' + e.message);
      return result;
    }

    if (!dl) {
      result.errors.push(
        'No Contents/DisplayLists stream found (or it failed the [1,1] header ' +
        'check from INV-001). This file may use an unrecognized container variant.'
      );
      return result;
    }

    result.displayListsLength = dl.length;

    var extraction;
    try {
      extraction = extractFaces(dl);
    } catch (e) {
      result.errors.push('Face extraction failed: ' + e.message);
      return result;
    }

    result.faces = extraction.faces;
    result.rejected = extraction.rejected;

    var rejectByCategory = {};
    for (var i = 0; i < extraction.rejected.length; i++) {
      var cat = extraction.rejected[i].category;
      rejectByCategory[cat] = (rejectByCategory[cat] || 0) + 1;
    }

    result.stats = {
      totalCandidates: extraction.faces.length + extraction.rejected.length,
      validFaces: extraction.faces.length,
      rejectedCandidates: extraction.rejected.length,
      rejectByCategory: rejectByCategory,
    };

    if (extraction.faces.length === 0) {
      result.warnings.push('No faces passed validation. See rejected-candidate breakdown for why.');
    }

    return result;
  }

  return {
    // constants
    REJECT_STAGES: REJECT_STAGES,
    NORMAL_TOLERANCE: NORMAL_TOLERANCE,
    // low level
    findAll: findAll,
    isOLE2: isOLE2,
    // openswx
    decompressOpenSX: decompressOpenSX,
    findDisplayLists: findDisplayLists,
    // face extraction
    extractFaces: extractFaces,
    // top level
    parseSLDPRT: parseSLDPRT,
  };
});
