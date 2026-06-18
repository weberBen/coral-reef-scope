# Solutions explorées — Coral Reef Scope

Récapitulatif de toutes les approches envisagées, testées ou retenues pour la simulation du récif et des coraux.

---

## 1. Simulation de l'amarrage / mouillage

### 1.1 Verlet 2D — éléments discrets (HTML)

**Fichier** : `reef-mooring-sim.html`
**Statut** : Implémenté (prototype 2D)

- Intégrateur de Verlet avec contraintes de distance (relaxation itérative, 18 passes)
- Câble = chaîne de N nœuds inextensibles, ancre fixée au fond
- Forces : flottabilité, drag (Morison normal + tangentiel), houle Airy, vent en surface
- Tensions calculées par accumulation descendante (quasi-statique)
- Profils de courant : linéaire, uniforme, concentré en surface
- Treuil (déploiement / rembobinage)
- Limitation : 2D uniquement, pas de courants directionnels 3D

**Références** :
- Théorie des ondes d'Airy (vitesses orbitales en eau profonde)
- Équation de Morison (drag normal Cd=1.2 + tangentiel Cf=0.1)

### 1.2 MoorPy — équilibre statique

**Fichier** : `coral_sim/mooring.py`
**Statut** : Implémenté

- Charge un fichier MoorDyn v2 (.dat) via MoorPy
- Résout l'équilibre statique (catenary solver)
- Extrait les positions pour visualisation dans Viser
- Format MoorDyn = standard industriel (NREL / OpenFAST)
- Utilisé pour un réseau de 4 ancres, 4 bouées, 1 point central, 12 lignes

**Références** :
- MoorPy (NREL) — solveur statique catenary
- MoorDyn v2 — format de fichier standard pour les systèmes d'amarrage

### 1.3 MuJoCo — simulation dynamique 3D

**Fichier** : `coral_sim/anchor_sim.py`
**Statut** : Implémenté (version actuelle)

- Chaîne de corps rigides (capsules) connectés par des joints ball
- Gravité MuJoCo activée, forces externes via `xfrc_applied` :
  - Poussée d'Archimède (par segment, vectorisé NumPy)
  - Drag hydrodynamique (Morison, composantes normale/tangentielle)
  - Houle (vitesses orbitales Airy, profondeur variable)
  - Vent (surface, loi 3% de la vitesse du vent)
  - Treuil (contrôle PD de la longueur câble)
- Matériaux de câble : polyester, nylon, Dyneema, acier
- Flotteurs intermédiaires configurables
- Tensions par accumulation descendante (comme le prototype HTML)
- Visualisation temps réel dans Viser avec GUI interactive

**Références** :
- MuJoCo (DeepMind) — moteur physique multi-corps
- Équation de Morison pour le drag sur cylindres

### 1.4 Outils mentionnés mais non implémentés

| Outil | Description | Raison de non-utilisation |
|-------|-------------|--------------------------|
| **MoorDyn** (dynamique) | Simulation dynamique de lignes d'amarrage (NREL) | Prévu pour la suite ; MoorPy suffit pour le statique |
| **Project Chrono** | Moteur multi-physique (fluide-structure) | Trop lourd pour le prototypage |
| **OrcaFlex** | Logiciel commercial de simulation offshore | Licence payante, hors scope |
| **OpenFAST** | Simulation éolienne offshore (NREL) | Trop spécialisé éolien, mais format MoorDyn compatible |

---

## 2. Génération de coraux

### 2.1 DLA — Diffusion-Limited Aggregation

**Commit** : `d0c0c27` (feat: add support for differential growth)
**Statut** : Abandonné

- Librairie `dlacorals` (Bakels et al. 2024, UvA/VU Amsterdam)
- Grille 3D, graines au fond, marche aléatoire avec drift
- Agrégation au contact avec biais solaire (`sun_vec`)
- Résultat : grille binaire → marching cubes → trimesh
- Deux types de colonies :
  - **Branchus** (Pocillopora, Acropora) : DLA classique
  - **Massifs** (Porites) : sphère bruitée OpenSimplex
- Placement sur le terrain via Poisson-disk sampling + filtrage par profondeur

**Pourquoi abandonné** : trop lent, instable, difficile à contrôler à l'échelle du récif (km)

**Références** :
- Bakels et al. (2024) — dlacorals, modèle DLA pour morphologie corallienne (Université d'Amsterdam)
- Witten & Sander (1981) — Diffusion-Limited Aggregation, modèle original

### 2.2 Differential Growth

**Commit** : `d0c0c27` (feat: add support for differential growth)
**Statut** : Exploré, abandonné

- Technique de croissance de maillage où les arêtes se subdivisent et les nœuds se repoussent
- Produit des formes organiques (ondulations, plis) similaires aux coraux foliacés
- Combiné avec DLA dans le même commit

**Pourquoi abandonné** : instabilité numérique, temps de calcul prohibitif pour des milliers de colonies

**Références** :
- Nervous System (Jessica Rosenkrantz & Jesse Louis-Rosenberg) — differential growth pour la génération de formes biologiques
- Blog IAAC (Institute for Advanced Architecture of Catalonia) — applications en design computationnel
- Inconvergent (Anders Hoff) — implémentations artistiques de differential growth

### 2.3 Infinigen

**Statut** : Exploré, abandonné

- Générateur procédural de scènes naturelles (Princeton)
- Inclut des assets de coraux de haute qualité
- Problèmes : nécessite Python 3.11 + Blender, impossible d'importer des cartes de profondeur custom
- Idée résiduelle : générer des meshes coral sur un serveur distant, les utiliser comme assets visuels localement

**Pourquoi abandonné** : incompatible Python 3.13, dépendance Blender trop lourde, pas d'API pour intégrer un terrain custom

**Références** :
- Infinigen (Raistrick et al., Princeton 2023) — "Infinite Photorealistic Worlds using Procedural Generation"

### 2.4 KJMA — Kolmogorov-Johnson-Mehl-Avrami (retenu)

**Fichier** : `coral_sim/colony.py`
**Statut** : Implémenté (version actuelle)

- Modèle analytique de cristallisation/croissance compétitive
- Seeds distribués par zone de profondeur (densité configurable)
- Chaque seed a une vitesse de croissance = f(lumière, pente, courant)
- Croissance ellipsoïdale (anisotropie configurable)
- Attribution des vertices : chaque point → seed le plus rapide à l'atteindre (distance ellipsoïdale)
- Frontières naturelles par compétition (premier arrivé gagne)
- Déformation du terrain : profil parabolique + creux aux frontières
- Calcul vectorisé NumPy, par chunks pour limiter la RAM (~5s pour 54K vertices x 2000 seeds)

**Pourquoi retenu** : analytique (pas d'itération), rapide, contrôlable, adapté à l'échelle km

**Références** :
- Kolmogorov (1937) — "On the statistical theory of the crystallization of metals"
- Johnson & Mehl (1939) — "Reaction kinetics in processes of nucleation and growth"
- Avrami (1939-1941) — série de 3 articles sur la cinétique de transformation

### 2.5 Autres approches discutées (non implémentées)

| Approche | Description | Pertinence |
|----------|-------------|------------|
| **Reaction-Diffusion** (Turing) | Motifs par systèmes de Gray-Scott / FitzHugh-Nagumo | Génère des motifs 2D (texture), pas des formes 3D |
| **L-systems** | Grammaires formelles pour structures branchues | Bon pour coraux branchus individuels, pas pour un récif entier |
| **Eden Model** | Croissance aléatoire sur grille (agrégation de voisins) | Trop simple, pas de contrôle morphologique |
| **Morphogènes** | Gradients chimiques guidant la croissance | Coûteux en calcul (PDE), plus adapté à la recherche biologique |
| **FEM (éléments finis)** | Simulation mécanique de la croissance squelettique | Échelle trop fine pour un récif entier |

---

## 3. Terrain / Données bathymétriques

### 3.1 Allen Coral Atlas (retenu)

**Fichier** : `coral_sim/terrain/allen.py`

- WFS public (couches géomorphiques + benthiques)
- Rasterisation via Shapely STRtree
- Profondeur approximée par mapping zone → profondeur typique
- Pas de vraie bathymétrie (seulement classification)
- Cache local des requêtes

**Références** :
- Allen Coral Atlas (allencoralatlas.org) — cartographie mondiale des récifs par satellite

### 3.2 Terrain procédural (retenu)

**Fichier** : `coral_sim/terrain/procedural.py`

- Zones rectangulaires avec profils spline (points de contrôle distance/profondeur)
- Rugosité par fBm (fractional Brownian Motion) via OpenSimplex
- Multi-zone configurable

### 3.3 Photogrammétrie Sketchfab (legacy)

**Fichier** : `reef_3d.py`

- Téléchargement de modèles 3D scannés (Structure-from-Motion)
- Modèles utilisés : REXCOR (Marseille), Réserve Cousteau (Guadeloupe)
- Visualisation Plotly 3D
- Abandonné au profit de Viser (plus interactif, Python-driven)

**Références** :
- Sketchfab — plateforme de modèles 3D (photogrammétrie sous-marine)
- Septentrion Environnement — modèle REXCOR
- Sea(e)scape — modèle Guadeloupe

---

## 4. Visualisation

| Solution | Statut | Notes |
|----------|--------|-------|
| **Viser** (retenu) | Implémenté | Python → WebSocket → Three.js, port 8080 |
| **Plotly** | Legacy (`reef_3d.py`) | HTML statique, pas de contrôle temps réel |
| **Three.js pur** | Exploré | Meilleurs shaders (contour lines au hover), mais trop de JS custom |
| **MapLibre** | Exploré | Affichait l'île au lieu du récif (tuiles satellite) |

---

## 5. Récapitulatif des choix finaux

| Composant | Solution retenue | Alternatives testées |
|-----------|-----------------|---------------------|
| **Simulation amarrage** | MuJoCo 3D + Viser | Verlet 2D (HTML), MoorPy (statique) |
| **Croissance coraux** | KJMA anisotrope | DLA (dlacorals), Differential Growth, Infinigen |
| **Terrain** | Allen Coral Atlas + procédural | — |
| **Visualisation** | Viser | Plotly, Three.js, MapLibre, Sketchfab |
| **Format amarrage** | MoorDyn v2 (.dat) | — |
