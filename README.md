# SLDPRT format research

I'm reverse engineering SolidWorks `.SLDPRT` files because the format isn't documented anywhere and
that pissed me off.

This repo is the write-up: how a part file is put together, as far as we've worked it out, and
how every piece of it was checked against real files. The code that reads them lives in its own
repo, [solidworks-converters](https://github.com/blussyya/solidworks-converters).

Come talk about it on [Discord](https://discord.gg/vC4Jee5Q4n).

# NOTICE
if you were building something and cloned this repo for its code, use the [solidworks-converters](https://github.com/blussyya/solidworks-converters) repository instead.
The split is due to organization, that repository will contain a combined one CLI command tool instead of the fragmented tools that existed here, this current repo will become a documentation-only repository.
sorry i know that i restructured it multiple times now but this will the last time (hopefully)

## Where to start

| if you want | read |
|---|---|
| the whole file on one page | [format/](format/README.md) |
| how it's packed: streams, names, CRC, versions | [1. Container](format/1-container.md) |
| the mesh SolidWorks draws | [2. Display mesh](format/2-display-mesh.md) |
| the exact solid inside every part | [3. Parasolid body](format/3-parasolid-body.md) |
| how the mesh and the solid point at each other | [4. Mesh and body together](format/4-mesh-and-body.md) |
| files from before 2011 | [5. Files older than 2011](format/5-pre-2011.md) |
| which SolidWorks release saved a file | [6. Version history](format/6-version-history.md) |
| exact STEP and exact volume from the solid | [export/exact-step.md](export/exact-step.md), [export/exact-volume.md](export/exact-volume.md) |
| proof that it's right | [research/validation.md](research/validation.md) |
| the story, including everything we got wrong | [research/history.md](research/history.md) |
| what nobody knows yet | [research/open-questions.md](research/open-questions.md) |
| to run the code | [using-the-code.md](using-the-code.md) |

## What's known

| part of the file | status | more |
|---|---|---|
| Modern container (SolidWorks 2015+) | decoded, CRC-32 checked on every stream | [container](format/1-container.md) |
| Legacy OLE2 container (SolidWorks 2011) | decoded | [container](format/1-container.md#legacy-container-solidworks-2011) |
| Display mesh: triangles, normals, which edges are face boundaries | decoded, modern and 2011 | [display mesh](format/2-display-mesh.md) |
| Surface type, parameters and bounding box per face | modern, and the bounding box on 2011 too | [display mesh](format/2-display-mesh.md#surface-record-modern-only) |
| The Parasolid body: topology, analytic surfaces, B-splines, intersection curves | decoded in every version, and it matches SolidWorks' own STEP export | [Parasolid body](format/3-parasolid-body.md) |
| The link between the mesh and the body | face and edge IDs match on 1,414 of 1,414 faces, and every version joins by edge ID | [mesh and body](format/4-mesh-and-body.md) |
| Which release saved the file | release code and every save with its build date, 1997–2024 files | [version history](format/6-version-history.md) |
| Files older than 2011 | mesh and body both decoded, including Parasolid 9 bodies from around 2000 | [pre-2011](format/5-pre-2011.md) |
| Exact STEP | written from the body: exact where STEP can hold it, fitted to 1e-5 mm where it can't. 64 of 64 match SolidWorks' own export | [exact STEP](export/exact-step.md) |
| Exact volume | straight from the surfaces, no mesh involved | [exact volume](export/exact-volume.md) |
| Feature tree, sketches, configurations | in progress: sketches decode on the 2022 controlled models | [open questions](research/open-questions.md#feature-tree) |
| Assemblies, drawings | not looked at yet | |

## How do we know it's right

There's a test corpus of 73 part files. 49 of them were built just for this project, in SolidWorks
2011 and 2022, to sizes picked before building them. SolidWorks exported each one to STEP, STL, X_T
and X_B and wrote down the surface type of every face. The full numbers are in
[validation](research/validation.md). The main ones:

- All 73 files parse to exactly the recorded output (1,559 faces).
- Face counts match what SolidWorks reports on every controlled model, in both versions.
- Surface types match SolidWorks on 136 of 136 faces.
- The Parasolid body pulled out of the file matches the STEP file SolidWorks exports from the same
  part, on all 49 controlled models. Every vertex, edge and face lines up, and the B-spline control
  points are identical. The worst difference is 9×10⁻¹⁸ m, which is just floating-point rounding.
- The STEP written from that body loads in OpenCascade as a valid solid for every part with a
  solid, and its
  volume and area equal SolidWorks' own export on all 64 parts that have one.
- The STL has the exact same bounding box as SolidWorks' STL on all 13 controlled cubes.
  SolidWorks' own STL of three of them is missing a whole face. The mesh stored in the file isn't.

The whole lab notebook is in [sldprt-research-dump](https://github.com/blussyya/sldprt-research-dump).
Every experiment from EXP-001 on is there with its script, raw output and later corrections, along
with the test corpus. This repo keeps only the cleaned-up results.

## How to cite this

If you use what's in here, in code, a paper, a write-up or a port, credit it like this:

> SLDPRT format research by blussyya, https://github.com/blussyya/sldprt-format-research,
> licensed under CC BY-SA 4.0.

```bibtex
@misc{sldprt-format-research,
  author = {blussyya},
  title  = {SLDPRT format research},
  year   = {2026},
  url    = {https://github.com/blussyya/sldprt-format-research},
  note   = {Licensed under CC BY-SA 4.0}
}
```

## License

The documentation is licensed under [Creative Commons Attribution-ShareAlike 4.0](LICENSE)
(CC BY-SA 4.0). You can copy, adapt and share it, including commercially, as long as you credit it
(see above), link to the license, say what you changed, and release anything you build from the
docs themselves under the same license.

The code is a separate project, [solidworks-converters](https://github.com/blussyya/solidworks-converters),
under Apache-2.0.

Earlier versions of this repo, which had the code and the docs together, were released under the
MIT License, and those copies stay under MIT.

The facts themselves (stream names, the GUID, field layouts, numbers) belong to the files, not to
anyone. What the license covers is this write-up of them.

Four images are renders of real parts that aren't mine, and the license doesn't cover them:
`images/usb-hub-top.png`, `images/helical-gear.png`, `images/pocket-wheel.png` and
`images/terminal-viewer.png`. [NOTICE](NOTICE) has the details.

The Parasolid part follows the public *Parasolid XT Format Reference* (2006). No SolidWorks or
Parasolid source code, binaries or SDK files were used.
