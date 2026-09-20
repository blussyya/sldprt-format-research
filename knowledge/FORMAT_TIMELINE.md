# Format Timeline

Project-wide version and container timeline. This is a working model, not a vendor specification.

Source migrated from `v0.3.5/docs/research/FORMAT_TIMELINE.md`.

---

## SLDPRT v1: SW 2000 And Earlier

**Status**: Hypothesis / Partial Decode

**Evidence**:

- Uses OLE2 compound-document container.
- Contains `DisplayLists` and `DisplayLists__Zip` streams in tested files.
- Current parser can perform basic vertex extraction.

**Files tested**: `SW2000-s01.SLDPRT`

**Faces/models tested**: 1 model; exact parsed face count not preserved in migration.

**Confidence**: Medium

**Date last updated**: 2026-06-27

---

## SLDPRT v2: Approx. SW 2015-2020

**Status**: Hypothesis / Partial Decode

**Evidence**:

- Uses openswx-like archive structure.
- Stream names appear encoded.
- Current tooling uses zlib raw inflate for content.
- Face blocks use DisplayLists layout with Block 1/2.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`

**Faces/models tested**: 107 parsed faces across 2 models.

**Confidence**: Medium-high for tested files, medium-low for date/version boundaries.

**Date last updated**: 2026-06-27

---

## SLDPRT v3: Approx. SW 2020+

**Status**: Hypothesis / Partial Decode

**Evidence**:

- Uses similar openswx-like archive structure to v2.
- Face block layout and Block 1/2 behavior match v2 in current corpus.

**Files tested**: `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 488 parsed faces across 2 models.

**Confidence**: Medium-high for tested files, medium-low for date/version boundaries.

**Date last updated**: 2026-06-27

---
### CORPUS EXTENSION NOTE (2026-07-10)

Files added to modern corpus since original documentation:
- `Headphone Stand.SLDPRT` (HEADPHONE): 62 faces. Contains `MeshData/Config-0-Mesh-27` stream (812,848 bytes) — not seen in v0.4.0 corpus. Stream role unknown.
- `distributor main boss rev a.SLDPRT` (DISTRIBUTOR): 51 faces. Standard openswx structure.
- `Pocket Wheel.SLDPRT` (POCKET): 400 faces. Largest single file in corpus. Standard openswx structure.
- `PTC GE8080-8.SLDPRT` (PTC): 126 faces. Contains `Config-0-FeatureBodies/LocalBodies` stream (62,836 bytes) — not seen in v0.4.0 corpus. Stream role unknown.

All new files use openswx format. OLE2 pipeline still not implemented.

---

## Cross-Version Observations

**Status**: Observation

**Evidence**:

| Feature | Older OLE2 corpus | Modern openswx-like corpus |
| --- | --- | --- |
| Container | OLE2 compound document | Custom archive-like structure |
| Stream naming | Plain text | Encoded stream names |
| Geometry stream | DisplayLists-related streams | `Contents/DisplayLists` |
| Face markers/layout | Partially decoded | Verified across 1,234 faces |
| Block 1/2 | Not project-wide verified | Verified across 1,234 faces (3 invariants) |
| MeshData stream | Not observed | Present in HEADPHONE (812KB) |
| FeatureBodies stream | Not observed | Present in PTC (62KB) |

**Files tested**: `SW2000-s01.SLDPRT`, BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 9 models total; 1,234 modern faces in aggregate.

**Confidence**: Medium

**Date last updated**: 2026-07-10
