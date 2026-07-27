# Raked-Pile 3D Set-Out — Calculation Method

Reference specification for setting out **battered (raked) cylindrical piles** with a total
station. Covers the exact geometry, the Excel implementation, a Python reference, verification
methods, and a worked example. Written so another engineer or an AI can re-implement it exactly.

Project context: GMTP Temporary Jetty, mooring dolphins MD-1…MD-6 (8 raked piles each,
Ø1219.2 mm, batter 1:5). Values verified against an independent 3-D silhouette solver to < 0.001 mm.

---

## 1. Coordinate system and conventions

- Coordinates are grid **N** (Northing), **E** (Easting), **Z** (level/elevation), in metres.
- **Azimuth** is measured **clockwise from grid North**, range 0–360°: `Az = atan2(ΔE, ΔN)`.
- 3-D vectors are written as `(N, E, Up)`; `Up` = +Z.
- Angles internally in radians; output angles in decimal degrees, displayed as `D°M'S"`.

> **Excel gotcha (critical).** Excel's `ATAN2(x, y)` returns `atan2(y, x)`. To get the survey
> azimuth `atan2(ΔE, ΔN)` you must write `ATAN2(ΔN, ΔE)` — i.e. `ATAN2(N_T−N_S, E_T−E_S)`.
> Swapping the arguments yields the angle from East and is wrong. Always sanity-check the
> backsight azimuth against a known direction (e.g. a due-west backsight must give 270°).

---

## 2. Inputs

**Per pile (Design table):**

| Symbol | Meaning |
|---|---|
| `N_A, E_A` | Pile-centre coordinates at the **anchor level** |
| `Z_A` | Anchor level (here the design cut-off level, +5.65 m) |
| `Dia` | Pile diameter (m); radius `ρ = Dia/2` |
| `V` | Batter ratio is `1:V` (1 horizontal : V vertical); `V` dimensionless |
| `Az_r` | **Rake azimuth** — the bearing the **toe** leans toward (direction of the horizontal component as the axis goes downward) |

**Shared (Setup):**

| Symbol | Meaning |
|---|---|
| `N_S, E_S, Z_S` | Instrument station coordinates and ground level |
| `HI` | Instrument height; instrument elevation `Z_I = Z_S + HI` |
| `N_B, E_B` | Backsight point |
| `Zt` | Set-out level(s) at which to compute (e.g. `Zt_A` top, `Zt_B` lower) |

---

## 3. Derived geometry

- Rake angle from vertical: `θ = atan(1/V)`.
- Pile **axis unit vector** (pointing down toward the toe), in `(N, E, Up)`:

  `â = ( sinθ·cosAz_r , sinθ·sinAz_r , −cosθ )`

- Backsight azimuth: `Az_BS = atan2(E_B − E_S, N_B − N_S)  (mod 360)`.

---

## 4. Pile centre at a set-out level `Zt`

A raked pile's centre moves horizontally with level. Going down by `(Z_A − Zt)` the centre
advances `(Z_A − Zt)/V` along the rake bearing:

```
C_N = N_A + (Z_A − Zt)/V · cos(Az_r)
C_E = E_A + (Z_A − Zt)/V · sin(Az_r)
```

`C = (C_N, C_E)` equals the anchor exactly when `Zt = Z_A`. This is the point to stake.

---

## 5. Left / right silhouette (tangent) points — exact 3-D method

The pile is a cylinder of radius `ρ` about axis `â`. As seen from the instrument `S`, its two
visible edges are the contact lines of the planes through `S` tangent to the cylinder. A
horizontal cut of a raked cylinder is an **ellipse** (semi-minor `ρ` ⟂ rake, semi-major
`ρ/cosθ` along rake), so the **left and right edges are NOT symmetric** — their ranges and
angles differ. For a vertical pile (`V → ∞`, `θ → 0`) the ellipse becomes a circle and
left = right.

Exact solution (tangent-plane method, includes instrument height):

```
A = (N_A, E_A, Z_A)              # any point on the axis (use the anchor)
S = (N_S, E_S, Z_I)              # instrument (with height)
w = A − S

# orthonormal basis of the plane perpendicular to the axis â:
e1 = normalize(â × ẑ) = ( sinAz_r , −cosAz_r , 0 )            # horizontal, ⟂ rake bearing
e2 = â × e1            = ( −cosθ·cosAz_r , −cosθ·sinAz_r , −sinθ )

p = e1·w ,  q = e2·w ,  R = √(p² + q²) ,  δ = atan2(q, p)

for each side  (k = −1 → LEFT ,  k = +1 → RIGHT):
    ψ  = δ + k · acos(ρ / R)
    n  = cosψ · e1 + sinψ · e2          # tangent-plane normal
    X0 = A − ρ · n                      # a point on the contact generator
    t  = (Zt − X0_Up) / â_Up            # â_Up = −cosθ
    P  = X0 + t · â                     # tangent point → (N, E, Zt)
```

`P_L` and `P_R` are the left/right tangent points at level `Zt`. Requires `R ≥ ρ` (instrument
outside the pile, always true).

---

## 6. Instrument observations to any target `(N_T, E_T)` at level `Zt`

Apply to the three points at each level: centre `C`, left `P_L`, right `P_R`.

```
ΔN = N_T − N_S ,  ΔE = E_T − E_S
Az   = atan2(ΔE, ΔN)  (mod 360)                # azimuth
Turn = (Az − Az_BS)   (mod 360)                # turned angle from backsight = "angle right" (CW)
HD   = √(ΔN² + ΔE²)                             # horizontal distance
Δz   = Zt − Z_I
SD   = √(HD² + Δz²)                             # slope distance
ZA   = 90° − atan2(Δz, HD)                      # zenith angle: 0=up, 90=horizontal, >90=down
```

**Field use:** either (a) orient to azimuth — sight backsight, set the horizontal circle to
`Az_BS`, then turn until the reading equals `Az`; or (b) zero on backsight — set 0 on the
backsight, then turn clockwise until the reading equals `Turn`. Both reach the same point. A
large `Turn` (e.g. 330°) is normal when the target lies just counter-clockwise of the backsight.

---

## 7. Decimal degrees → D°M'S"

```
T = round(x · 3600)
D = floor(T / 3600)
M = floor((T mod 3600) / 60)
S = T mod 60
→  "D°MM'SS\""
```

Excel: `=INT(ROUND(x*3600,0)/3600)&"°"&TEXT(INT(MOD(ROUND(x*3600,0),3600)/60),"00")&"'"&TEXT(MOD(ROUND(x*3600,0),60),"00")&""""`

---

## 8. Excel implementation notes

- **Azimuths**: `ATAN2(ΔN, ΔE)` (see §1 gotcha). Backsight azimuth cell must use the same order.
- **Lookup design values by pile name** (robust to row reordering/insertion in the Design sheet):

  `=INDEX(Design!$C$4:$C$51, MATCH($A5, Design!$B$4:$B$51, 0))`

  Do **not** use `XLOOKUP` if the file must open/recalculate in LibreOffice — it is not
  evaluated there. `INDEX/MATCH` is equivalent and portable to all Excel versions.
- **Recalculate on open**: set workbook `fullCalcOnLoad = true` (or press Ctrl+Alt+F9). openpyxl
  writes formulas without cached values, so a freshly written file shows blanks until recalculated.
- Keep intermediate vector terms (`â`, `e1`, `e2`, `p`, `q`, `R`, `δ`, `ψ`, `n`, `t`) in helper
  columns so every step is auditable.

---

## 9. Python reference implementation (authoritative)

```python
import numpy as np, math

def raked_pile_setout(N_A, E_A, Z_A, Dia, V, Az_r_deg, Zt,
                      N_S, E_S, Z_I, N_B, E_B):
    """Returns centre + left/right tangent observations at level Zt.
    Angles in decimal degrees, distances in metres. Az clockwise from North."""
    rho = Dia / 2.0
    th  = math.atan(1.0 / V)
    Az  = math.radians(Az_r_deg)
    a   = np.array([math.sin(th)*math.cos(Az),
                    math.sin(th)*math.sin(Az),
                   -math.cos(th)])                     # axis unit (N,E,Up), downward
    A = np.array([N_A, E_A, Z_A]); S = np.array([N_S, E_S, Z_I]); w = A - S
    e1 = np.cross(a, [0, 0, 1.0]); e1 /= np.linalg.norm(e1)
    e2 = np.cross(a, e1)
    p, q = e1.dot(w), e2.dot(w)
    R, delta = math.hypot(p, q), math.atan2(q, p)
    Az_BS = math.degrees(math.atan2(E_B - E_S, N_B - N_S)) % 360

    def obs(N, E):
        dN, dE = N - N_S, E - E_S
        hd = math.hypot(dN, dE)
        az = math.degrees(math.atan2(dE, dN)) % 360
        dz = Zt - Z_I
        return dict(N=N, E=E, Az=az, Turn=(az - Az_BS) % 360,
                    HD=hd, SD=math.hypot(hd, dz),
                    ZA=90 - math.degrees(math.atan2(dz, hd)))

    out = {}
    for side, k in (('L', -1), ('R', +1)):
        psi = delta + k * math.acos(rho / R)
        n = math.cos(psi) * e1 + math.sin(psi) * e2
        X0 = A - rho * n
        t = (Zt - X0[2]) / a[2]
        P = X0 + t * a
        out[side] = obs(P[0], P[1])
    sh = (Z_A - Zt) / V
    out['C'] = obs(N_A + sh*math.cos(Az), E_A + sh*math.sin(Az))
    return out
```

---

## 10. Verification

An independent **brute-force silhouette** confirms the analytic result. Parameterise the cylinder
surface normal `m(γ) = cosγ·e1 + sinγ·e2`; the silhouette generators satisfy `m·w = −ρ`, i.e.
`p·cosγ + q·sinγ = −ρ` (two solutions in `γ`). Extrude each generator to level `Zt`; the two
points must equal `P_L`, `P_R`. Additional self-checks:

1. **Centre is station-independent** — move `S`; `C` must not change (only edges/angles do).
2. **Vertical degenerate** — set `V` huge (→ vertical): `HD_left = HD_right` and each tangent
   point lies exactly `ρ` from the centre (circle case).
3. **Centre shift** — `|C(Zt1) − C(Zt2)| = |Zt1 − Zt2| / V`, direction `Az_r`.
4. **On ellipse** — each tangent point satisfies the horizontal-section ellipse equation
   (semi-axes `ρ/cosθ` along rake, `ρ` across).
5. **Field reverse shot** — occupy the station, backsight, turn to `Turn`/`Az` and `ZA`, measure
   `SD`; the shot must graze the pile edge (or hit the staked centre).

---

## 11. Worked example (verified)

**Setup:** Station N 10050.000, E 10600.000, Z 3.000; HI 1.600 → `Z_I` = 4.600.
Backsight N 10050.000, E 10400.000 → **`Az_BS` = 270°00'00"** (due west).
Set-out levels: `Zt_A` = +5.650, `Zt_B` = −5.000.

**Pile MD-1-1:** N_A 9982.195, E_A 10480.755, Z_A 5.650; Dia 1.2192 → ρ 0.6096;
batter 1:5 → θ = 11.3099°; rake azimuth `Az_r` = 45.0°.

**Level A — Zt = +5.650 (= anchor level):**

| Point | N | E | Az | Turn∠ | H-dist | Slope | Zenith |
|---|---|---|---|---|---|---|---|
| CENTRE | 9982.195 | 10480.755 | 240°22'36" | 330°22'36" | 137.175 | 137.179 | 89°33'41" |
| LEFT | 9981.663 | 10481.054 | 240°07'18" | 330°07'18" | 137.180 | 137.184 | 89°33'41" |
| RIGHT | 9982.730 | 10480.461 | 240°37'54" | 330°37'54" | 137.167 | 137.171 | 89°33'41" |

Centre = anchor (Zt = Z_A, no shift). Zenith < 90° because the set-out level is above the
instrument. Left↔Right azimuth spread = 30'36" = the angular width the Ø1.2 m pile subtends at 137 m.

**Level B — Zt = −5.000:**

| Point | N | E | Az | Turn∠ | H-dist | Slope | Zenith |
|---|---|---|---|---|---|---|---|
| CENTRE | 9983.701 | 10482.261 | 240°36'58" | 330°36'58" | 135.122 | 135.463 | 94°03'50" |
| LEFT | 9983.169 | 10482.560 | 240°21'26" | 330°21'26" | 135.125 | 135.465 | 94°03'50" |
| RIGHT | 9984.236 | 10481.967 | 240°52'30" | 330°52'30" | 135.117 | 135.457 | 94°03'50" |

Centre shifted from anchor by `(5.65 − (−5.00))/5 = 2.130 m` along bearing 45°
(ΔN = ΔE = 1.506 m). Zenith > 90° because the set-out level is below the instrument (looking down).

---

## 12. Assumptions and limits

- Pile modelled as a right circular cylinder; setting out at a defined level, no wall thickness.
- Rake bearing and batter are per-pile design inputs; the calculator does not derive them.
- Geometry only — it does **not** verify the drawing revision, the site datum, or the design
  rake azimuths. A licensed surveyor must confirm those before staking.
