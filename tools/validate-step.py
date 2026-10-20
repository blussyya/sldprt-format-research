#!/usr/bin/env python3
"""Check STEP files with OpenCascade (dev tooling; never a package dependency).

Needs the OCP bindings: python -m venv venv && venv/bin/pip install cadquery-ocp

Reads jobs as JSON lines on stdin, writes one JSON result per line on stdout:

  {"id": ..., "step": "ours.step", "ref": "solidworks.step", "mesh": "points.json"}

For each STEP: loads, BRepCheck_Analyzer validity, solid / shell / face counts, surface-type
counts, volume and area (adaptive integration, eps 1e-9), and the largest distance from an
edge's 3D curve to the surfaces of its faces. With "ref", the same for the
reference file. With "mesh" (a JSON file {"faces": {"F12": [[x,y,z], ...]}} in millimetres),
the largest distance from each point to the surface of the STEP faces named after its face.
"""
import json, sys

from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID, TopAbs_SHELL, TopAbs_FACE, TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCP.GeomAbs import GeomAbs_SurfaceType
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.BRep import BRep_Tool
from OCP.GeomAPI import GeomAPI_ProjectPointOnSurf
from OCP.gp import gp_Pnt

NAMES = {int(v): k.replace('GeomAbs_', '') for k, v in GeomAbs_SurfaceType.__members__.items()}


def count(shape, kind):
    n, ex = 0, TopExp_Explorer(shape, kind)
    while ex.More():
        n += 1
        ex.Next()
    return n


def load(path, want_names=False):
    r = STEPControl_Reader()
    load.keep = r
    if r.ReadFile(path) != IFSelect_RetDone:
        return None, None
    r.TransferRoots()
    shape = r.OneShape()
    named = {}
    if want_names:
        ws = r.WS()          # keep a reference: a temporary work session is freed under us
        tr = ws.TransferReader()
        ex = TopExp_Explorer(shape, TopAbs_FACE)
        while ex.More():
            f = ex.Current()
            ent = tr.EntityFromShapeResult(f, 1)
            if ent is not None and ent.DynamicType().Name() == 'StepShape_AdvancedFace':
                named.setdefault(ent.Name().ToCString(), []).append(f)
            ex.Next()
    return shape, named


def describe(shape):
    out = {'solids': count(shape, TopAbs_SOLID), 'shells': count(shape, TopAbs_SHELL),
           'faces': count(shape, TopAbs_FACE), 'edges': count(shape, TopAbs_EDGE)}
    out['valid'] = bool(BRepCheck_Analyzer(shape).IsValid())
    types = {}
    ex = TopExp_Explorer(shape, TopAbs_FACE)
    while ex.More():
        t = NAMES.get(int(BRepAdaptor_Surface(TopoDS.Face(ex.Current())).GetType()), '?')
        types[t] = types.get(t, 0) + 1
        ex.Next()
    out['surfaces'] = types
    p = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, p, 1e-9)
    out['volume'] = p.Mass()
    p = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, p, 1e-9)
    out['area'] = p.Mass()
    out['edgeDeviationMM'] = edge_deviation(shape)
    return out


def edge_deviation(shape, n=16):
    """Largest distance from points on an edge's 3D curve to the surfaces of its faces."""
    worst = 0.0
    ex = TopExp_Explorer(shape, TopAbs_FACE)
    while ex.More():
        face = TopoDS.Face(ex.Current())
        ex.Next()
        srf = BRep_Tool.Surface_s(face)
        ee = TopExp_Explorer(face, TopAbs_EDGE)
        while ee.More():
            edge = TopoDS.Edge(ee.Current())
            ee.Next()
            if BRep_Tool.Degenerated_s(edge):
                continue
            c = BRepAdaptor_Curve(edge)
            a, b = c.FirstParameter(), c.LastParameter()
            for k in range(n + 1):
                pr = GeomAPI_ProjectPointOnSurf(c.Value(a + (b - a) * k / n), srf)
                if pr.NbPoints():
                    worst = max(worst, pr.LowerDistance())
    return worst


def mesh_deviation(named, mesh_path):
    """Distances from display-mesh points to the surface of the STEP face named after their face.

    Returns the largest, the 99.9th percentile and the count above 1e-3 mm: SolidWorks' display
    mesh has a few vertices that sit off the face they are filed under (see docs/validation.md).
    """
    with open(mesh_path) as fh:
        mesh = json.load(fh)
    ds, missing = [], []
    for name, pts in mesh['faces'].items():
        shapes = named.get(name)
        if not shapes:
            missing.append(name)
            continue
        srf = BRep_Tool.Surface_s(TopoDS.Face(shapes[0]))   # pieces of one native face share the surface
        for q in pts:
            pr = GeomAPI_ProjectPointOnSurf(gp_Pnt(*q), srf)
            if pr.NbPoints():
                ds.append(pr.LowerDistance())
    ds.sort()
    pick = lambda f: ds[min(len(ds) - 1, int(f * len(ds)))] if ds else 0.0
    return {'points': len(ds), 'maxDeviationMM': ds[-1] if ds else 0.0, 'p999DeviationMM': pick(0.999),
            'over1um': sum(1 for d in ds if d > 1e-3), 'facesMissing': missing[:10], 'nMissing': len(missing)}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = json.loads(line)
        res = {'id': job.get('id')}
        try:
            shape, named = load(job['step'], 'mesh' in job)
            if shape is None or shape.IsNull():
                res['loaded'] = False
            else:
                res['loaded'] = True
                res['ours'] = describe(shape)
                if 'mesh' in job:
                    res['mesh'] = mesh_deviation(named, job['mesh'])
            if 'ref' in job:
                ref, _ = load(job['ref'])
                res['ref'] = describe(ref) if ref is not None and not ref.IsNull() else None
        except Exception as e:  # report and continue with the next job
            res['error'] = repr(e)
        print(json.dumps(res), flush=True)


if __name__ == '__main__':
    main()
