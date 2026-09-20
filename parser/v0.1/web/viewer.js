/**
 * Parser v0.1 browser viewer logic.
 *
 * Uses window.SLDPRTParser (loaded from ../src/parser-core.js -- the SAME
 * file used by the Node CLI/tests, no logic is duplicated here) plus pako
 * for in-browser inflate and three.js for rendering.
 *
 * Everything below this point is presentation only: mesh building for
 * display, three.js scene setup, UI wiring, and the (clearly labeled)
 * sequential-loop-segmentation rendering hypothesis. No parsing/validation
 * logic lives in this file.
 */

(function () {
  'use strict';

  function inflateRaw(bytes) {
    return pako.inflateRaw(bytes);
  }
  function inflateZlib(bytes) {
    return pako.inflate(bytes);
  }

  // --- State ---
  var currentResult = null;   // last SLDPRTParser.parseSLDPRT() result
  var currentFileName = '';
  var renderData = null;      // built by buildRenderData()
  var selectedFaceIndex = -1;

  var scene, camera, renderer, controls;
  var solidMesh, wireGroup, pointsObj, normalLinesObj, highlightMesh;
  var animationId = null, autoRotate = false;

  // --- DOM refs ---
  var $ = function (id) { return document.getElementById(id); };
  var dropZone = $('drop-zone'), fileInput = $('file-input');
  var statusEl = $('status'), errorBox = $('error-box');
  var panelContent = $('panel-content');
  var viewerEl = $('viewer'), viewerOverlay = $('viewer-overlay'), hud = $('viewer-hud');

  // ---------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------

  function processFile(file) {
    statusEl.textContent = 'Reading ' + file.name + '...';
    errorBox.className = '';
    errorBox.innerHTML = '';
    panelContent.style.display = 'none';

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var buf = new Uint8Array(e.target.result);
        statusEl.textContent = 'Parsing ' + file.name + '...';
        var result = window.SLDPRTParser.parseSLDPRT(buf, inflateRaw, inflateZlib);
        currentResult = result;
        currentFileName = file.name;
        onParsed(file.name, result);
      } catch (err) {
        showFatalError('Unexpected parser error: ' + err.message);
        statusEl.textContent = 'Failed';
      }
    };
    reader.onerror = function () {
      showFatalError('Could not read file: ' + file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function showFatalError(msg) {
    errorBox.className = 'show';
    errorBox.innerHTML = '<div class="err-line">' + escapeHtml(msg) + '</div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function onParsed(fileName, result) {
    if (result.errors.length > 0) {
      errorBox.className = 'show';
      errorBox.innerHTML = result.errors.map(function (e) {
        return '<div class="err-line">' + escapeHtml(e) + '</div>';
      }).join('');
      statusEl.textContent = 'Parse failed for ' + fileName;
      hud.textContent = 'Parse failed -- see errors in the sidebar';
      clearScene();
      return;
    }

    statusEl.textContent = 'Parsed ' + fileName;
    panelContent.style.display = 'block';

    // Warnings (non-fatal)
    var wd = $('warnings');
    wd.innerHTML = '';
    result.warnings.forEach(function (w) {
      wd.innerHTML += '<div class="warning-line">' + escapeHtml(w) + '</div>';
    });

    renderStats(fileName, result);
    renderData = buildRenderData(result.faces);
    renderFaceList(result.faces);
    renderRejectedPanel(result);
    selectFace(-1);
    buildScene(result.faces, renderData);
  }

  // ---------------------------------------------------------------------
  // Stats / panels
  // ---------------------------------------------------------------------

  function renderStats(fileName, result) {
    $('stat-file').textContent = fileName;
    $('stat-format').textContent = result.format;
    $('stat-dl-size').textContent = result.displayListsLength.toLocaleString() + ' bytes';
    $('stat-total').textContent = result.stats.totalCandidates.toLocaleString();
    $('stat-valid').textContent = result.stats.validFaces.toLocaleString();
    $('stat-rejected').textContent = result.stats.rejectedCandidates.toLocaleString();
  }

  function renderFaceList(faces) {
    $('face-count-label').textContent = faces.length;
    var html = '';
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      html += '<div class="list-item" data-face-index="' + i + '">#' + i +
        '  mp=0x' + f.markerOffset.toString(16) +
        '  ec=' + f.edgeCount + ' vc=' + f.vertexCount + ' sec=' + f.secCount + '</div>';
    }
    var listEl = $('face-list');
    listEl.innerHTML = html || '<div class="list-item">(no valid faces)</div>';
    listEl.querySelectorAll('[data-face-index]').forEach(function (el) {
      el.addEventListener('click', function () {
        selectFace(parseInt(el.getAttribute('data-face-index'), 10));
      });
    });
  }

  function renderRejectedPanel(result) {
    $('reject-count-label').textContent = result.stats.rejectedCandidates;
    var catHtml = '';
    var cats = Object.keys(result.stats.rejectByCategory).sort(function (a, b) {
      return result.stats.rejectByCategory[b] - result.stats.rejectByCategory[a];
    });
    cats.forEach(function (cat) {
      catHtml += '<div class="reject-cat-row"><span class="cat">' + escapeHtml(cat) +
        '</span><span>' + result.stats.rejectByCategory[cat] + '</span></div>';
    });
    $('reject-breakdown').innerHTML = catHtml || '<div class="reject-cat-row"><span class="cat">(none)</span></div>';

    // Individual rejected entries -- capped for DOM performance on large files.
    var listEl = $('reject-list');
    var cap = 500;
    var shown = result.rejected.slice(0, cap);
    var html = shown.map(function (r) {
      return '<div class="list-item rejected">mp=0x' + r.mp.toString(16) + '  ' + escapeHtml(r.category) +
        (r.ec !== undefined && r.ec !== null ? '  ec=' + r.ec : '') +
        (r.vc !== undefined && r.vc !== null ? '  vc=' + r.vc : '') + '</div>';
    }).join('');
    if (result.rejected.length > cap) {
      html += '<div class="list-item rejected">... and ' + (result.rejected.length - cap) + ' more (not rendered, see breakdown above)</div>';
    }
    listEl.innerHTML = html || '<div class="list-item rejected">(no rejected candidates)</div>';
  }

  // ---------------------------------------------------------------------
  // Mesh building (rendering hypothesis lives ONLY here -- see
  // #hypothesis-note in index.html and OQ-019 in the knowledge base).
  // ---------------------------------------------------------------------

  function buildRenderData(faces) {
    var positions = [];
    var normals = [];
    var triToFace = [];       // triangle index -> face array index
    var faceTriRanges = [];   // per face: [startTri, endTri)
    var faceUnrenderableLoops = []; // per face: count of loops that couldn't be triangulated
    var totalUnrenderable = 0;

    function pushVert(verts, norms, i) {
      positions.push(verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]);
      normals.push(norms[i * 3], norms[i * 3 + 1], norms[i * 3 + 2]);
    }
    function pushTri(verts, norms, i0, i1, i2) {
      pushVert(verts, norms, i0); pushVert(verts, norms, i1); pushVert(verts, norms, i2);
    }

    for (var fi = 0; fi < faces.length; fi++) {
      var face = faces[fi];
      var verts = face.vertices, norms = face.normals;
      var vc = face.vertexCount;
      var triStart = triToFace.length;
      var vOffset = 0;
      var skipped = 0;

      for (var li = 0; li < face.loopSizes.length; li++) {
        var ls = face.loopSizes[li];
        var valid = Number.isInteger(ls) && ls >= 3 && (vOffset + ls) <= vc;
        if (valid) {
          for (var i = 1; i < ls - 1; i++) {
            pushTri(verts, norms, vOffset, vOffset + i, vOffset + i + 1);
            triToFace.push(fi);
          }
          vOffset += ls;
        } else {
          skipped++;
          // Cannot reliably determine how many vertices this malformed loop
          // consumed -- stop triangulating this face rather than guess.
          break;
        }
      }

      faceTriRanges.push([triStart, triToFace.length]);
      faceUnrenderableLoops.push(skipped);
      totalUnrenderable += skipped;
    }

    $('stat-tris').textContent = triToFace.length.toLocaleString();
    $('stat-unrenderable').textContent = totalUnrenderable.toLocaleString();

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      triToFace: triToFace,
      faceTriRanges: faceTriRanges,
      faceUnrenderableLoops: faceUnrenderableLoops,
    };
  }

  function buildPointsAndNormalLines(faces, normalLen) {
    var pts = [];
    var lines = [];
    for (var fi = 0; fi < faces.length; fi++) {
      var face = faces[fi];
      var verts = face.vertices, norms = face.normals;
      for (var i = 0; i < face.vertexCount; i++) {
        var x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
        var nx = norms[i * 3], ny = norms[i * 3 + 1], nz = norms[i * 3 + 2];
        pts.push(x, y, z);
        lines.push(x, y, z, x + nx * normalLen, y + ny * normalLen, z + nz * normalLen);
      }
    }
    return { points: new Float32Array(pts), lines: new Float32Array(lines) };
  }

  function computeBounds(faces) {
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (var fi = 0; fi < faces.length; fi++) {
      var v = faces[fi].vertices;
      for (var i = 0; i < v.length; i += 3) {
        if (v[i] < min[0]) min[0] = v[i];
        if (v[i + 1] < min[1]) min[1] = v[i + 1];
        if (v[i + 2] < min[2]) min[2] = v[i + 2];
        if (v[i] > max[0]) max[0] = v[i];
        if (v[i + 1] > max[1]) max[1] = v[i + 1];
        if (v[i + 2] > max[2]) max[2] = v[i + 2];
      }
    }
    if (!isFinite(min[0])) { min = [0, 0, 0]; max = [1, 1, 1]; }
    return {
      min: min, max: max,
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    };
  }

  // ---------------------------------------------------------------------
  // three.js scene
  // ---------------------------------------------------------------------

  function clearScene() {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (renderer) { renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
    scene = camera = renderer = controls = null;
    solidMesh = wireGroup = pointsObj = normalLinesObj = highlightMesh = null;
  }

  function buildScene(faces, rd) {
    clearScene();
    hud.textContent = faces.length + ' face(s) parsed. Click a face to select it.';

    var w = viewerEl.clientWidth, h = viewerEl.clientHeight;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e18);

    var bounds = computeBounds(faces);
    var maxDim = Math.max(bounds.size[0], bounds.size[1], bounds.size[2]) || 1;
    var camDist = maxDim * 2.2;

    camera = new THREE.PerspectiveCamera(45, w / h, maxDim / 10000, camDist * 100);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    viewerEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;

    var cx = bounds.center[0], cy = bounds.center[1], cz = bounds.center[2];

    var ambient = new THREE.AmbientLight(0x40405a);
    scene.add(ambient);
    var dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(camDist * 0.5, camDist, camDist * 0.3);
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0x8899ff, 0.35);
    fill.position.set(-camDist * 0.3, -camDist * 0.2, -camDist * 0.5);
    scene.add(fill);

    // Solid mesh
    if (rd.positions.length > 0) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(rd.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(rd.normals, 3));
      var mat = new THREE.MeshPhongMaterial({ color: 0x5b9bd5, specular: 0x223344, shininess: 40, side: THREE.DoubleSide });
      solidMesh = new THREE.Mesh(geo, mat);
      solidMesh.position.set(-cx, -cy, -cz);
      scene.add(solidMesh);

      var wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
      var wireGeo = new THREE.WireframeGeometry(geo);
      var wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.position.set(-cx, -cy, -cz);
      wireGroup = new THREE.Group();
      wireGroup.add(wire);
      wireGroup.visible = $('chk-wireframe').checked;
      scene.add(wireGroup);
    }

    // Vertices / normals (raw parsed data, independent of triangulation success)
    var normalLen = maxDim * 0.02;
    var pn = buildPointsAndNormalLines(faces, normalLen);

    var ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(pn.points, 3));
    var ptMat = new THREE.PointsMaterial({ color: 0xffe066, size: Math.max(maxDim * 0.004, 0.002), sizeAttenuation: true });
    pointsObj = new THREE.Points(ptGeo, ptMat);
    pointsObj.position.set(-cx, -cy, -cz);
    pointsObj.visible = $('chk-vertices').checked;
    scene.add(pointsObj);

    var nlGeo = new THREE.BufferGeometry();
    nlGeo.setAttribute('position', new THREE.BufferAttribute(pn.lines, 3));
    var nlMat = new THREE.LineBasicMaterial({ color: 0x6de88a, transparent: true, opacity: 0.6 });
    normalLinesObj = new THREE.LineSegments(nlGeo, nlMat);
    normalLinesObj.position.set(-cx, -cy, -cz);
    normalLinesObj.visible = $('chk-normals').checked;
    scene.add(normalLinesObj);

    var axesSize = maxDim * 0.15;
    var axes = new THREE.AxesHelper(axesSize);
    axes.position.set(-cx, -cy, -cz);
    scene.add(axes);

    camera.position.set(cx, cy + maxDim * 0.3, cz + camDist);
    camera.lookAt(cx, cy, cz);
    controls.target.set(cx, cy, cz);
    controls.update();

    scene.userData.offset = [-cx, -cy, -cz];

    if (solidMesh) solidMesh.visible = $('chk-solid').checked;

    function animate() {
      animationId = requestAnimationFrame(animate);
      if (autoRotate) {
        [solidMesh, wireGroup, pointsObj, normalLinesObj, highlightMesh].forEach(function (o) {
          if (o) o.rotation.y += 0.005;
        });
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }

  // ---------------------------------------------------------------------
  // Face selection
  // ---------------------------------------------------------------------

  function selectFace(index) {
    selectedFaceIndex = index;

    document.querySelectorAll('#face-list .list-item').forEach(function (el) {
      el.classList.toggle('selected', parseInt(el.getAttribute('data-face-index'), 10) === index);
    });

    if (highlightMesh) {
      scene && scene.remove(highlightMesh);
      highlightMesh = null;
    }

    var metaEl = $('face-meta');
    if (index < 0 || !currentResult || !currentResult.faces[index]) {
      metaEl.style.display = 'none';
      return;
    }

    var face = currentResult.faces[index];
    metaEl.style.display = 'block';
    $('fm-marker').textContent = '0x' + face.markerOffset.toString(16) + ' (' + face.markerOffset + ')';
    $('fm-ec').textContent = face.edgeCount;
    $('fm-vc').textContent = face.vertexCount;
    $('fm-verts-off').textContent = '0x' + face.verticesStart.toString(16);
    $('fm-gap-off').textContent = '0x' + face.gapStart.toString(16);
    $('fm-normals-off').textContent = '0x' + face.normalsStart.toString(16);
    $('fm-b1-off').textContent = '0x' + face.block1Start.toString(16);
    $('fm-b1-len').textContent = face.b1Len;
    $('fm-b2-off').textContent = '0x' + face.block2Start.toString(16);
    $('fm-sec-count').textContent = face.secCount;
    $('fm-loop-sizes').textContent = '[' + face.loopSizes.join(', ') + ']';

    var range = renderData ? renderData.faceTriRanges[index] : null;
    var triCount = range ? (range[1] - range[0]) : 0;
    $('fm-tri-count').textContent = triCount + (renderData && renderData.faceUnrenderableLoops[index] > 0 ?
      ' (' + renderData.faceUnrenderableLoops[index] + ' loop(s) unrenderable)' : '');

    if (range && range[1] > range[0] && renderData.positions.length > 0 && scene) {
      // subarray by triangle range: each triangle = 3 verts * 3 floats = 9 floats
      var floatStart = range[0] * 9;
      var floatEnd = range[1] * 9;
      var hlPositions = renderData.positions.subarray(floatStart, floatEnd);
      var hlNormals = renderData.normals.subarray(floatStart, floatEnd);

      var hlGeo = new THREE.BufferGeometry();
      hlGeo.setAttribute('position', new THREE.BufferAttribute(hlPositions, 3));
      hlGeo.setAttribute('normal', new THREE.BufferAttribute(hlNormals, 3));
      var hlMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      hlMat.polygonOffset = true; hlMat.polygonOffsetFactor = -2; hlMat.polygonOffsetUnits = -2;
      highlightMesh = new THREE.Mesh(hlGeo, hlMat);
      var off = scene.userData.offset || [0, 0, 0];
      highlightMesh.position.set(off[0], off[1], off[2]);
      scene.add(highlightMesh);
    }
  }

  // Raycasting for click-to-select on the 3D mesh
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();

  function onViewerClick(e) {
    if (!solidMesh || !renderData) return;
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObject(solidMesh);
    if (hits.length > 0) {
      var triIndex = hits[0].faceIndex;
      var faceIndex = renderData.triToFace[triIndex];
      if (faceIndex !== undefined) selectFace(faceIndex);
    }
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------

  $('chk-solid').addEventListener('change', function (e) { if (solidMesh) solidMesh.visible = e.target.checked; });
  $('chk-wireframe').addEventListener('change', function (e) { if (wireGroup) wireGroup.visible = e.target.checked; });
  $('chk-vertices').addEventListener('change', function (e) { if (pointsObj) pointsObj.visible = e.target.checked; });
  $('chk-normals').addEventListener('change', function (e) { if (normalLinesObj) normalLinesObj.visible = e.target.checked; });
  $('chk-auto-rotate').addEventListener('change', function (e) { autoRotate = e.target.checked; });

  window.addEventListener('resize', function () {
    if (!renderer || !camera) return;
    var w = viewerEl.clientWidth, h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  dropZone.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    e.target.value = '';
  });
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) { e.preventDefault(); });
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });
  viewerEl.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); viewerOverlay.classList.add('active'); });
  viewerEl.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); viewerOverlay.classList.remove('active'); });
  viewerEl.addEventListener('drop', function (e) {
    e.preventDefault(); e.stopPropagation(); viewerOverlay.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });
  viewerEl.addEventListener('click', onViewerClick);

  if (typeof pako === 'undefined') {
    showFatalError('pako failed to load from CDN (needed for in-browser inflate). Check your internet connection.');
  }
  if (typeof THREE === 'undefined') {
    showFatalError('three.js failed to load from CDN. Check your internet connection.');
  }
  if (typeof window.SLDPRTParser === 'undefined') {
    showFatalError('parser-core.js failed to load (expected at ../src/parser-core.js relative to web/index.html).');
  }
})();
