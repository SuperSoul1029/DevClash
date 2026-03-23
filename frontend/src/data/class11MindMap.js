export const class11MindMapDefinition = `
flowchart LR

ROOT[Class 11 CBSE Knowledge Map]
P[Physics]
C[Chemistry]
M[Maths]

ROOT --> P
ROOT --> C
ROOT --> M

P --> P1[Physical World]
P --> P2[Units and Measurements]
P2 --> P2a[SI Units]
P2 --> P2b[Dimensions]
P2 --> P2c[Errors]

P --> P3[Motion in a Straight Line]
P3 --> P3a[Displacement]
P3 --> P3b[Velocity]
P3 --> P3c[Acceleration]
P3 --> P3d[Graphs]
P3 --> P3f((v = u + at))
P3 --> P3g((s = ut + 1/2at^2))

P --> P4[Motion in a Plane]
P4 --> P4a[Vectors]
P4 --> P4b[Projectile Motion]
P4 --> P4f((R = u^2 sin2theta / g))

P --> P5[Laws of Motion]
P5 --> P5a[Newton Laws]
P5 --> P5b[Friction]
P5 --> P5f((F=ma))

P --> P6[Work Energy and Power]
P6 --> P6a[Kinetic Energy]
P6 --> P6b[Potential Energy]
P6 --> P6c[Work-Energy Theorem]
P6 --> P6f((W = Delta K))
P6 --> P6g((K = 1/2mv^2))

P --> P7[System of Particles and Rotational Motion]
P7 --> P7a[Center of Mass]
P7 --> P7b[Torque]
P7 --> P7c[Angular Momentum]
P7 --> P7f((tau = I alpha))
P7 --> P7g((L = I omega))

P --> P8[Gravitation]
P8 --> P8a[Law of Gravitation]
P8 --> P8b[Satellites]
P8 --> P8f((F = Gm1m2/r^2))
P8 --> P8g((v_orbit = root(GM/r)))

P --> P9[Mechanical Properties of Solids]
P9 --> P9a[Stress]
P9 --> P9b[Strain]
P9 --> P9c[Elasticity]
P9 --> P9f((Y = stress/strain))

P --> P10[Mechanical Properties of Fluids]
P10 --> P10a[Pressure]
P10 --> P10b[Viscosity]
P10 --> P10c[Surface Tension]
P10 --> P10f((P = rho gh))
P10 --> P10g((F = eta A dv/dx))

P --> P11[Thermal Properties of Matter]
P11 --> P11a[Heat]
P11 --> P11b[Temperature]
P11 --> P11c[Expansion]
P11 --> P11f((Q = mc Delta T))

P --> P12[Thermodynamics]
P12 --> P12a[Laws of Thermodynamics]
P12 --> P12b[Heat Engines]
P12 --> P12f((Delta U = Q - W))

P --> P13[Kinetic Theory]
P13 --> P13a[Gas Laws]
P13 --> P13b[Molecular Nature]
P13 --> P13f((PV = nRT))
P13 --> P13g((KE_avg = 3/2 kT))

P --> P14[Oscillations]
P14 --> P14a[SHM]
P14 --> P14b[Time Period]
P14 --> P14f((T = 2pi root(m/k)))

P --> P15[Waves]
P15 --> P15a[Wave Motion]
P15 --> P15b[Sound Waves]
P15 --> P15f((v = f lambda))

C --> C1[Basic Concepts]
C1 --> C1a[Mole Concept]
C1 --> C1b[Stoichiometry]
C1 --> C1f((n = mass/M))

C --> C2[Structure of Atom]
C2 --> C2a[Bohr Model]
C2 --> C2b[Quantum Numbers]

C --> C3[Classification and Periodicity]
C3 --> C3a[Periodic Trends]

C --> C4[Chemical Bonding]
C4 --> C4a[Ionic Bond]
C4 --> C4b[Covalent Bond]
C4 --> C4c[VSEPR]

C --> C5[States of Matter]
C5 --> C5a[Gas Laws]
C5 --> C5b[Liquids]
C5 --> C5f((PV = nRT))

C --> C6[Thermodynamics]
C6 --> C6a[Delta H Delta U]
C6 --> C6f((Delta H = Delta U + Delta n_g RT))

C --> C7[Equilibrium]
C7 --> C7a[Chemical Eq]
C7 --> C7b[Ionic Eq]
C7 --> C7f((Kc expression))

C --> C8[Redox Reactions]
C8 --> C8a[Oxidation Number]
C8 --> C8b[Balancing Redox]

C --> C9[Organic Basic Principles]
C9 --> C9a[Hybridization]
C9 --> C9b[Isomerism]

C --> C10[Hydrocarbons]
C10 --> C10a[Alkanes]
C10 --> C10b[Alkenes]
C10 --> C10c[Alkynes]
C10 --> C10d[Aromatic]

C --> C11[Hydrogen]
C11 --> C11a[Hydrides]
C11 --> C11b[Water and H2O2]

C --> C12[s-Block Elements]
C12 --> C12a[Group 1 and 2]

C --> C13[p-Block Elements]
C13 --> C13a[Boron Family]
C13 --> C13b[Carbon Family]

C --> C14[Environmental Chemistry]
C14 --> C14a[Pollution]
C14 --> C14b[Green Chemistry]

M --> M1[Sets]
M1 --> M1a[Set Operations]
M1 --> M1b[Venn]

M --> M2[Relations and Functions]
M2 --> M2a[Domain Range]
M2 --> M2b[Types of Functions]

M --> M3[Trigonometric Functions]
M3 --> M3a[Identities]
M3 --> M3b[Equations]
M3 --> M3f((sin^2x + cos^2x = 1))

M --> M4[Mathematical Induction]
M4 --> M4a[Base Step]
M4 --> M4b[Inductive Step]

M --> M5[Complex Numbers and Quadratics]
M5 --> M5a[Argand Plane]
M5 --> M5b[Roots Nature]
M5 --> M5f((x = (-b +/- root(b^2-4ac))/2a))

M --> M6[Linear Inequalities]
M6 --> M6a[Graphical Region]

M --> M7[Permutations and Combinations]
M7 --> M7a[nPr]
M7 --> M7b[nCr]
M7 --> M7f((nPr = n!/(n-r)!))
M7 --> M7g((nCr = n!/(r!(n-r)!)))

M --> M8[Binomial Theorem]
M8 --> M8a[General Term]
M8 --> M8f((T_(r+1) = nCr a^(n-r)b^r))

M --> M9[Sequences and Series]
M9 --> M9a[AP]
M9 --> M9b[GP]
M9 --> M9f((S_n(AP)=n/2(2a+(n-1)d)))
M9 --> M9g((S_n(GP)=a(r^n-1)/(r-1)))

M --> M10[Straight Lines]
M10 --> M10a[Slope Form]
M10 --> M10b[Distance of Point]
M10 --> M10f((y=mx+c))

M --> M11[Conic Sections]
M11 --> M11a[Circle]
M11 --> M11b[Parabola]
M11 --> M11c[Ellipse]
M11 --> M11d[Hyperbola]
M11 --> M11f((x^2/a^2 + y^2/b^2 = 1))

M --> M12[Introduction to 3D Geometry]
M12 --> M12a[Direction Cosines]
M12 --> M12b[Distance Formula]

M --> M13[Limits and Derivatives]
M13 --> M13a[Limit Laws]
M13 --> M13b[Derivative as Rate]
M13 --> M13f((d/dx x^n = n x^(n-1)))

M --> M14[Statistics]
M14 --> M14a[Mean Median Mode]
M14 --> M14b[Variance and SD]
M14 --> M14f((mean = Sigma f_i x_i / Sigma f_i))

M --> M15[Probability]
M15 --> M15a[Sample Space]
M15 --> M15b[Conditional Probability]
M15 --> M15f((P(A) = n(A)/n(S)))

M13b -. calculus to motion .-> P3c
M13b -. slope to motion graphs .-> P3d
M3a -. vector components .-> P4a
M10a -. line slope in kinematics .-> P3d
M15a -. randomness model .-> P13b
C6 -. energy transfer laws .-> P12
C5a -. shared gas laws .-> P13a
C7 -. equilibrium idea .-> P12a
C1b -. ratio logic .-> M7
M9 -. periodic behavior patterns .-> P14
M11 -. geometry in wavefronts .-> P15

style ROOT fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#0f172a
style P fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#0b3a75
style C fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
style M fill:#ffedd5,stroke:#f97316,stroke-width:2px,color:#7c2d12
`

export const class11CrossLinks = [
  'Limits and derivatives -> Motion acceleration and graph slope',
  'Trigonometry -> Vectors and projectile components',
  'Chemistry thermodynamics -> Physics thermodynamics',
  'Gas laws in chemistry -> Kinetic theory in physics',
  'Stoichiometric ratios -> Permutations and combinations logic',
]