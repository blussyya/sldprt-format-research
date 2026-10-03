# The container

A `.SLDPRT` is one of two containers. Everything else in the format lives in named streams
inside it.

| | modern | legacy |
|---|---|---|
| SolidWorks versions in the corpus | 2015+ (DisplayLists versions 13000–17000) | 2011, plus three older parts |
| how to tell | bytes 4–7 are `00 00 00 04` (45/45 files) | OLE2 signature `D0 CF 11 E0 A1 B1 1A E1` |
| stream names | stored rotated, decoded by a bit rotation | plain UTF-16 in the OLE directory |
| compression | raw DEFLATE per stream, CRC-32 checked | zlib inside a framed wrapper |
| reader | [`src/container/modern.js`](../../src/container/modern.js) | [`src/container/ole.js`](../../src/container/ole.js) |

Bytes 0–3 of a modern file differ in every file, so the discriminator sits at offset 4, not 0.

---

## Modern container

### Stream headers

Each stream is a 30-byte header, the stream name, then the compressed data. The field positions
coincide exactly with a ZIP local file header, except for the first four bytes:

| offset | type | field | evidence |
|---|---|---|---|
| +0 | u32 | per-file value, constant within a file, different in all 45 files; meaning unknown | |
| +4 | u16 ×3 | `20`, `6`, `8` (deflate) — the 6-byte pattern `14 00 06 00 08 00` the reader scans for | |
| +14 | u32 | **CRC-32 of the inflated stream** | 1,730 / 1,730 named streams, 0 mismatches |
| +18 | u32 | compressed size | used by the reader |
| +22 | u32 | inflated size | 1,730 / 1,730 |
| +26 | u16 | name length | used by the reader |
| +28 | u16 | extra length, always 0 | 1,730 / 1,730 |
| +30 | bytes | name, each byte rotated left by `(file byte 7) & 7` bits | byte 7 is `4` in 45 / 45 files |
| +30+n | bytes | raw DEFLATE data | |

All little-endian. Counts are over the 45 modern files and are re-checked by
`test/display.test.js` on every run.

**The scan finds false headers.** Discovery is a signature scan, not a directory walk, and the
6-byte pattern also occurs inside compressed data. Those false hits decode to non-printable names.
In the corpus, 1,465 spurious hits fail to inflate and 10 more fail their CRC, all with
non-printable names and none with a printable one
([EXP-057](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_independent-verification-EXP057.md)).
The reader therefore CRC-checks only printable names, and treats a printable-named stream that
inflates but fails its CRC as corruption: the parse stops with `CRC-32 mismatch in stream …`.

Two consequences worth knowing if you write your own reader:

- Accept a header only when the u32 at +14 is at least 65536 (this rejects small directory-like
  records that reuse a stream's name) and the compressed size is nonzero.
- The first occurrence of a name wins.

A directory structure almost certainly exists; it has not been decoded. Other public projects
document this layer in more detail (see [history](../history.md#prior-art)).

### What the streams are

Decompressing a modern file yields 37–48 named streams. Present in all 21 original modern files:

```
Contents/3DExperienceExchange2      Contents/CMgr             Contents/CMgrHdr2
Contents/CnfgObjs                   Contents/Config-0         Contents/Config-0-LWDATA
Contents/Config-0-ModelHeader       Contents/Config-0-Partition
Contents/Config-0-ResolvedFeatures  Contents/CusProps         Contents/Definition
Contents/DisplayLists               Contents/OleItems         Contents/eModelLic
Header2                             ModelStamps               Preview
PreviewPNG                          SwDocContentMgr/SwDocContentMgrInfo
ThirdPtyStore/VisualStates          [Content_Types].xml       _rels/.rels
docProps/…  swXmlContents/Features  swXmlContents/KeyWords
```

Partly present: `Contents/Config-0-GhostPartition` (18/21), `Contents/PMISemanticDataDB` (17/21),
`Config-0-FeatureBodies/LocalBodies` (1/21, the imported body of PTC GE8080-8).

The ones that matter for geometry:

| stream | holds | documented in |
|---|---|---|
| `Contents/DisplayLists` | the saved tessellation and a per-face surface record | [displaylists.md](displaylists.md) |
| `Contents/Config-0-Partition` | the native Parasolid B-rep | [parasolid.md](parasolid.md) |
| `Contents/Config-0-GhostPartition` | a second Parasolid body | [parasolid.md](parasolid.md#partition-streams) |
| `Config-0-FeatureBodies/LocalBodies` | an imported body (when present) | [parasolid.md](parasolid.md#which-body-is-the-part) |
| `Contents/Config-0-ResolvedFeatures` | small one-face Parasolid bodies | [open questions](../open-questions.md) |

The name `Contents/DisplayLists` is the file's own: no `__ZLB` or `__Zip` suffix occurs in any
modern file. Those suffixes belong to the legacy container.

### DisplayLists version

The declared DisplayLists version is carried in the **name** of a stream containing
`_DL_VERSION_<n>`. Over the 45 modern files:

| version | files | faces | rejected |
|---|---|---|---|
| 13000 | 2 | 107 | 0 |
| 14000 | 1 | 375 | 0 |
| 15000 | 39 | 355 | 0 |
| 16000 | 1 | 400 | 0 |
| 17000 | 2 | 177 | 0 |

One record grammar reads all five. The version does not select a layout across this range; it is
surfaced by `sldprt info`, and a value outside 13000–17000 is untested.

---

## Legacy container (OLE2)

The legacy file is a standard Microsoft Compound File (CFB). The reader is bounded and strict:
it validates sector ranges, FAT/DIFAT bounds, chain cycles, stream lengths and mini-stream
access, supports CFB v3 and v4 headers (only v3 occurs in the corpus), and refuses rather than
guesses. Inputs and decompressed streams are capped at 128 MiB.

Streams in the 25 SolidWorks 2011 models include `DisplayLists__ZLB` (25/25),
`Config-0-Partition` (25/25) and `Config-0-GhostPartition` (24/25).

### The compressed-stream wrapper

`DisplayLists__ZLB` holds:

```
16-byte GUID 231dd571-da81-48a2-a858-98b21b89ef99
u32le inflated length        (offset 16)
u32le compressed length      (offset 20)  == stream length − 32
zlib member                  (offset 24)
8 zero bytes
```

That is the same frame as a Parasolid partition section ([parasolid.md](parasolid.md#section-frame))
without the leading size word: same GUID, same length fields, same eight trailing zeros. The
reader rejects any other wrapper and checks the inflated length.

### What is not read

The three oldest parts in the corpus use different layouts and are refused with an explicit
error:

| file | streams of interest | result |
|---|---|---|
| `SW2000-s01.SLDPRT` | `DisplayLists__Zip`, no partition | `No legacy DisplayLists stream` |
| `chainwheel.sldprt` | `DisplayLists__Zip`, `Config-0-Body`, no partition | `No legacy DisplayLists stream` |
| `plate4.sldprt` | uncompressed `DisplayLists` with a different array layout, no partition | `No supported face records found` |
