# Class 11 CBSE Knowledge Map (Physics, Chemistry, Mathematics)

This page is designed as a revision-first graph: short labels, formula nodes, and cross-links.

```mermaid
flowchart LR

%% =========================
%% ROOT
%% =========================
ROOT[Class 11 CBSE Knowledge Map]
P[Physics]
C[Chemistry]
M[Maths]

ROOT --> P
ROOT --> C
ROOT --> M

%% =========================
%% PHYSICS
%% =========================
P1[Physical World]
P2[Units and Measurements]
P2a[SI Units]
P2b[Dimensions]
P2c[Errors]

P3[Motion in a Straight Line]
P3a[Displacement]
P3b[Velocity]
P3c[Acceleration]
P3d[Graphs]
P3f((v = u + at))
P3g((s = ut + 1/2at^2))

P4[Motion in a Plane]
P4a[Vectors]
P4b[Projectile Motion]
P4f((R = u^2 sin2theta / g))

P5[Laws of Motion]
P5a[Newton Laws]
P5b[Friction]
P5f((F = ma))

P6[Work Energy Power]
P6a[Kinetic Energy]
P6b[Potential Energy]
P6c[Work-Energy Theorem]
P6f((W = Delta K))
P6g((K = 1/2mv^2))

P7[System of Particles and Rotational Motion]
P7a[Center of Mass]
P7b[Torque]
P7c[Angular Momentum]
P7f((tau = I alpha))
P7g((L = I omega))

P8[Gravitation]
P8a[Law of Gravitation]
P8b[Satellites]
P8f((F = Gm1m2/r^2))
P8g((v_orbit = root(GM/r)))

P9[Mechanical Properties of Solids]
P9a[Stress]
P9b[Strain]
P9c[Elasticity]
P9f((Y = stress/strain))

P10[Mechanical Properties of Fluids]
P10a[Pressure]
P10b[Viscosity]
P10c[Surface Tension]
P10f((P = rho gh))
P10g((F = eta A dv/dx))

P11[Thermal Properties of Matter]
P11a[Heat]
P11b[Temperature]
P11c[Expansion]
P11f((Q = mc Delta T))

P12[Thermodynamics]
P12a[Laws of Thermodynamics]
P12b[Heat Engines]
P12f((Delta U = Q - W))

P13[Kinetic Theory]
P13a[Gas Laws]
P13b[Molecular Nature]
P13f((PV = nRT))
P13g((KE_avg = 3/2 kT))

P14[Oscillations]
P14a[SHM]
P14b[Time Period]
P14f((T = 2pi root(m/k)))

P15[Waves]
P15a[Wave Motion]
P15b[Sound Waves]
P15f((v = f lambda))

P --> P1
P --> P2
P --> P3
P --> P4
P --> P5
P --> P6
P --> P7
P --> P8
P --> P9
P --> P10
P --> P11
P --> P12
P --> P13
P --> P14
P --> P15

P2 --> P2a
P2 --> P2b
P2 --> P2c

P3 --> P3a
P3 --> P3b
P3 --> P3c
P3 --> P3d
P3 --> P3f
P3 --> P3g

P4 --> P4a
P4 --> P4b
P4 --> P4f

P5 --> P5a
P5 --> P5b
P5 --> P5f

P6 --> P6a
P6 --> P6b
P6 --> P6c
P6 --> P6f
P6 --> P6g

P7 --> P7a
P7 --> P7b
P7 --> P7c
P7 --> P7f
P7 --> P7g

P8 --> P8a
P8 --> P8b
P8 --> P8f
P8 --> P8g

P9 --> P9a
P9 --> P9b
P9 --> P9c
P9 --> P9f

P10 --> P10a
P10 --> P10b
P10 --> P10c
P10 --> P10f
P10 --> P10g

P11 --> P11a
P11 --> P11b
P11 --> P11c
P11 --> P11f

P12 --> P12a
P12 --> P12b
P12 --> P12f

P13 --> P13a
P13 --> P13b
P13 --> P13f
P13 --> P13g

P14 --> P14a
P14 --> P14b
P14 --> P14f

P15 --> P15a
P15 --> P15b
P15 --> P15f

%% =========================
%% CHEMISTRY
%% =========================
C1[Basic Concepts]
C1a[Mole Concept]
C1b[Stoichiometry]
C1f((n = mass/M))

C2[Structure of Atom]
C2a[Bohr Model]
C2b[Quantum Numbers]

C3[Classification and Periodicity]
C3a[Periodic Trends]

C4[Chemical Bonding]
C4a[Ionic Bond]
C4b[Covalent Bond]
C4c[VSEPR]

C5[States of Matter]
C5a[Gas Laws]
C5b[Liquids]
C5f((PV = nRT))

C6[Thermodynamics]
C6a[Delta H Delta U]
C6f((Delta H = Delta U + Delta n_g RT))

C7[Equilibrium]
C7a[Chemical Eq]
C7b[Ionic Eq]
C7f((Kc expression))

C8[Redox Reactions]
C8a[Oxidation Number]
C8b[Balancing Redox]

C9[Organic Basic Principles]
C9a[Hybridization]
C9b[Isomerism]

C10[Hydrocarbons]
C10a[Alkanes]
C10b[Alkenes]
C10c[Alkynes]
C10d[Aromatic]

C11[Hydrogen]
C11a[Hydrides]
C11b[Water and H2O2]

C12[s-Block Elements]
C12a[Group 1 and 2]

C13[p-Block Elements]
C13a[Boron Family]
C13b[Carbon Family]

C14[Environmental Chemistry]
C14a[Pollution]
C14b[Green Chemistry]

C --> C1
C --> C2
C --> C3
C --> C4
C --> C5
C --> C6
C --> C7
C --> C8
C --> C9
C --> C10
C --> C11
C --> C12
C --> C13
C --> C14

C1 --> C1a
C1 --> C1b
C1 --> C1f

C2 --> C2a
C2 --> C2b

C3 --> C3a

C4 --> C4a
C4 --> C4b
C4 --> C4c

C5 --> C5a
C5 --> C5b
C5 --> C5f

C6 --> C6a
C6 --> C6f

C7 --> C7a
C7 --> C7b
C7 --> C7f

C8 --> C8a
C8 --> C8b

C9 --> C9a
C9 --> C9b

C10 --> C10a
C10 --> C10b
C10 --> C10c
C10 --> C10d

C11 --> C11a
C11 --> C11b

C12 --> C12a
C13 --> C13a
C13 --> C13b

C14 --> C14a
C14 --> C14b

%% =========================
%% MATHEMATICS
%% =========================
M1[Sets]
M1a[Set Operations]
M1b[Venn]

M2[Relations and Functions]
M2a[Domain Range]
M2b[Types of Functions]

M3[Trigonometric Functions]
M3a[Identities]
M3b[Equations]
M3f((sin^2x + cos^2x = 1))

M4[Mathematical Induction]
M4a[Base Step]
M4b[Inductive Step]

M5[Complex Numbers and Quadratics]
M5a[Argand Plane]
M5b[Roots Nature]
M5f((x = (-b +/- root(b^2-4ac))/2a))

M6[Linear Inequalities]
M6a[Graphical Region]

M7[Permutations and Combinations]
M7a[nPr]
M7b[nCr]
M7f((nPr = n!/(n-r)!))
M7g((nCr = n!/(r!(n-r)!)))

M8[Binomial Theorem]
M8a[General Term]
M8f((T_(r+1) = nCr a^(n-r)b^r))

M9[Sequences and Series]
M9a[AP]
M9b[GP]
M9f((S_n(AP)=n/2(2a+(n-1)d)))
M9g((S_n(GP)=a(r^n-1)/(r-1)))

M10[Straight Lines]
M10a[Slope Form]
M10b[Distance of Point]
M10f((y=mx+c))

M11[Conic Sections]
M11a[Circle]
M11b[Parabola]
M11c[Ellipse]
M11d[Hyperbola]
M11f((x^2/a^2 + y^2/b^2 = 1))

M12[Intro to 3D Geometry]
M12a[Direction Cosines]
M12b[Distance Formula]

M13[Limits and Derivatives]
M13a[Limit Laws]
M13b[Derivative as Rate]
M13f((d/dx x^n = n x^(n-1)))

M14[Statistics]
M14a[Mean Median Mode]
M14b[Variance SD]
M14f((mean = Sigma f_i x_i / Sigma f_i))

M15[Probability]
M15a[Sample Space]
M15b[Conditional Probability]
M15f((P(A) = n(A)/n(S)))

M --> M1
M --> M2
M --> M3
M --> M4
M --> M5
M --> M6
M --> M7
M --> M8
M --> M9
M --> M10
M --> M11
M --> M12
M --> M13
M --> M14
M --> M15

M1 --> M1a
M1 --> M1b

M2 --> M2a
M2 --> M2b

M3 --> M3a
M3 --> M3b
M3 --> M3f

M4 --> M4a
M4 --> M4b

M5 --> M5a
M5 --> M5b
M5 --> M5f

M6 --> M6a

M7 --> M7a
M7 --> M7b
M7 --> M7f
M7 --> M7g

M8 --> M8a
M8 --> M8f

M9 --> M9a
M9 --> M9b
M9 --> M9f
M9 --> M9g

M10 --> M10a
M10 --> M10b
M10 --> M10f

M11 --> M11a
M11 --> M11b
M11 --> M11c
M11 --> M11d
M11 --> M11f

M12 --> M12a
M12 --> M12b

M13 --> M13a
M13 --> M13b
M13 --> M13f

M14 --> M14a
M14 --> M14b
M14 --> M14f

M15 --> M15a
M15 --> M15b
M15 --> M15f

%% =========================
%% CROSS-LINKS (INTERDISCIPLINARY)
%% =========================
M13b -. rate of change .-> P3c
M13b -. slope and graphs .-> P3d
M3a -. vectors and components .-> P4a
M10a -. motion graphs .-> P3d
M15a -. kinetic theory randomness .-> P13b
C6 -. energy principles .-> P12
C5a -. gas laws overlap .-> P13a
C7 -. equilibrium analogy .-> P12a
C1b -. stoichiometric ratios .-> M7
M9 -. oscillatory patterns .-> P14
M11 -. wave fronts geometry .-> P15

%% =========================
%% STYLES
%% =========================
classDef physics fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#0b3a75;
classDef chemistry fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d;
classDef maths fill:#ffedd5,stroke:#f97316,stroke-width:1.5px,color:#7c2d12;
classDef formula fill:#fff7ed,stroke:#ea580c,stroke-width:2px,color:#7c2d12;
classDef root fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#0f172a;

class ROOT root;
class P,P1,P2,P2a,P2b,P2c,P3,P3a,P3b,P3c,P3d,P4,P4a,P4b,P5,P5a,P5b,P6,P6a,P6b,P6c,P7,P7a,P7b,P7c,P8,P8a,P8b,P9,P9a,P9b,P9c,P10,P10a,P10b,P10c,P11,P11a,P11b,P11c,P12,P12a,P12b,P13,P13a,P13b,P14,P14a,P14b,P15,P15a,P15b physics;
class C,C1,C1a,C1b,C2,C2a,C2b,C3,C3a,C4,C4a,C4b,C4c,C5,C5a,C5b,C6,C6a,C7,C7a,C7b,C8,C8a,C8b,C9,C9a,C9b,C10,C10a,C10b,C10c,C10d,C11,C11a,C11b,C12,C12a,C13,C13a,C13b,C14,C14a,C14b chemistry;
class M,M1,M1a,M1b,M2,M2a,M2b,M3,M3a,M3b,M4,M4a,M4b,M5,M5a,M5b,M6,M6a,M7,M7a,M7b,M8,M8a,M9,M9a,M9b,M10,M10a,M10b,M11,M11a,M11b,M11c,M11d,M12,M12a,M12b,M13,M13a,M13b,M14,M14a,M14b,M15,M15a,M15b maths;
class P3f,P3g,P4f,P5f,P6f,P6g,P7f,P7g,P8f,P8g,P9f,P10f,P10g,P11f,P12f,P13f,P13g,P14f,P15f,C1f,C5f,C6f,C7f,M3f,M5f,M7f,M7g,M8f,M9f,M9g,M10f,M11f,M13f,M14f,M15f formula;
```

## Revision Legend
- Blue nodes: Physics
- Green nodes: Chemistry
- Orange nodes: Maths
- Double-circle style nodes: High-value formulas
- Dotted links: Cross-subject bridges for integrated revision
