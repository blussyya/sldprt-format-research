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

Bytes 0–3 of a modern file are different in every file, so you have to look at offset 4, not 0.
A second opinion, if you want one: every modern file in the corpus also contains the nine bytes
`34 f6 e6 47 56 e6 47 37 f2` early in the file (first occurrence at offsets 39–614, checked on
all 45 modern files), and none of the 28 legacy and pre-2011 files contains it anywhere at all.
That far out, it's a containment test, not a signature.

## Modern container

### Stream headers

Each stream is a 30-byte header, then the stream's name, then the compressed data. The fields sit
exactly where a ZIP local file header puts them, apart from the first four bytes.

| offset | type | field | checked on |
|---|---|---|---|
| +0 | u32 | a per-file value: the same within a file, different in all 45 files. Meaning unknown | |
| +4 | u16 ×3 | `20`, `6`, `8` (deflate). This is the 6-byte pattern `14 00 06 00 08 00` a reader scans for | |
| +14 | u32 | **CRC-32 of the inflated stream** | 1,730 of 1,730 named streams, 0 mismatches |
| +18 | u32 | compressed size | |
| +22 | u32 | inflated size | 1,730 of 1,730 |
| +26 | u16 | name length | |
| +28 | u16 | extra length, always 0 | 1,730 of 1,730 |
| +30 | bytes | the name, each byte rotated left by `(file byte 7) & 7` bits | byte 7 is `4` in 45 of 45 files |
| +30+n | bytes | raw DEFLATE data | |

Everything is little-endian. The counts are over the 45 modern files.

**The scan finds fake headers.** There's no directory to walk, so a reader has to scan for the
6-byte pattern, and that pattern also turns up inside compressed data. Fake hits decode to names
you can't print. In the corpus, 1,465 fake hits fail to inflate and 10 more fail their CRC. All of
them have unprintable names, and none has a printable one ([EXP-057][exp057]).

So only check the CRC of streams with printable names. If a stream with a printable name inflates
but fails its CRC, treat it as a corrupt file and stop.

Two more rules if you write your own reader:

- Only accept a header if its data inflates to exactly the size at +22. The file also holds
  directory-like records that reuse a stream's name, but not its sizes. Some of them inflate to
  junk that would fail the CRC, and on one file one of them would win the name. Don't throw
  them out by the size of the CRC field: an earlier version of the reference reader skipped
  anything below 65536, which looks like it works on the corpus but would also skip a real
  stream whose CRC-32 happens to be small.
- If a name shows up twice, the first one wins.

There's almost certainly a directory somewhere. Nobody here has decoded it. Other public projects
cover this layer in more detail (see [prior art](../research/history.md#prior-art)).

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
`Biography`, `History`, `Definition`), in every version. Work on them has started, see
[open questions](../research/open-questions.md#feature-tree).

[modern.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/modern.js
[ole.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/ole.js
[exp057]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_independent-verification-EXP057.md
[exp084]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP084.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md
