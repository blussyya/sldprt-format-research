# 6. Which SolidWorks saved the file

Every part records which SolidWorks releases saved it, and when each of those releases was built.
That's enough to say "last saved in SolidWorks 2024, created in 2019" without SolidWorks.

## The last-saved version: a stream name

The container has a stream (modern) or an empty storage (OLE2) named `_MO_VERSION_<n>`. In a
modern file it's a path prefix, as in `_MO_VERSION_17000/History`; in an OLE2 file it's a
directory entry of its own (type 1, a storage, not a stream). `<n>` is the release code of the
last save.

## Release codes

SolidWorks' own API help (`VersionHistory`) lists one code per major release:

| code | release | | code | release |
|---|---|---|---|---|
| 44 | SolidWorks 95 | | 4400 | 2010 |
| 822 | 98 | | 4700 | 2011 |
| 1500 | 2000 | | 5000 | 2012 |
| 1750 | 2001 | | 6000 | 2013 |
| 1950 | 2001 Plus | | … | +1000 a year |
| 2200 | 2003 | | 15000 | 2022 |
| 3400 | 2007 | | 18000 | 2025 |
| 3800 | 2008 | | 19000 | 2026 |
| 4100 | 2009 | | | |

From 2013 on, release = 2007 + code / 1000. The table has no rows for 96, 97, 2004–2006; a code
between two rows is reported as the row below with a `+` (plate4's 629 is "SolidWorks 95+").

## The History stream

`History` (modern: `_MO_VERSION_<n>/History`; OLE2: a stream at the root) is an
`moVersionHistory_c` object, little-endian:

```
class header        ffff, u16 1, u16 18, "moVersionHistory_c"
u32 count
count × save:
  u32                 (0 on the creating save; 3 on C23's upgrade save — meaning open)
  u16
  u32 time            unix seconds: the template's creation, not the part's
  string              comment, empty in every file seen
  u32 version         the release code
  moDateCodeHistory_c full class header the first time, a u16 class reference (top bit set,
                      e.g. 0x8003) after that
  u32 k               number of date codes
  k × u32             low 24 bits: build date YYYYDDD; top byte 1 on the release that
                      created the file, 0 on one that only re-saved it
u32 0, i32 -1, 14 zero bytes
```

Two older layouts:

- **Strings.** From 2001 on a string is `ff fe ff`, a u8 count and that many UTF-16 units.
  SW2000-s01 (1500) has the older form: a u8 count and that many 8-bit characters.
- **Date codes per save.** k is 1 everywhere except plate4's second save (629), where it is 2:
  1997/203 and 1997/205. Its first save (627) has one, 1997/201. The reader reports the last.

The build dates check the codes against the calendar: 12000 built 2019/304 (SW2019 SP5), 15000
built 2022/009 (SW2022 SP1), 17000 built 2024/157 (SW2024).

## Verified on

Every part in the corpus, 0 parse errors, saves from 1997 to 2024:

| file | saves (code, build year/day) |
|---|---|
| plate4.sldprt | 627 1997/201, 629 1997/205 |
| SW2000-s01.SLDPRT | 1500 2000/268 (created) |
| chainwheel.sldprt | 1950 2001/340 (created) |
| C00–C26 SW2011 | 4700 2010/276 (created) |
| USB hub case TOP/BOTTOM | 13000 2020/196 |
| Dekor | 14000 2020/273 |
| C23 (2011 → 2022) | 4700 2010/276 (created), 15000 2022/009 |
| cube, Helical Bevel Gear, C00–C24 SW2022 | 15000 2022/009 (created) |
| Pocket Wheel | 16000 2023/096 (created) |
| distributor main boss rev a | 17000 2024/078 (created) |
| PTC GE8080-8 | 12000 2019/304 (created), 14000 2021/301, 17000 2024/157 |

The reader is `src/container/history.js` in
[solidworks-converters](https://github.com/blussyya/solidworks-converters); `sldprt info` prints
"saved in" and "created in". Evidence: [EXP-083][dump].

[dump]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP083.md
