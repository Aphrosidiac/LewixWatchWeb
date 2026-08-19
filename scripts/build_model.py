"""
IGES -> web-ready GLB, in one pass, with no GUI apps involved.

    .venv/bin/python scripts/build_model.py

Driven straight off OCCT's Python bindings (the same kernel FreeCAD wraps) and
trimesh, both from PyPI.

How the parts stay separable and named
--------------------------------------
The IGES stores each component twice over: a type-308 *subfigure definition*
holding the geometry and its name, and a type-408 *singular subfigure instance*
placing it in the assembly. There are 40 definitions but 44 instances, because
repeated hardware — three identical barrel-bridge screws, two each for the
train-wheel and pallet bridges — reuses one definition.

So we walk the 44 transfer roots, read each one's name back through its
`Subfigure()` reference, and transfer roots one at a time. That pairs name to
geometry by construction rather than by assuming two lists came back in the
same order.

Outputs into public/model/:
  watch.glb   — one named mesh per component, PBR metals assigned
  parts.json  — token -> assembly layer / material, read by the viewer

The viewer resolves a part's layer from the *leading token* of its mesh name
("105M", "5105", "Incabloc"), never the full string, so neither the duplicate
suffixes nor any name mangling in the glTF round-trip can break the mapping.
"""

import json
import math
import os
import sys
from collections import OrderedDict

import numpy as np
import trimesh

from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.IFSelect import IFSelect_RetDone
from OCP.IGESBasic import IGESBasic_SingularSubfigure
from OCP.IGESControl import IGESControl_Reader
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGES = os.path.join(ROOT, "source", "ETA 6498-1 Movement.IGS")
OUT_DIR = os.path.join(ROOT, "public", "model")
GLB = os.path.join(OUT_DIR, "watch.glb")
PARTS_JSON = os.path.join(OUT_DIR, "parts.json")

# Tessellation quality, in millimetres. The movement is ~36mm across; 0.03
# resolves escape-wheel teeth cleanly without exploding the vertex count.
DEFLECTION = 0.03
ANGULAR = 0.3  # radians

TARGET_RADIUS = 1.0

# Failed-trim repair. Three screws in this IGES (click, ratchet-wheel and
# crown-wheel) carry faces whose trimming curves OCCT could not apply, so the
# underlying surface arrives untrimmed and sprays ribbons right across the
# movement — each of those parts ends up wider than the main plate.
#
# The signature is sharply bimodal: for a broken part the 95th-percentile face
# radius is 15-22x the median, while every intact part in this assembly sits at
# 4.2x or below. Anything over TRIM_RATIO gets its far faces dropped; the real
# screw body sits well inside TRIM_CUTOFF x the median and survives untouched.
TRIM_RATIO = 8.0
TRIM_CUTOFF = 4.0


# ---------------------------------------------------------------- assembly order
# Keyed on the leading token of the ETA part number.
LAYERS = {
    # --- dial side -------------------------------------------------------
    "450": -2.0, "453": -2.0,               # setting wheels
    "401": -2.0, "407": -2.0, "410": -2.0,  # winding stem / pinions
    "435": -2.0, "440": -2.0,               # yoke + spring
    "443M": -2.0, "445M": -2.0,             # setting lever + jumper
    "5443": -2.6, "5445": -2.6,             # their screws
    "250": -1.4,                            # hour wheel
    "240": -1.0, "260": -1.0,               # cannon pinion, minute wheel
    # --- main plate ------------------------------------------------------
    "100": 0.0,
    # --- going train, seated in the plate --------------------------------
    "180": 1.0,                             # barrel
    "201": 1.0, "210": 1.0, "220": 1.0,     # centre / third / second wheels
    "705": 1.0, "710": 1.0,                 # escape wheel, pallet fork
    # --- bridges over the train ------------------------------------------
    "105M": 2.0, "110": 2.0, "125": 2.0,
    "5105": 2.6, "5110": 2.6, "5125": 2.6,
    # --- winding works on top of the barrel bridge -----------------------
    "415": 3.0, "420": 3.0, "422": 3.0, "425": 3.0,
    "5415": 3.6, "5420": 3.6, "5425": 3.6,
    # --- balance assembly, crowning the stack ----------------------------
    "721": 4.0,                             # balance wheel
    "121": 5.0,                             # balance bridge over it
    "303": 5.4,                             # regulator
    "Incabloc": 5.4,                        # shock setting
    "5121": 6.0,                            # balance bridge screw
}

# (base colour RGBA, metallic, roughness)
MATERIALS = {
    "nickel": ([184, 189, 194, 255], 1.0, 0.34),
    "brass":  ([201, 169, 97, 255], 1.0, 0.30),
    "pale":   ([217, 219, 224, 255], 1.0, 0.22),
    "steel":  ([168, 173, 181, 255], 1.0, 0.28),
    "screw":  ([140, 148, 160, 255], 1.0, 0.14),
    "ruby":   ([122, 31, 77, 255], 0.0, 0.12),
}

ASSIGN = {
    "nickel": ["100", "105M", "110", "121", "125"],
    "brass":  ["180", "201", "210", "220", "240", "250", "260",
               "415", "420", "422"],
    "pale":   ["705", "710", "721", "303"],
    "steel":  ["401", "407", "410", "425", "435", "440",
               "443M", "445M", "450", "453"],
    "ruby":   ["Incabloc"],
}

# Surface finish per component, as actually applied at the bench. The viewer
# turns each of these into a procedural roughness + bump map.
#   perlage — overlapping circular graining, used on main plates
#   cotes   — cotes de Geneve, the parallel striping on bridges
#   radial  — concentric turning marks on wheels and barrels
#   brush   — fine straight graining on levers and springs
#   polish  — near-mirror, for screw heads
FINISH_BY_MATERIAL = {
    "nickel": "cotes",
    "brass":  "radial",
    "pale":   "radial",
    "steel":  "brush",
    "screw":  "polish",
    "ruby":   "none",
}

# The main plate is perlaged rather than striped — it is the one nickel part
# that does not get cotes de Geneve.
FINISH_BY_TOKEN = {
    "100": "perlage",
}


def finish_for(tok, material):
    return FINISH_BY_TOKEN.get(tok, FINISH_BY_MATERIAL.get(material, "brush"))


def log(msg):
    print("[build] %s" % msg, flush=True)


def safe_name(handle):
    """Read a TCollection_HAsciiString that may not be valid UTF-8.

    "303 Two-piece regulator" uses a cp1252 en-dash (0x96), which blows up
    ToCString() at the pybind boundary. Character-wise access still works.
    """
    if handle is None:
        return None
    try:
        return handle.ToCString()
    except UnicodeDecodeError:
        raw = "".join(handle.Value(k) for k in range(1, handle.Length() + 1))
        return raw.encode("latin-1", "replace").decode("cp1252", "replace")


def token(name):
    name = (name or "").strip()
    if name.lower().startswith("incabloc"):
        return "Incabloc"
    return name.split(" ")[0]


def material_for(tok):
    for key, toks in ASSIGN.items():
        if tok in toks:
            return key
    if tok.startswith("5") and len(tok) == 4:  # 5105, 5443 ... all screws
        return "screw"
    return "steel"


def layer_for(tok):
    if tok in LAYERS:
        return LAYERS[tok]
    if tok.startswith("5") and len(tok) == 4:
        return 2.6
    log("  ? no layer mapping for %r, defaulting to 0" % tok)
    return 0.0


# ------------------------------------------------------------------ CAD reading
def read_iges(path):
    """Return [(name, TopoDS_Shape)], one entry per placed component."""
    reader = IGESControl_Reader()
    log("reading %s (%.1f MB)" % (os.path.basename(path), os.path.getsize(path) / 1e6))
    if reader.ReadFile(path) != IFSelect_RetDone:
        log("ERROR: OCCT could not read the IGES")
        sys.exit(1)

    n_roots = reader.NbRootsForTransfer()
    log("%d transfer roots" % n_roots)

    out = []
    prev_shapes = 0

    for i in range(1, n_roots + 1):
        ent = reader.RootForTransfer(i)

        name = None
        if isinstance(ent, IGESBasic_SingularSubfigure):
            sub = ent.Subfigure()
            if sub is not None:
                name = safe_name(sub.Name())
        if not name:
            name = "part %03d" % i

        reader.TransferOneRoot(i)
        n_shapes = reader.NbShapes()
        if n_shapes <= prev_shapes:
            log("  ! %s transferred no shape, skipped" % name)
            continue
        prev_shapes = n_shapes

        out.append((name.strip(), reader.Shape(n_shapes)))

    return out


def tessellate(shape):
    """Triangulate a shape, returning (vertices, faces) in world coordinates.

    Each CAD face contributes its own block of vertices and they are never
    welded together, so smooth vertex normals average only within one face.
    Turned surfaces come out round, edges between faces stay crisp, and no
    per-part shading setup is needed downstream.
    """
    BRepMesh_IncrementalMesh(shape, DEFLECTION, False, ANGULAR, True)

    verts = []
    faces = []
    base = 0

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = TopoDS.Face_s(exp.Current())
        exp.Next()

        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is None:
            continue

        trsf = loc.Transformation()
        flip = face.Orientation() == TopAbs_REVERSED

        n_nodes = tri.NbNodes()
        for i in range(1, n_nodes + 1):
            p = tri.Node(i).Transformed(trsf)
            verts.append((p.X(), p.Y(), p.Z()))

        for i in range(1, tri.NbTriangles() + 1):
            a, b, c = tri.Triangle(i).Get()
            if flip:
                a, c = c, a
            faces.append((base + a - 1, base + b - 1, base + c - 1))

        base += n_nodes

    if not verts or not faces:
        return None, None
    return np.asarray(verts, dtype=np.float64), np.asarray(faces, dtype=np.int64)


def repair_failed_trims(verts, faces):
    """Drop untrimmed stray surfaces. Returns (verts, faces, n_dropped).

    See the TRIM_RATIO comment above for why this is keyed on the ratio between
    the 95th-percentile and median face radius rather than an absolute size —
    an absolute cutoff would have to know how big each component ought to be.
    """
    centre = np.median(verts, axis=0)
    dist = np.linalg.norm(verts - centre, axis=1)
    face_radius = dist[faces].max(axis=1)

    p50 = float(np.percentile(face_radius, 50))
    p95 = float(np.percentile(face_radius, 95))
    if p50 <= 0.0 or p95 / p50 <= TRIM_RATIO:
        return verts, faces, 0

    keep = face_radius <= TRIM_CUTOFF * p50
    if keep.all() or keep.sum() < 4:
        return verts, faces, 0

    kept_faces = faces[keep]
    used = np.unique(kept_faces)
    remap = np.full(len(verts), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))

    return verts[used], remap[kept_faces], int((~keep).sum())


# ------------------------------------------------------------------------ main
def main():
    if not os.path.exists(IGES):
        log("ERROR: not found: %s" % IGES)
        sys.exit(1)

    entries = read_iges(IGES)
    log("%d components recovered" % len(entries))
    if not entries:
        log("ERROR: nothing to tessellate")
        sys.exit(1)

    # ---------------------------------------------------------- tessellate
    meshes = OrderedDict()
    seen = {}
    total_tris = 0

    repaired = []

    for name, shape in entries:
        v, f = tessellate(shape)
        if v is None:
            log("  ! %s produced no geometry, skipped" % name)
            continue

        v, f, dropped = repair_failed_trims(v, f)

        # Repeated hardware reuses one definition, so suffix the instances to
        # keep them addressable as separate meshes.
        seen[name] = seen.get(name, 0) + 1
        label = name if seen[name] == 1 else "%s %d" % (name, seen[name])

        meshes[label] = trimesh.Trimesh(vertices=v, faces=f, process=False)
        total_tris += len(f)

        note = ""
        if dropped:
            repaired.append(label)
            note = "  <- dropped %d untrimmed faces" % dropped
        log("  %-44s %7d verts %7d tris%s" % (label, len(v), len(f), note))

    if repaired:
        log("repaired %d part(s) with failed trims: %s" % (len(repaired), ", ".join(repaired)))

    log("%d parts, %d triangles total" % (len(meshes), total_tris))

    # ------------------------------------------------------------ normalise
    all_v = np.vstack([m.vertices for m in meshes.values()])
    lo, hi = all_v.min(axis=0), all_v.max(axis=0)
    size = hi - lo
    centre = (lo + hi) / 2.0
    log("raw bounds %.2f x %.2f x %.2f mm" % tuple(size))

    # A watch movement is a flat disc: its axis is the shortest bbox dimension.
    axis = int(np.argmin(size))
    log("movement axis detected on %s" % "XYZ"[axis])

    # glTF is Y-up, so put the movement's axis on +Y — the viewer explodes there.
    if axis == 0:
        rot = trimesh.transformations.rotation_matrix(math.radians(-90), [0, 0, 1])
    elif axis == 2:
        rot = trimesh.transformations.rotation_matrix(math.radians(90), [1, 0, 0])
    else:
        rot = np.eye(4)

    radial = max(size[i] for i in range(3) if i != axis) / 2.0
    scale = TARGET_RADIUS / radial if radial else 1.0
    log("scaling by %.5f (radial extent %.2f mm)" % (scale, radial))

    xform = (
        trimesh.transformations.scale_matrix(scale)
        @ rot
        @ trimesh.transformations.translation_matrix(-centre)
    )
    for mesh in meshes.values():
        mesh.apply_transform(xform)

    # ------------------------------------------------------------------ UVs
    # Watch parts are flat discs stacked along the movement axis, so a planar
    # projection down that axis is the natural parameterisation — no seams, no
    # distortion on the faces anyone actually looks at.
    #
    # The projection uses the *assembly's* bounds, not each part's, so the
    # surface finishes line up across components: Geneva stripes run continuous
    # across neighbouring bridges instead of restarting at every part boundary.
    world = np.vstack([m.vertices for m in meshes.values()])
    uv_lo = world.min(axis=0)
    uv_span = float(max(np.ptp(world[:, 0]), np.ptp(world[:, 2])))
    log("planar UV projection over %.3f units" % uv_span)

    # ------------------------------------------------------- materials + meta
    tokens = {}
    parts_meta = []

    for label, mesh in meshes.items():
        tok = token(label)
        key = material_for(tok)
        lay = layer_for(tok)
        colour, metallic, rough = MATERIALS[key]

        fin = finish_for(tok, key)
        v = mesh.vertices

        if fin == "radial":
            # Turning marks run concentric about the part's *own* axis, so a
            # wheel gets UVs centred on its centroid and normalised to its own
            # extent — one full 0..1 span across the part. A shared global
            # projection would centre every wheel's rings on the movement's
            # axis instead of its own, which reads as obviously wrong.
            centre_xz = np.array([v[:, 0].mean(), v[:, 2].mean()])
            extent = max(np.ptp(v[:, 0]), np.ptp(v[:, 2])) or 1.0
            uv = np.column_stack([
                (v[:, 0] - centre_xz[0]) / extent + 0.5,
                (v[:, 2] - centre_xz[1]) / extent + 0.5,
            ])
        else:
            # Striping and graining are directional and should stay continuous
            # across neighbouring parts, so these share the assembly-wide
            # projection and tile via texture repeat in the viewer.
            uv = np.column_stack([
                (v[:, 0] - uv_lo[0]) / uv_span,
                (v[:, 2] - uv_lo[2]) / uv_span,
            ])

        mesh.visual = trimesh.visual.TextureVisuals(
            uv=uv,
            material=trimesh.visual.material.PBRMaterial(
                name=key,
                baseColorFactor=colour,
                metallicFactor=metallic,
                roughnessFactor=rough,
            ),
        )

        tokens[tok] = {"layer": lay, "material": key, "finish": fin}
        parts_meta.append({
            "name": label,
            "token": tok,
            "layer": lay,
            "material": key,
            "finish": fin,
            "triangles": int(len(mesh.faces)),
        })

    parts_meta.sort(key=lambda p: (p["layer"], p["name"]))

    # -------------------------------------------------------------- export
    os.makedirs(OUT_DIR, exist_ok=True)

    scene = trimesh.Scene()
    for label, mesh in meshes.items():
        scene.add_geometry(mesh, node_name=label, geom_name=label)

    with open(GLB, "wb") as fh:
        fh.write(trimesh.exchange.gltf.export_glb(scene, include_normals=True))

    layers = sorted(set(p["layer"] for p in parts_meta))
    with open(PARTS_JSON, "w") as fh:
        json.dump({
            "caliber": "ETA 6498-1",
            "axis": "y",
            "layerRange": [layers[0], layers[-1]],
            "tokens": tokens,
            "parts": parts_meta,
        }, fh, indent=2)

    final = np.vstack([m.vertices for m in meshes.values()])
    log("normalised bounds %.3f x %.3f x %.3f" % tuple(final.max(axis=0) - final.min(axis=0)))
    log("wrote %s (%.2f MB)" % (GLB, os.path.getsize(GLB) / 1e6))
    log("wrote %s (%d parts, layers %.1f..%.1f)"
        % (PARTS_JSON, len(parts_meta), layers[0], layers[-1]))


main()
