export function buildPresentation() {
  const el = document.getElementById('presentation');
  if (!el) return;

  el.innerHTML = `

<!-- ============ HERO ============ -->
<section class="deck hero">
  <canvas class="hero-particles" id="hero-canvas"></canvas>
  <div class="hero-rays"></div>
  <div class="deck-content hero-content">
    <div class="hero-badge">Reef Monitoring System</div>
    <h1 class="reveal">CORAL</h1>
    <p class="reveal d1">Surveillance autonome des recifs coralliens</p>
    <p class="reveal d2 hero-sub">Un systeme ou chaque capteur remonte, se recharge,<br>et replonge — sans intervention humaine sous l'eau.</p>
  </div>
  <div class="scroll-cue reveal d3">
    <div class="scroll-line"></div>
    <span>Decouvrir</span>
  </div>
</section>

<!-- ============ PROBLEME - immersif ============ -->
<section class="deck dark-ocean">
  <div class="deck-bg-anim bubbles-bg"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">Le monitoring sous-marin aujourd'hui</h2>
    <p class="reveal big-statement">Chaque methode existante impose un compromis<br>entre <em>cout</em>, <em>risque</em> et <em>couverture</em>.</p>
  </div>
</section>

<section class="deck problem-cards">
  <div class="deck-content">
    <div class="problem-row">
      <div class="pcard reveal">
        <div class="pcard-visual">
          <div class="pcard-icon camera-icon">
            <div class="biofouling-layer"></div>
          </div>
        </div>
        <h3>Cameras fixes</h3>
        <p>Biofouling en quelques semaines.<br>Plongeurs requis pour chaque maintenance.</p>
        <div class="pcard-tag bad">OPEX eleve</div>
      </div>
      <div class="pcard reveal d1">
        <div class="pcard-visual">
          <div class="pcard-icon drone-icon">
            <div class="collision-flash"></div>
          </div>
        </div>
        <h3>Drones sous-marins</h3>
        <p>Controle en eau complexe.<br>Risque de collision avec le corail.</p>
        <div class="pcard-tag bad">Risque + cout R&D</div>
      </div>
      <div class="pcard reveal d2">
        <div class="pcard-visual">
          <div class="pcard-icon power-icon">
            <div class="power-pulse"></div>
          </div>
        </div>
        <h3>Alimentation</h3>
        <p>Cables sous-marins ou bouees solaires.<br>Infrastructure lourde, impact visuel.</p>
        <div class="pcard-tag bad">Non scalable</div>
      </div>
    </div>
  </div>
</section>

<!-- ============ TRANSITION ============ -->
<section class="deck transition-section">
  <div class="deck-content">
    <p class="reveal big-statement">Et si on inversait le probleme ?</p>
    <p class="reveal d1 big-statement accent">Au lieu d'aller entretenir les capteurs...<br>les capteurs viennent a nous.</p>
  </div>
</section>

<!-- ============ SOLUTION TITLE ============ -->
<section class="deck solution-hero">
  <div class="deck-bg-gradient cyan-glow"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">Notre approche</h2>
    <h3 class="reveal mega-title">Systeme hybride<br>cable + flotteur</h3>
    <p class="reveal d1 sub-text" style="text-align:center;margin:16px auto 0">Scrollez pour voir le cycle complet</p>
  </div>
</section>

<!-- ============ CYCLE — sticky scroll 4 phases ============ -->
<div class="cycle-scroll-wrap" id="cycle-wrap">
  <!-- Sticky diagram -->
  <div class="cycle-sticky">
    <svg viewBox="0 0 900 460" class="cycle-svg" id="cycle-svg">
      <!-- Ocean -->
      <rect x="0" y="75" width="900" height="385" fill="url(#cyOcean)"/>
      <path d="M0 75 Q112 60 225 75 T450 75 T675 75 T900 75" fill="none" stroke="rgba(56,189,248,0.25)" stroke-width="1.5"/>
      <!-- Seabed -->
      <rect x="0" y="400" width="720" height="60" fill="#2a1f14"/>
      <!-- Shore -->
      <path d="M720 75 L750 75 L900 75 L900 460 L720 460Z" fill="#3d2e1a" opacity="0.35"/>
      <text x="810" y="60" text-anchor="middle" fill="#c8b99a" font-size="13" font-weight="700" font-family="Inter,sans-serif">RIVE</text>

      <!-- ===== PERMANENT: Anchor only ===== -->
      <g id="cy-station">
        <rect x="280" y="395" width="40" height="14" rx="4" fill="#64748b"/>
        <rect x="292" y="383" width="16" height="16" rx="3" fill="#718096"/>
      </g>

      <!-- ===== Cable + buoy: appear from phase 2 ===== -->
      <g id="cy-cable-group" opacity="0">
        <line x1="300" y1="383" x2="300" y2="83" stroke="#38bdf8" stroke-width="2.5" opacity="0.6"/>
        <circle cx="300" cy="80" r="7" fill="#f97316" opacity="0.8"/>
      </g>

      <!-- ===== PHASE 1: Device anchored, camera scanning ===== -->
      <g id="cy-phase1" class="cy-phase" opacity="0">
        <!-- Device at bottom -->
        <rect x="286" y="310" width="28" height="22" rx="4" fill="#e2e8f0" id="cy-dev1"/>
        <circle cx="300" cy="302" r="7" fill="#f97316"/>
        <!-- Camera lens -->
        <circle cx="300" cy="319" r="4" fill="#1a202c"/>
        <!-- Scan cone -->
        <path d="M290 332 L240 400 L360 400Z" fill="rgba(56,189,248,0.06)" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.5"/>
        <!-- Rotating scan line -->
        <line x1="300" y1="332" x2="260" y2="395" stroke="#38bdf8" stroke-width="1" opacity="0.4" class="scan-rotate"/>
        <line x1="300" y1="332" x2="340" y2="395" stroke="#38bdf8" stroke-width="1" opacity="0.4" class="scan-rotate2"/>
      </g>

      <!-- ===== PHASE 2: Device ascending ===== -->
      <g id="cy-phase2" class="cy-phase" opacity="0">
        <!-- 24h indicator -->
        <rect x="340" y="220" width="52" height="24" rx="12" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" stroke-width="1"/>
        <text x="366" y="237" text-anchor="middle" fill="#fbbf24" font-size="12" font-weight="700" font-family="Inter,sans-serif">24h</text>
        <!-- Device rising (animated) -->
        <g class="device-rise-anim">
          <rect x="286" y="180" width="28" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="300" cy="172" r="7" fill="#f97316"/>
          <!-- Bubbles trail -->
          <circle cx="294" cy="210" r="2" fill="#38bdf8" opacity="0.3" class="bubble-trail"/>
          <circle cx="306" cy="220" r="1.5" fill="#38bdf8" opacity="0.2" class="bubble-trail d1"/>
          <circle cx="298" cy="230" r="2.5" fill="#38bdf8" opacity="0.25" class="bubble-trail d2"/>
        </g>
        <!-- Arrow up -->
        <path d="M300 168 L300 95" stroke="#34d399" stroke-width="2" stroke-dasharray="5 4" class="arrow-up-anim"/>
        <polygon points="296,100 300,85 304,100" fill="#34d399" opacity="0.8"/>
      </g>

      <!-- ===== PHASE 3: Surface transit to shore ===== -->
      <g id="cy-phase3" class="cy-phase" opacity="0">
        <!-- Device at surface, detached, moving right -->
        <g class="device-surface-anim">
          <rect x="480" y="64" width="28" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="494" cy="56" r="7" fill="#f97316"/>
        </g>
        <!-- Trail path to shore -->
        <path d="M510 75 Q600 70 720 75" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4" class="trail-to-shore"/>
        <!-- Arrow -->
        <polygon points="710,70 725,75 710,80" fill="#fbbf24" opacity="0.7"/>
        <!-- Buoy stays (highlighted) -->
        <circle cx="300" cy="80" r="9" fill="none" stroke="#f97316" stroke-width="1.5" stroke-dasharray="3 2" class="buoy-highlight"/>
      </g>

      <!-- ===== PHASE 4: Replacement + collection ===== -->
      <g id="cy-phase4" class="cy-phase" opacity="0">
        <!-- New device (green) coming from shore to buoy -->
        <g class="device-replace-anim">
          <rect x="500" y="64" width="28" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="514" cy="56" r="7" fill="#34d399"/>
        </g>
        <!-- Path from shore to buoy -->
        <path d="M720 75 Q550 65 320 80" stroke="#34d399" stroke-width="2" stroke-dasharray="5 4" class="path-to-buoy"/>
        <polygon points="325,75 310,80 325,85" fill="#34d399" opacity="0.7"/>

        <!-- Collection net on shore -->
        <g class="collection-net">
          <path d="M750 100 Q770 95 790 100 L795 160 Q770 165 750 160Z" fill="none" stroke="#8B7355" stroke-width="2" opacity="0.7"/>
          <line x1="755" y1="110" x2="755" y2="155" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <line x1="770" y1="105" x2="770" y2="158" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <line x1="785" y1="108" x2="785" y2="156" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <!-- Old device in net -->
          <rect x="762" y="125" width="20" height="16" rx="3" fill="#e2e8f0" opacity="0.6"/>
          <circle cx="772" cy="119" r="5" fill="#f97316" opacity="0.5"/>
        </g>
        <text x="772" y="180" text-anchor="middle" fill="#8B7355" font-size="9" font-weight="600" font-family="Inter,sans-serif">COLLECTE</text>
      </g>

      <defs>
        <linearGradient id="cyOcean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0e3654" stop-opacity="0.5"/>
          <stop offset="1" stop-color="#061220" stop-opacity="0.8"/>
        </linearGradient>
      </defs>
    </svg>
  </div>

  <!-- Scroll-triggered phase text blocks -->
  <div class="cycle-phases">
    <div class="cy-text-phase" data-phase="1">
      <div class="cy-text-inner">
        <div class="cy-phase-num">01</div>
        <h3>Capture en profondeur</h3>
        <p>Le dispositif est ancre au fond, camera active. Il capture des images en continu pendant toute la duree de sa batterie. Aucune intervention necessaire.</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="2">
      <div class="cy-text-inner">
        <div class="cy-phase-num">02</div>
        <h3>Remontee automatique</h3>
        <p>Apres ~24h, la batterie est epuisee. Le dispositif se detache de l'ancrage et remonte par simple flottabilite. Le cable reste en place avec sa bouee en surface.</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="3">
      <div class="cy-text-inner">
        <div class="cy-phase-num">03</div>
        <h3>Transit en surface</h3>
        <p>Une fois en surface, le dispositif navigue vers la rive. La bouee du cable reste a sa position, marquant la station pour le prochain capteur.</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="4">
      <div class="cy-text-inner">
        <div class="cy-phase-num">04</div>
        <h3>Remplacement et collecte</h3>
        <p>Un capteur frais rejoint la bouee depuis la rive et descend s'amarrer. L'ancien capteur est recupere dans un filet de collecte passif, nettoye et recharge pour le prochain cycle.</p>
      </div>
    </div>
  </div>
</div>

<!-- ============ PHASES — sticky scroll ============ -->
<section class="deck phases-intro">
  <div class="deck-bg-gradient orange-glow"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">Evolution</h2>
    <p class="reveal big-statement">Trois phases vers l'autonomie totale</p>
  </div>
</section>

<section class="deck phases-detail">
  <div class="deck-content">
    <div class="phase-cards">
      <div class="phase-card reveal" style="--accent:#38bdf8">
        <div class="phase-num">01</div>
        <h3>Recuperation manuelle</h3>
        <p>Les dispositifs remontent et flottent. Un bateau les collecte. Validation du concept, infrastructure minimale.</p>
        <div class="phase-metric">
          <span class="metric-label">CAPEX</span><span class="metric-bar low"></span>
          <span class="metric-label">OPEX</span><span class="metric-bar med"></span>
        </div>
      </div>
      <div class="phase-card reveal d1" style="--accent:#f97316">
        <div class="phase-num">02</div>
        <h3>Collecte automatisee</h3>
        <p>Anneau de collecte ancre au large. Recharge, nettoyage et relance automatiques. Cycle entierement autonome.</p>
        <div class="phase-metric">
          <span class="metric-label">CAPEX</span><span class="metric-bar med"></span>
          <span class="metric-label">OPEX</span><span class="metric-bar low"></span>
        </div>
      </div>
      <div class="phase-card reveal d2" style="--accent:#34d399">
        <div class="phase-num">03</div>
        <h3>Sans cable — TumblerBots</h3>
        <p>Descente controlee par culbutage aerien. Les dispositifs se posent sur des zones predefinies. Zero infrastructure sous-marine.</p>
        <div class="phase-refs">
          <span>arXiv 2410.23049</span>
          <span>Ramsby 2026</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ MAPPING BONUS ============ -->
<section class="deck mapping-section">
  <div class="mapping-bg"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">Bonus</h2>
    <p class="reveal big-statement">Chaque remontee genere une<br><em>cartographie 3D</em> du recif</p>
    <p class="reveal d1 sub-text">Les cameras orientees vers le bas capturent le recif a differentes altitudes.<br>Assemblage photogrammetrique automatique a chaque cycle de maintenance.</p>
  </div>
</section>

<!-- ============ COMPARATIF ============ -->
<section class="deck compare-section">
  <div class="deck-content">
    <h2 class="reveal kicker">Pourquoi CORAL</h2>
    <div class="compare-grid reveal d1">
      <div class="compare-col other">
        <h4>Methodes classiques</h4>
        <div class="compare-item bad">Plongeurs requis</div>
        <div class="compare-item bad">Infrastructure lourde</div>
        <div class="compare-item bad">Risque corallien</div>
        <div class="compare-item bad">Couverture fixe</div>
        <div class="compare-item bad">Cout lineaire</div>
      </div>
      <div class="compare-vs">VS</div>
      <div class="compare-col ours">
        <h4>CORAL</h4>
        <div class="compare-item good">100% surface</div>
        <div class="compare-item good">Ancre + cable uniquement</div>
        <div class="compare-item good">Remontee verticale</div>
        <div class="compare-item good">Multi-stations + mapping</div>
        <div class="compare-item good">Scalable</div>
      </div>
    </div>
  </div>
</section>

<!-- ============ CTA ============ -->
<section class="deck cta-section">
  <div class="cta-glow"></div>
  <div class="deck-content">
    <p class="reveal big-statement">Testez le systeme vous-meme</p>
    <button class="reveal d1 cta-big" onclick="document.querySelector('[data-tab=simulation]').click()">
      Lancer la simulation
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l6 6-6 6"/></svg>
    </button>
  </div>
</section>

  `;

  // Scroll reveal observer
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.15 });
  el.querySelectorAll('.reveal').forEach(r => obs.observe(r));

  // Cycle phases scroll observer
  initCycleScroll();

  // Hero particles canvas
  initHeroParticles();
}

function initCycleScroll() {
  const phases = document.querySelectorAll('.cy-text-phase');
  let currentPhase = 0;

  const phaseObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const p = parseInt(e.target.dataset.phase);
        if (p > currentPhase) currentPhase = p;
        updateCyclePhase(currentPhase);
      }
    });
  }, { threshold: 0.5, root: null });

  phases.forEach(p => phaseObs.observe(p));

  // Also track scroll-up: reset phase when scrolling back
  const scrollContainer = document.getElementById('tab-concept');
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      // Check which phases are still visible
      let highest = 0;
      phases.forEach(p => {
        const rect = p.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.7) {
          highest = Math.max(highest, parseInt(p.dataset.phase));
        }
      });
      if (highest !== currentPhase) {
        currentPhase = highest;
        updateCyclePhase(currentPhase);
      }
    });
  }
}

function updateCyclePhase(phase) {
  for (let i = 1; i <= 4; i++) {
    const g = document.getElementById(`cy-phase${i}`);
    if (!g) continue;
    if (i <= phase) {
      g.style.opacity = i === phase ? '1' : '0.35';
      g.style.transition = 'opacity 0.8s ease';
    } else {
      g.style.opacity = '0';
      g.style.transition = 'opacity 0.4s ease';
    }
  }

  // Cable + buoy appear from phase 2 onward
  const cableGroup = document.getElementById('cy-cable-group');
  if (cableGroup) {
    cableGroup.style.opacity = phase >= 2 ? (phase === 2 ? '1' : '0.5') : '0';
    cableGroup.style.transition = 'opacity 0.8s ease';
  }

  // Highlight current phase text
  document.querySelectorAll('.cy-text-phase').forEach(el => {
    const p = parseInt(el.dataset.phase);
    el.classList.toggle('active', p === phase);
  });
}

function initHeroParticles() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];

  function resize() {
    w = canvas.width = canvas.offsetWidth * devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }
  resize();
  window.addEventListener('resize', resize);

  // Create particles
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * (w / devicePixelRatio),
      y: Math.random() * (h / devicePixelRatio),
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      a: Math.random() * 0.3 + 0.1
    });
  }

  function draw() {
    const ww = w / devicePixelRatio, hh = h / devicePixelRatio;
    ctx.clearRect(0, 0, ww, hh);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) { p.y = hh + 10; p.x = Math.random() * ww; }
      if (p.x < -10) p.x = ww + 10;
      if (p.x > ww + 10) p.x = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${p.a})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}
