# 1. The container

A `.SLDPRT` comes in one of two containers. Everything else in the format sits in named streams
inside it.

| | modern | 2011 (legacy) |
|---|---|---|
| SolidWorks versions in the corpus | 2015 and later (DisplayLists versions 13000–17000) | 2011 (files older than that are on [page 5](5-pre-2011.md)) |
| how to tell | bytes 4–7 are `00 00 00 04` (45 of 45 files) | the OLE2 signature `D0 CF 11 E0 A1 B1 1A E1` |
| stream names | stored rotated, undone with a bit rotation | plain UTF-16 in the OLE directory |
| compression | raw DEFLATE per stream, with a CRC-32 | zlib inside a small frame |
| reference reader | [`modern.js`][modern.js] | [`ole.js`][ole.js] |

Bytes 0–3 of a modern file are a key that varies between files, so you have to look at offset 4, not 0.
A second opinion, if you want one: every modern file in the corpus also contains the nine bytes
`34 f6 e6 47 56 e6 47 37 f2` early in the file (first occurrence at offsets 39–614, checked on
all 45 modern files), and none of the 28 legacy and pre-2011 files contains it anywhere at all.
Those nine bytes are `Contents/` with each byte rotated, so it's a containment test, not a signature.

## Modern container

### Stream headers

Each stream is a 30-byte header, then the stream's name, then the compressed data. The fields sit
exactly where a ZIP local file header puts them, apart from the first four bytes.

| offset | type | field | checked on |
|---|---|---|---|
| +0 | u32 | the file's local-header signature, selected by bytes 0–3 ([the directory](#the-directory)) | |
| +4 | u16 ×3 | `20`, `6`, `8` (deflate). The 6-byte pattern `14 00 06 00 08 00` a scan looks for | |
| +14 | u32 | **CRC-32 of the inflated stream** | 1,730 of 1,730 named streams, 0 mismatches |
| +18 | u32 | compressed size | |
| +22 | u32 | inflated size | 1,730 of 1,730 |
| +26 | u16 | name length | |
| +28 | u16 | extra length, always 0 | 1,730 of 1,730 |
| +30 | bytes | the name, each byte rotated left by `(file byte 7) & 7` bits | byte 7 is `4` in 45 of 45 files |
| +30+n | bytes | raw DEFLATE data | |

Everything is little-endian. The counts are over the 45 modern files.

### The directory

From byte 8 on, the file is a ZIP archive in disguise ([EXP-112][exp112]). After the stream
headers and data comes a central directory, then an end record, with their fields at the ZIP
positions. Three things differ from ZIP:

- **Signatures.** The local header, the central record and the end record each start with a
  per-file value where ZIP has `PK\3\4`, `PK\1\2` and `PK\5\6`. The value at stream header +0
  is the first of the three.
- **Offsets are counted from byte 8**, the end of the file header.
- **Filler.** Blocks that imitate headers, central records and end records sit before the first
  stream (255–900 bytes), between some streams (85–100 bytes, one size per file), after the
  directory and around the end record. They reuse real stream names with made-up sizes, and they
  contain the 6-byte pattern, which is where most fake scan hits come from.

A central record:

| offset | type | field |
|---|---|---|
| +0 | u32 | per-file signature, not the local header's |
| +4 | u16 ×4 | `0`, `20`, `6`, `8` |
| +12 | u32 | the same 4 bytes as local header +10. Not decoded; not a plain DOS time/date |
| +16 | u32 ×3 | CRC-32, compressed size, inflated size |
| +28 | u16 ×3 | name length, extra length (0), comment length (0) |
| +36 | u16 | 1 on the XML streams, 0 elsewhere |
| +42 | u32 | the stream header's offset, minus 8 |
| +46 | bytes | the name, rotated like the header's |

The end record is 22 bytes: a per-file signature, 4 zero bytes, the entry count twice (u16), the
directory's size (u32, up to the end record, filler included), the directory's offset minus 8
(u32), and a zero u16.

**Finding it without the signatures.** A file holds 10 to 17 shapes that look like an end record.
Exactly one sits at `8 + offset + size`, and only its directory walks: `count` records with one
signature, each pointing at a header that repeats its CRC, sizes and name. That holds in 181 of
181 modern files. The directory lists every stream: 7,895 entries in the 178 distinct files
(7,374 nonempty, 521 empty), all inflating to their size and passing CRC-32, in increasing
offset order, no name twice. A scan for headers finds no valid stream outside it.

So read the directory, and scan only when a file has none (a truncated file). If you do scan:

- Fake hits decode to names you can't print, or reuse a real name with sizes that don't inflate.
  Accept a header only if its data inflates to exactly the size at +22 and the CRC matches.
- Don't throw hits out by the size of the CRC field. An earlier reference reader skipped
  anything below 65536, which would also skip a real stream whose CRC-32 happens to be small.

**The key.** Bytes 0–3 select the three signatures: 15 pairs of unrelated files share them, and
in all 15 the signatures match too. That collision rate puts the number of keys near 1,000. 162
of the 163 keys seen are four successive `rand() & 0xff` outputs of the Microsoft C runtime. How
the signatures follow from the key isn't known. They aren't an XOR, rotate or linear map of it.

Other public projects cover this layer too (see [prior art](../research/history.md#prior-art)).

### What the streams are

Unpacking a modern file gives you 37–48 named streams. These are in all 21 original modern files:

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

Some files have these too: `Contents/Config-0-GhostPartition` (18 of 21),
`Contents/PMISemanticDataDB` (17 of 21), and `Config-0-FeatureBodies/LocalBodies` (1 of 21, the
imported body in PTC GE8080-8).

`Config-0` is configuration 0. A part with several configurations has a `Config-N-…` set for each
one that was rebuilt, and the N can be anything (21, 1885 and 5907 turn up in vendor parts).
Which one was active when the file was saved is told by `Header2`: from about SolidWorks 2020 on,
it's a copy of that configuration's `Contents/Config-N-ModelHeader`. After a rename the document
name inside it differs, and nothing else does ([page 3](3-parasolid-body.md#which-body-is-the-part)).

The ones that matter for geometry:

| stream | holds | see |
|---|---|---|
| `Contents/DisplayLists` | the saved mesh and one surface record per face | [page 2](2-display-mesh.md) |
| `Contents/Config-N-Partition` | the Parasolid body, for configuration N | [page 3](3-parasolid-body.md) |
| `Contents/Config-0-GhostPartition` | wire and sheet bodies: feature inputs, never the solid | [page 3](3-parasolid-body.md#the-other-partition-streams) |
| `Config-N-FeatureBodies/LocalBodies` | imported bodies, one per section | [page 3](3-parasolid-body.md#which-body-is-the-part) |
| `Contents/Config-0-ResolvedFeatures` | the feature tree, plus small one-face Parasolid bodies | [open questions](../research/open-questions.md) |

In a modern file the stream really is called `Contents/DisplayLists`. No modern file has a `__ZLB`
or `__Zip` suffix on it. Those belong to the older containers.

### DisplayLists version

The DisplayLists version is in the **name** of a stream that contains `_DL_VERSION_<n>`. Over the
45 modern files:

| version | files | faces | rejected |
|---|---|---|---|
| 13000 | 2 | 107 | 0 |
| 14000 | 1 | 375 | 0 |
| 15000 | 39 | 355 | 0 |
| 16000 | 1 | 400 | 0 |
| 17000 | 2 | 177 | 0 |

One grammar reads all five, so across this range the version doesn't pick a layout.

The 122 modern parts in the online sample (public parts saved from 2015 to 2026,
[EXP-084][exp084]) widen that to 3800–19000, still with one grammar:

| version | files | faces | no faces |
|---|---|---|---|
| 3800, 4100, 5000, 7000 | 5 | 258 | 0 |
| 8000, 9000 | 12 | 528 | 0 |
| 10000, 11000, 12000 | 26 | 4,782 | 3 |
| 13000, 14000, 15000 | 32 | 2,632 | 7 |
| 16000, 17000 | 29 | 5,061 | 4 |
| 18000, 19000 | 18 | 3,931 | 0 |

The version is the release that last wrote the stream, which isn't always the one that last saved
the file. In all 175 modern files with a save History, the DisplayLists version is one of the
releases in that History. In 157 it's the last save; in 18 it's an earlier one, and the stream was
carried through the later saves unchanged. A part saved in 2024 that started in SolidWorks 95
carries 3800 that way. Re-saving doesn't always keep it: four parts re-saved in 2026 all got 19000,
and one saved as 2025 got 18000 ([EXP-085][exp085]). The "no faces" parts were all saved without
display data: either no DisplayLists stream at all, or one that holds only view settings
([page 2](2-display-mesh.md#parts-saved-without-display-data)).

## Legacy container (SolidWorks 2011)

The 2011 file is a normal Microsoft Compound File (CFB). The reference reader is strict about it:
it checks sector ranges, FAT and DIFAT bounds, chain cycles, stream lengths and mini-stream access,
handles CFB v3 and v4 headers (only v3 shows up in the corpus), and refuses anything it can't
account for instead of guessing. Inputs and unpacked streams are capped at 128 MiB.

The 25 SolidWorks 2011 models have `DisplayLists__ZLB` (25 of 25), `Config-0-Partition` (25 of 25)
and `Config-0-GhostPartition` (24 of 25), among others.

### The compressed-stream frame

`DisplayLists__ZLB` holds:

```
16-byte GUID 231dd571-da81-48a2-a858-98b21b89ef99
chunks, each:
  u32le inflated length
  u32le compressed length
  zlib member
8 zero bytes
```

That's the same frame a Parasolid partition section uses ([page 3](3-parasolid-body.md#section-frame)),
minus the size word in front: same GUID, same chunks, same eight zeros at the end. A mesh under
1 MiB is one chunk, so then the compressed length is the stream length − 32. Bigger ones come in
several; the 2013 head_back and head_face parts need them joined ([EXP-084][exp084]). The reference
reader rejects any other frame and checks each chunk's inflated length.

## What isn't read

The feature tree and the other MFC-serialised streams (`Config-0`, `Header`, `CMgr`,
`History`, `Definition`), in every version. Work on them has started, see
[open questions](../research/open-questions.md#feature-tree). `Biography` is read, see
[page 6](6-version-history.md#the-biography-stream).

[modern.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/modern.js
[ole.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/ole.js
[exp057]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_independent-verification-EXP057.md
[exp084]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP084.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md
[exp112]: https://github.com/blussyya/sldprt-research-dump/blob/validation/knowledge/evidence/2026-11-09_v0.5-EXP112.md
[exp095]: https://github.com/blussyya/sldprt-research-dump/blob/validation/knowledge/evidence/2026-11-05_v0.5-EXP095.md
[exp097]: https://github.com/blussyya/sldprt-research-dump/blob/validation/knowledge/evidence/2026-11-06_v0.5-EXP097.md
