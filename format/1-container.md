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

- Only accept a header if the u32 at +14 is at least 65536 and the compressed size isn't zero.
  The first check throws out small directory-like records that reuse a stream's name.
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

The ones that matter for geometry:

| stream | holds | see |
|---|---|---|
| `Contents/DisplayLists` | the saved mesh and one surface record per face | [page 2](2-display-mesh.md) |
| `Contents/Config-0-Partition` | the Parasolid body | [page 3](3-parasolid-body.md) |
| `Contents/Config-0-GhostPartition` | wire and sheet bodies: feature inputs, never the solid | [page 3](3-parasolid-body.md#the-other-partition-streams) |
| `Config-0-FeatureBodies/LocalBodies` | an imported body, when there is one | [page 3](3-parasolid-body.md#which-body-is-the-part) |
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

One grammar reads all five, so across this range the version doesn't pick a layout. Nothing
outside 13000–17000 has been tested.

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
u32le inflated length        (offset 16)
u32le compressed length      (offset 20)  == stream length − 32
zlib member                  (offset 24)
8 zero bytes
```

That's the same frame a Parasolid partition section uses ([page 3](3-parasolid-body.md#section-frame)),
minus the size word in front: same GUID, same length fields, same eight zeros at the end. The
reference reader rejects any other frame and checks the inflated length.

## What isn't read

The feature tree and the other MFC-serialised streams (`Config-0`, `Header`, `CMgr`,
`Biography`, `History`, `Definition`), in every version. Work on them has started, see
[open questions](../research/open-questions.md#feature-tree).

[modern.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/modern.js
[ole.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/container/ole.js
[exp057]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_independent-verification-EXP057.md
