# NEX Material Architecture

**Version:** 1.0
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Scope:** The NEX 3D preview at `public/staircase-preview/mat-002-flight-3d.html` and any future timber-based renderer surface derived from it.

This document is the reference map of which materials exist in the NEX 3D preview, which meshes they drive, how they inherit from each other, and the naming conventions that must be followed for any new material. Six months from now this document should save hours of reverse-engineering when someone (human or AI) tries to understand why a specific surface renders the way it does.

---

## 1. Materials at a glance

| Material | Type | Front / Rear | Emissive? | Assigned to |
|---|---|---|:-:|---|
| `treadMaterial` | MeshStandardMaterial | Front | ✗ | tread top + bullnose + back + ends (via geometry-split group 0); top step; baserail; handrail |
| `rearTreadMaterial` | MeshStandardMaterial | Rear | ✓ (0.5) | tread underside (via geometry-split group 1) |
| `riserMaterial` | MeshStandardMaterial | Front | ✗ | 5 of the 6 BoxGeometry faces (−X, +Y, −Y, +Z, −Z) |
| `rearRiserMaterial` | MeshStandardMaterial | Rear | ✓ (0.5) | +X face of riser (BoxGeometry group 0) |
| `stringMaterial` | MeshPhysicalMaterial | Front | ✗ | Inward cap face of each string (side-dependent group assignment) |
| `rearStringOuterMaterial` | MeshPhysicalMaterial | Rear | ✓ (0.5) | Outward cap face of each string (side-dependent group assignment) |
| `rearStringMaterial` | MeshPhysicalMaterial | Rear | ✓ (0.5) | String perimeter (top edge + bottom edge + short end faces) |
| `pineMaterial` | MeshStandardMaterial | Rear | ✓ (0.5) | Angle blocks; tread wedges; riser wedges |
| `sheetingMaterial` | MeshPhysicalMaterial | Rear | ✓ (0.5) | Back-of-staircase T&G sheeting panel |
| `rearAngleBeadMaterial` | MeshStandardMaterial | Rear | ✓ (0.5) | Angle bead trim on sheeting edges |
| `grooveMaterial` | MeshStandardMaterial | Rear (decorative) | ✗ | T&G plank division strips (intentionally darker for contrast) |
| `newelMaterial` | MeshStandardMaterial | Front | ✗ | Newel posts (bottom + top + caps) |
| `balusterMaterial` | MeshStandardMaterial | Front | ✗ | Oak balusters (fully chamfered variant) |
| `balusterWhiteMaterial` | MeshStandardMaterial | Front | ✗ | White sprayed balusters (stop-chamfer variant, 3 stacked meshes per position) |
| `balusterCreamMaterial` | MeshStandardMaterial | Front | ✗ | Cream sprayed balusters (fully chamfered variant) |
| `screwMaterial` | MeshStandardMaterial | Rear | ✗ | Screw heads through riser back (small trim detail) |
| `ledStripMaterial` | MeshStandardMaterial | Rear (accent) | ✓ (toggleable) | LED strip mesh in bullnose groove — emissive controlled by Stairlights toggle |

---

## 2. Inheritance tree

Rear materials are duplicates of their front counterparts with **identical PBR maps** (same texture reference or its clone) plus **added emissive properties**. This preserves the HARD RULE that back surfaces must have the same wood identity as the staircase.

```
treadMaterial (front)
    ↓ duplicate + emissive
    rearTreadMaterial (tread underside)
    ↓ duplicate + emissive
    rearAngleBeadMaterial (sheeting angle bead trim)

riserMaterial (front)
    ↓ duplicate + emissive
    rearRiserMaterial (riser +X back face)

stringMaterial (front, inward cap face)
    ↓ duplicate + emissive
    rearStringMaterial (string perimeter)
    ↓ duplicate + emissive
    rearStringOuterMaterial (string outward cap face)

pineMaterial (rear, no front counterpart — hidden components)
sheetingMaterial (rear, no front counterpart — back panel only)
grooveMaterial (rear, decorative dark strips — intentionally distinct)

newelMaterial (front only)
balusterMaterial, balusterWhiteMaterial, balusterCreamMaterial (front only)
screwMaterial (rear trim, no counterpart needed)
ledStripMaterial (accent light, no counterpart)
```

---

## 3. Shared PBR maps

All wood materials share the same primary base texture (`baseColorMap`) loaded from `TEXTURE_URL` at page load. This guarantees a single source of visual identity across the staircase.

| Texture variable | Wrap | Anisotropy | Used by |
|---|---|---|---|
| `baseColorMap` | Repeat | max | `treadMaterial`, `rearTreadMaterial`, `rearAngleBeadMaterial` (directly) |
| `riserTex` = clone of `baseColorMap` | Repeat | max | `riserMaterial`, `rearRiserMaterial` |
| `stringTex` = clone of `baseColorMap` | ClampToEdge | max | `stringMaterial`, `rearStringMaterial`, `rearStringOuterMaterial` |
| `balusterTex` = clone of `baseColorMap`, 90° rotated | Repeat | max | `balusterMaterial` (grain runs vertical) |
| `pineTex` = clone of `baseColorMap` | Repeat | max | `pineMaterial` |
| `newelTex` = clone of `baseColorMap` | Repeat | max | `newelMaterial` |
| `sheetingTex` = clone of `baseColorMap` | ClampToEdge | max | `sheetingMaterial` |
| Canvas-drawn dark strip | — | — | `grooveMaterial` |
| Solid emissive glow | — | — | `ledStripMaterial` |

**HARD RULE:** if a rear material is introduced for a new mesh, its `.map` must be the same texture reference as (or a clone of) the corresponding front material. **No independent texture files for rear materials.**

---

## 4. Geometry-group assignments

### Riser (BoxGeometry, 6 groups)

| Group | Face | Material |
|---|---|---|
| 0 | +X | `rearRiserMaterial` (rear-visible back) |
| 1 | −X | `riserMaterial` (walker-visible front) |
| 2 | +Y | `riserMaterial` |
| 3 | −Y | `riserMaterial` |
| 4 | +Z | `riserMaterial` |
| 5 | −Z | `riserMaterial` |

### Tread (ExtrudeGeometry with custom split, 2 groups)

The default ExtrudeGeometry produces two groups (caps + perimeter). `splitTreadPerimeterByUnderside()` reorders perimeter triangles by face-normal Y so underside triangles are isolated.

| Group | Contents | Material |
|---|---|---|
| 0 | Caps (extrusion ends, hidden in strings) + top walking surface + bullnose front + back edge | `treadMaterial` |
| 1 | Underside triangles (normal.y < −0.5) | `rearTreadMaterial` |

### String (ExtrudeGeometry with custom split, 3 groups)

`splitStringCapsByZ()` splits the default caps group into two sub-groups by local normal.z, keeping the perimeter as group 2.

| Group | Contents | Material (side = +1) | Material (side = −1) |
|---|---|---|---|
| 0 | Cap+Z (local +Z-facing wide face) | `rearStringOuterMaterial` (outward for right) | `stringMaterial` (inward for left) |
| 1 | Cap−Z (local −Z-facing wide face) | `stringMaterial` (inward for right) | `rearStringOuterMaterial` (outward for left) |
| 2 | Perimeter (top + bottom + short ends) | `rearStringMaterial` | `rearStringMaterial` |

**Same geometry, different materials array per mesh.** This is how the left and right strings both show the emissive lift on their outward face while keeping the inward face on the plain `stringMaterial`.

---

## 5. Naming conventions

**Required prefix for rear materials:** `rear` (lower-case) followed by the parent name in PascalCase.

Correct:
- `treadMaterial` → `rearTreadMaterial`
- `riserMaterial` → `rearRiserMaterial`
- `stringMaterial` → `rearStringMaterial`
- `stringMaterial` (outer variant) → `rearStringOuterMaterial`

Incorrect:
- `treadMaterialBack`, `treadMaterialRear`, `backTreadMaterial`, `RearTreadMaterial`

**Where the rear material has NO front counterpart** (hidden or back-only components), name it after the mesh function:
- `pineMaterial` (structural pine — wedges and blocks)
- `sheetingMaterial` (back sheeting panel)
- `grooveMaterial` (T&G plank division strips)

---

## 6. Adding a new material — checklist

Before adding a new material to the file, confirm:

- [ ] Is an existing material already suitable? Reuse before creating.
- [ ] Does the new material follow the naming convention (§5)?
- [ ] Does the `.map` reference an existing shared texture (or a clone) rather than a new file?
- [ ] Is the material front-only, rear-only, or both? Assigned to the correct meshes only?
- [ ] If rear, does the mesh have geometry groups that isolate the rear face? If not, is a geometry-split helper needed?
- [ ] Is the new material added to `woodMaterials.push(...)` if it should participate in scene-wide adjustments (e.g. varnish toggle)?
- [ ] Has the material been added to §1 of this document?
- [ ] Has the inheritance tree in §2 been updated?

---

## 7. Regression discipline

Any change to any material in this document — new material, changed property, changed assignment — triggers the regression check in `docs/design-system/MATERIAL_CALIBRATION_WORKFLOW.md` §8 and `docs/materials/APPROVAL_REGISTRY.md`.

**Never** modify a front-facing material without confirming the change is intended to alter every approved species' front-panel render. Front materials are the ground truth that rear materials calibrate to.

---

## 8. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — initial architecture document. 17 materials catalogued, inheritance tree established, geometry-group split conventions documented for tread and string. | Philip O'Farrell |
