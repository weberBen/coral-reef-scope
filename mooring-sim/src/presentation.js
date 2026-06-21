import { isDark, onThemeChange } from './theme.js';
import { t, getLang } from './i18n.js';
import { createSocialPanel } from 'social-links-panel';
import socialConfig from './social.config.js';

export function buildPresentation() {
  const el = document.getElementById('presentation');
  if (!el) return;

  el.innerHTML = `

<!-- ============ HERO ============ -->
<section class="deck hero">
  <canvas class="hero-particles" id="hero-canvas"></canvas>
  <div class="hero-rays"></div>
  <div class="deck-content hero-content">
    <div class="hero-badge">${t('heroBadge')}</div>
    <h1 class="reveal">${t('heroTitle')}</h1>
    <p class="reveal d1">${t('heroSub1')}</p>
    <p class="reveal d2 hero-sub">${t('heroSub2')}</p>
  </div>
  <div class="scroll-cue reveal d3">
    <div class="scroll-line"></div>
    <span>${t('heroScroll')}</span>
  </div>
</section>

<!-- ============ PROBLEM - immersive ============ -->
<section class="deck dark-ocean">
  <div class="deck-bg-anim bubbles-bg"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">${t('probKicker')}</h2>
    <p class="reveal big-statement">${t('probStatement')}</p>
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
        <h3>${t('probCard1Title')}</h3>
        <p>${t('probCard1Text')}</p>
        <div class="pcard-tag bad">${t('probCard1Tag')}</div>
      </div>
      <div class="pcard reveal d1">
        <div class="pcard-visual">
          <div class="pcard-icon drone-icon">
            <div class="collision-flash"></div>
          </div>
        </div>
        <h3>${t('probCard2Title')}</h3>
        <p>${t('probCard2Text')}</p>
        <div class="pcard-tag bad">${t('probCard2Tag')}</div>
      </div>
      <div class="pcard reveal d2">
        <div class="pcard-visual">
          <div class="pcard-icon power-icon">
            <div class="power-pulse"></div>
          </div>
        </div>
        <h3>${t('probCard3Title')}</h3>
        <p>${t('probCard3Text')}</p>
        <div class="pcard-tag bad">${t('probCard3Tag')}</div>
      </div>
    </div>
  </div>
</section>

<!-- ============ TRANSITION ============ -->
<section class="deck transition-section">
  <div class="deck-content">
    <p class="reveal big-statement">${t('transStatement1')}</p>
    <p class="reveal d1 big-statement accent">${t('transStatement2')}</p>
  </div>
</section>

<!-- ============ SOLUTION TITLE ============ -->
<section class="deck solution-hero">
  <div class="deck-bg-gradient cyan-glow"></div>
  <div class="ripple-container reveal">
    <div class="ripple-ring r1"></div>
    <div class="ripple-ring r2"></div>
    <div class="ripple-ring r3"></div>
    <div class="ripple-ring r4"></div>
    <div class="ripple-ring r5"></div>
  </div>
  <div class="deck-content">
    <h2 class="reveal kicker">${t('solKicker')}</h2>
    <h3 class="reveal mega-title">${t('solTitle')}</h3>
    <div class="capa-expand reveal d1" style="margin:24px auto 0">
      <div class="capa-item"><span class="capa-letter">A</span><span class="capa-word">${t('capaA')}</span></div>
      <div class="capa-item"><span class="capa-letter">P</span><span class="capa-word">${t('capaP')}</span></div>
      <div class="capa-item"><span class="capa-letter">A</span><span class="capa-word">${t('capaA2')}</span></div>
      <div class="capa-item"><span class="capa-letter">C</span><span class="capa-word">${t('capaC')}</span></div>
    </div>
  </div>
</section>

<!-- ============ CYCLE,sticky scroll 4 phases ============ -->
<div class="cycle-scroll-wrap" id="cycle-wrap">
  <!-- Sticky diagram -->
  <div class="cycle-sticky">
    <svg viewBox="0 0 900 460" class="cycle-svg" id="cycle-svg">
      <!-- Ocean -->
      <rect x="0" y="75" width="900" height="385" fill="url(#cyOcean)"/>
      <path d="M0 75 Q112 60 225 75 T450 75 T675 75 T900 75" fill="none" stroke="rgba(56,189,248,0.25)" stroke-width="1.5"/>
      <!-- Seabed -->
      <rect x="0" y="400" width="720" height="60" class="cy-seabed"/>
      <!-- Shore -->
      <path d="M720 75 L750 75 L900 75 L900 460 L720 460Z" class="cy-shore"/>
      <text x="810" y="60" text-anchor="middle" fill="var(--orange)" font-size="16" font-weight="800" font-family="Inter,sans-serif">${t('svgRive')}</text>

      <!-- ===== PERMANENT: Anchor only ===== -->
      <g id="cy-station">
        <rect x="280" y="395" width="40" height="14" rx="4" fill="#64748b"/>
        <rect x="292" y="383" width="16" height="16" rx="3" fill="#718096"/>
      </g>

      <!-- ===== Cable + buoy: appear from phase 2 ===== -->
      <g id="cy-cable-group" opacity="0">
        <line x1="300" y1="383" x2="300" y2="83" stroke="var(--cyan-l)" stroke-width="2.5" opacity="0.8"/>
        <circle cx="300" cy="80" r="7" fill="var(--orange)" opacity="0.8"/>
      </g>

      <!-- ===== PHASE 1: Device anchored, camera scanning ===== -->
      <g id="cy-phase1" class="cy-phase" opacity="0">
        <!-- Rigid support mast from anchor to device -->
        <rect x="297" y="332" width="6" height="51" rx="1" fill="#718096"/>
        <!-- Device at bottom -->
        <rect x="286" y="310" width="28" height="22" rx="4" class="cy-device-fill" id="cy-dev1"/>
        <circle cx="300" cy="302" r="7" fill="var(--orange)"/>
        <!-- Camera lens -->
        <circle cx="300" cy="319" r="4" fill="#1a202c"/>
        <!-- Scan cone -->
        <path d="M300 319 L240 400 L360 400Z" fill="rgba(134,239,172,0.15)" stroke="var(--green-l)" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.7"/>
        <!-- Rotating scan line -->
        <line x1="300" y1="319" x2="260" y2="395" stroke="var(--green-l)" stroke-width="1" opacity="0.5" class="scan-rotate"/>
        <line x1="300" y1="319" x2="340" y2="395" stroke="var(--green-l)" stroke-width="1" opacity="0.5" class="scan-rotate2"/>
      </g>

      <!-- ===== PHASE 2: Device ascending ===== -->
      <g id="cy-phase2" class="cy-phase" opacity="0">
        <!-- 24h indicator -->
        <rect x="340" y="220" width="52" height="24" rx="12" fill="rgba(251,191,36,0.15)" stroke="var(--yellow)" stroke-width="1"/>
        <text x="366" y="237" text-anchor="middle" fill="var(--yellow)" font-size="12" font-weight="700" font-family="Inter,sans-serif">24h</text>
        <!-- Device rising (animated) -->
        <g class="device-rise-anim">
          <rect x="286" y="180" width="28" height="22" rx="4" class="cy-device-fill"/>
          <circle cx="300" cy="172" r="7" fill="var(--orange)"/>
          <!-- Bubbles trail -->
          <circle cx="294" cy="210" r="2" fill="var(--cyan)" opacity="0.3" class="bubble-trail"/>
          <circle cx="306" cy="220" r="1.5" fill="var(--cyan)" opacity="0.2" class="bubble-trail d1"/>
          <circle cx="298" cy="230" r="2.5" fill="var(--cyan)" opacity="0.25" class="bubble-trail d2"/>
        </g>
        <!-- Arrow up -->
        <path d="M300 168 L300 95" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" class="arrow-up-anim"/>
        <polygon points="296,100 300,85 304,100" fill="var(--green)" opacity="0.8"/>
      </g>

      <!-- ===== PHASE 3: Surface transit to shore ===== -->
      <g id="cy-phase3" class="cy-phase" opacity="0">
        <!-- Device at surface, detached, moving right -->
        <g class="device-surface-anim">
          <rect x="480" y="64" width="28" height="22" rx="4" class="cy-device-fill"/>
          <circle cx="494" cy="56" r="7" fill="var(--orange)"/>
        </g>
        <!-- Trail path to shore -->
        <path d="M510 75 Q600 70 720 75" fill="none" stroke="var(--yellow)" stroke-width="2" stroke-dasharray="6 4" class="trail-to-shore"/>
        <!-- Arrow -->
        <polygon points="710,70 725,75 710,80" fill="var(--yellow)" opacity="0.7"/>
        <!-- Buoy stays (highlighted) -->
        <circle cx="300" cy="80" r="9" fill="none" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="3 2" class="buoy-highlight"/>

        <!-- Antenna on shore -->
        <line x1="770" y1="30" x2="770" y2="65" stroke="#94a3b8" stroke-width="2"/>
        <line x1="770" y1="30" x2="760" y2="40" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="770" y1="30" x2="780" y2="40" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="770" y1="36" x2="762" y2="44" stroke="#94a3b8" stroke-width="1"/>
        <line x1="770" y1="36" x2="778" y2="44" stroke="#94a3b8" stroke-width="1"/>

        <!-- Radio signals from device to antenna -->
        <circle cx="520" cy="55" r="8" fill="none" stroke="var(--t1)" stroke-width="2.5" opacity="0" class="radio-wave rw1"/>
        <circle cx="520" cy="55" r="16" fill="none" stroke="var(--t1)" stroke-width="2" opacity="0" class="radio-wave rw2"/>
        <circle cx="520" cy="55" r="24" fill="none" stroke="var(--t1)" stroke-width="1.5" opacity="0" class="radio-wave rw3"/>

        <!-- Signal path -->
        <path d="M530 56 Q650 40 762 35" fill="none" stroke="var(--t1)" stroke-width="2.5" stroke-dasharray="5 4" class="signal-path"/>
        <text x="650" y="30" text-anchor="middle" fill="var(--t1)" font-size="13" font-weight="700" font-family="Inter,sans-serif">${t('svgData')}</text>
      </g>

      <!-- ===== PHASE 4: Replacement + collection ===== -->
      <g id="cy-phase4" class="cy-phase" opacity="0">
        <!-- New device (green) coming from shore to buoy -->
        <g class="device-replace-anim">
          <rect x="500" y="64" width="28" height="22" rx="4" class="cy-device-fill"/>
          <circle cx="514" cy="56" r="7" fill="var(--green)"/>
        </g>
        <!-- Path from shore to buoy -->
        <path d="M720 75 Q550 65 320 80" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" class="path-to-buoy"/>
        <polygon points="325,75 310,80 325,85" fill="var(--green)" opacity="0.7"/>

        <!-- Collection net on shore -->
        <g class="collection-net">
          <path d="M750 100 Q770 95 790 100 L795 160 Q770 165 750 160Z" fill="none" stroke="#8B7355" stroke-width="2" opacity="0.7"/>
          <line x1="755" y1="110" x2="755" y2="155" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <line x1="770" y1="105" x2="770" y2="158" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <line x1="785" y1="108" x2="785" y2="156" stroke="#8B7355" stroke-width="1" opacity="0.4"/>
          <!-- Old device in net -->
          <rect x="762" y="125" width="20" height="16" rx="3" class="cy-device-fill" opacity="0.6"/>
          <circle cx="772" cy="119" r="5" fill="var(--orange)" opacity="0.5"/>
        </g>
        <text x="772" y="180" text-anchor="middle" fill="var(--orange)" font-size="13" font-weight="700" font-family="Inter,sans-serif">${t('svgCollecte')}</text>
      </g>

      <defs>
        <linearGradient id="cyOcean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="cy-ocean-top"/>
          <stop offset="1" class="cy-ocean-bot"/>
        </linearGradient>
      </defs>
    </svg>
  </div>

  <!-- Scroll-triggered phase text blocks -->
  <div class="cycle-phases">
    <div class="cy-text-phase" data-phase="1">
      <div class="cy-text-inner">
        <div class="cy-phase-num">01</div>
        <h3>${t('cyPhase1Title')}</h3>
        <p>${t('cyPhase1Text')}</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="2">
      <div class="cy-text-inner">
        <div class="cy-phase-num">02</div>
        <h3>${t('cyPhase2Title')}</h3>
        <p>${t('cyPhase2Text')}</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="3">
      <div class="cy-text-inner">
        <div class="cy-phase-num">03</div>
        <h3>${t('cyPhase3Title')}</h3>
        <p>${t('cyPhase3Text1')}</p>
        <p>${t('cyPhase3Text2')}</p>
      </div>
    </div>
    <div class="cy-text-phase" data-phase="4">
      <div class="cy-text-inner">
        <div class="cy-phase-num">04</div>
        <h3>${t('cyPhase4Title')}</h3>
        <p>${t('cyPhase4Text')}</p>
      </div>
    </div>
  </div>
</div>

<!-- ============ MAPPING ============ -->
<section class="deck mapping-section">
  <div class="mapping-bg"></div>
  <div class="deck-content">
    <div class="split">
      <div class="mapping-text">
        <h2 class="reveal kicker">${t('mapKicker')}</h2>
        <p class="reveal big-statement">${t('mapStatement')}</p>
        <p class="reveal d1 sub-text">${t('mapText1')}</p>
        <p class="reveal d2 sub-text highlight-text">${t('mapText2')}</p>
        <p class="reveal d3 sub-text">${t('mapText3')}</p>
        <p class="reveal d3 sub-text">${t('mapText4')}</p>
      </div>
      <div class="mapping-illustration reveal d1">
        <svg viewBox="0 0 360 480" class="illustration">
          <!-- Ocean -->
          <rect x="0" y="40" width="360" height="440" fill="url(#mapOcean)" rx="12"/>
          <!-- Surface wave -->
          <path d="M0 40 Q45 30 90 40 T180 40 T270 40 T360 40 V0 H0Z" fill="var(--bg-2)"/>

          <!-- Anchor at bottom -->
          <rect x="155" y="430" width="30" height="8" rx="3" fill="#64748b" opacity="0.5"/>
          <!-- Cable -->
          <line x1="170" y1="430" x2="170" y2="48" stroke="var(--cyan)" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.3"/>
          <!-- Buoy -->
          <circle cx="170" cy="46" r="5" fill="var(--orange)" opacity="0.5"/>

          <!-- Device at position 1 (bottom, starting) -->
          <g opacity="0.3">
            <rect x="156" y="360" width="28" height="22" rx="4" class="cy-device-fill"/>
            <circle cx="170" cy="352" r="7" fill="var(--orange)"/>
          </g>
          <!-- Capture cone 1 -->
          <path d="M170 382 L110 440 L230 440Z" fill="rgba(56,189,248,0.05)" stroke="var(--cyan)" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.3"/>

          <!-- Device at position 2 (mid) -->
          <g opacity="0.5">
            <rect x="156" y="240" width="28" height="22" rx="4" class="cy-device-fill"/>
            <circle cx="170" cy="232" r="7" fill="var(--orange)"/>
          </g>
          <!-- Capture cone 2 (wider) -->
          <path d="M170 262 L80 380 L260 380Z" fill="rgba(56,189,248,0.04)" stroke="var(--cyan)" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.3"/>

          <!-- Device at position 3 (near top, current) -->
          <g opacity="1">
            <rect x="156" y="110" width="28" height="22" rx="4" class="cy-device-fill"/>
            <circle cx="170" cy="102" r="7" fill="var(--orange)"/>
            <!-- Camera indicator -->
            <circle cx="170" cy="119" r="3.5" fill="#1a202c"/>
            <circle cx="170" cy="119" r="2" fill="var(--cyan)" opacity="0.6"/>
          </g>
          <!-- Capture cone 3 (widest) -->
          <path d="M170 132 L40 320 L300 320Z" fill="rgba(56,189,248,0.03)" stroke="var(--cyan)" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.4"/>

          <!-- Arrow up showing ascent path -->
          <path d="M200 355 L200 120" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.5"/>
          <polygon points="196,125 200,110 204,125" fill="var(--green)" opacity="0.5"/>

          <!-- Altitude labels -->
          <text x="215" y="370" fill="var(--t4)" font-size="9" font-family="Inter,sans-serif">alt. 2m</text>
          <text x="215" y="250" fill="var(--t4)" font-size="9" font-family="Inter,sans-serif">alt. 8m</text>
          <text x="215" y="120" fill="var(--t4)" font-size="9" font-family="Inter,sans-serif">alt. 15m</text>

          <!-- Coverage width labels -->
          <line x1="110" y1="442" x2="230" y2="442" stroke="var(--cyan)" stroke-width="0.5" opacity="0.3"/>
          <text x="170" y="455" text-anchor="middle" fill="var(--cyan)" font-size="8" font-family="Inter,sans-serif" opacity="0.5">4m</text>
          <line x1="40" y1="322" x2="300" y2="322" stroke="var(--cyan)" stroke-width="0.5" opacity="0.3"/>
          <text x="170" y="335" text-anchor="middle" fill="var(--cyan)" font-size="8" font-family="Inter,sans-serif" opacity="0.5">20m</text>

          <!-- Coral on seabed -->
          <path d="M50 440 Q70 420 90 440 Q110 415 130 440 Q150 420 170 440 Q190 415 210 440 Q230 425 250 440 Q270 418 290 440 Q310 425 330 440" stroke="var(--green)" stroke-width="1.5" fill="none" opacity="0.4"/>

          <defs>
            <linearGradient id="mapOcean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" class="cy-ocean-top"/>
              <stop offset="1" class="cy-ocean-bot"/>
            </linearGradient>
          </defs>
        </svg>
        <p class="mapping-caption">${t('mapCaption')}</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ PHASES,sticky scroll ============ -->
<section class="deck phases-intro">
  <div class="deck-bg-gradient orange-glow"></div>
  <div class="deck-content">
    <h2 class="reveal kicker">${t('phKicker')}</h2>
    <p class="reveal big-statement">${t('phStatement')}</p>
  </div>
</section>

<section class="deck phases-detail">
  <div class="deck-content">
    <div class="phase-cards">

      <div class="phase-card reveal" style="--accent:#38bdf8">
        <div class="phase-num">01</div>
        <div class="phase-icon-row">
          <svg viewBox="0 0 80 60" width="80" height="60">
            <path d="M10 30 Q40 20 70 30" stroke="var(--cyan)" stroke-width="1.5" fill="none"/>
            <rect x="30" y="22" width="20" height="12" rx="3" fill="#64748b"/>
            <path d="M28 34 L22 44 M52 34 L58 44" stroke="#64748b" stroke-width="1"/>
            <rect x="36" y="12" width="8" height="6" rx="1" class="cy-device-fill"/>
            <circle cx="40" cy="10" r="3" fill="var(--orange)"/>
          </svg>
        </div>
        <h3>${t('ph1Title')}</h3>
        <p>${t('ph1Text')}</p>
        <div class="phase-highlights">
          <span class="ph-tag blue">${t('ph1Tag1')}</span>
          <span class="ph-tag blue">${t('ph1Tag2')}</span>
        </div>
        <div class="phase-metric">
          <span class="metric-label">CAPEX</span><span class="metric-bar low"></span>
          <span class="metric-label">OPEX</span><span class="metric-bar med"></span>
        </div>
      </div>

      <div class="phase-card reveal d1" style="--accent:#f97316">
        <div class="phase-num">02</div>
        <div class="phase-icon-row">
          <svg viewBox="0 0 120 70" width="120" height="70">
            <!-- Shore -->
            <rect x="90" y="0" width="30" height="70" class="cy-shore" rx="4"/>
            <!-- Net barrier -->
            <path d="M85 15 Q80 35 85 55" stroke="#8B7355" stroke-width="2" fill="none"/>
            <line x1="85" y1="20" x2="85" y2="50" stroke="#8B7355" stroke-width="0.8" stroke-dasharray="3 2"/>
            <!-- Device drifting toward net -->
            <rect x="50" y="24" width="14" height="10" rx="2" class="cy-device-fill"/>
            <circle cx="57" cy="21" r="4" fill="var(--orange)"/>
            <path d="M64 29 L80 32" fill="none" stroke="var(--yellow)" stroke-width="1" stroke-dasharray="3 2"/>
            <!-- Catapult arc -->
            <path d="M100 40 Q70 0 30 30" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>
            <polygon points="33,26 28,33 36,33" fill="var(--green)" opacity="0.7"/>
            <!-- New device launched -->
            <rect x="95" y="38" width="14" height="10" rx="2" class="cy-device-fill" opacity="0.7"/>
            <circle cx="102" cy="35" r="4" fill="var(--green)" opacity="0.7"/>
          </svg>
        </div>
        <h3>${t('ph2Title')}</h3>
        <p class="phase-desc">${t('ph2Desc')}</p>

        <div class="phase-variant">
          <div class="pv-label">${t('ph2OptALabel')}</div>
          <div class="pd-item">
            <span class="pd-icon">→</span>
            <span>${t('ph2OptA1')}</span>
          </div>
          <div class="pd-item">
            <span class="pd-icon">→</span>
            <span>${t('ph2OptA2')}</span>
          </div>
        </div>

        <div class="phase-variant">
          <div class="pv-label">${t('ph2OptBLabel')}</div>
          <div class="pd-item">
            <span class="pd-icon">→</span>
            <span>${t('ph2OptB1')}</span>
          </div>
          <div class="pd-item">
            <span class="pd-icon">→</span>
            <span>${t('ph2OptB2')}</span>
          </div>
        </div>

        <div class="phase-highlights">
          <span class="ph-tag orange">${t('ph2Tag1')}</span>
          <span class="ph-tag orange">${t('ph2Tag2')}</span>
          <span class="ph-tag orange">${t('ph2Tag3')}</span>
        </div>
        <div class="phase-metric">
          <span class="metric-label">CAPEX</span><span class="metric-bar med"></span>
          <span class="metric-label">OPEX</span><span class="metric-bar low"></span>
        </div>
      </div>

      <div class="phase-card reveal d2" style="--accent:#34d399">
        <div class="phase-num">03</div>
        <div class="phase-icon-row">
          <svg viewBox="0 0 80 70" width="80" height="70">
            <!-- Drone -->
            <rect x="30" y="5" width="20" height="6" rx="2" fill="#64748b"/>
            <line x1="28" y1="8" x2="22" y2="8" stroke="#64748b" stroke-width="1.5"/>
            <line x1="52" y1="8" x2="58" y2="8" stroke="#64748b" stroke-width="1.5"/>
            <!-- Tumbling device falling -->
            <rect x="36" y="25" width="10" height="8" rx="2" class="cy-device-fill" transform="rotate(15,41,29)"/>
            <circle cx="41" cy="23" r="3" fill="var(--green)"/>
            <!-- Spiral descent -->
            <path d="M41 33 Q50 40 38 48 Q28 55 42 62" stroke="var(--green)" stroke-width="1" stroke-dasharray="3 2" fill="none"/>
            <!-- Landing zone -->
            <ellipse cx="42" cy="65" rx="15" ry="3" fill="none" stroke="var(--green)" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/>
          </svg>
        </div>
        <h3>${t('ph3Title')}</h3>
        <p>${t('ph3Text1')}</p>
        <p>${t('ph3Text2')}</p>
        <div class="phase-highlights">
          <span class="ph-tag green">${t('ph3Tag1')}</span>
          <span class="ph-tag green">${t('ph3Tag2')}</span>
          <span class="ph-tag green">${t('ph3Tag3')}</span>
        </div>
        <div class="phase-refs">
          <span>TumblerBots (arXiv 2410.23049)</span>
          <span>Ramsby 2026, Restoration Ecology</span>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- ============ SYSTEMS COMPARISON ============ -->
<section class="deck">
  <div class="deck-content">
    <h2 class="reveal kicker">${t('cmpKicker')}</h2>
    <p class="reveal big-statement" style="margin-bottom:48px">${t('cmpStatement')}</p>

    <div class="grid-compare reveal d1">
      <div class="gc-iter-arrow">
        <svg viewBox="0 0 120 44" preserveAspectRatio="xMidYMid meet">
          <defs><marker id="gc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="var(--green)" stroke-width="1.5"/></marker></defs>
          <text x="60" y="12" text-anchor="middle" fill="var(--green)" font-size="12" font-weight="900" font-family="Inter,sans-serif">${t('cmpIter')}</text>
          <path d="M4 40 Q30 18 60 18 Q90 18 116 40" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#gc-arrow)"/>
        </svg>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th title="${t('cmpCableDesc')}">${t('cmpCable')}<small class="gc-desc">${t('cmpCableDesc')}</small></th>
            <th title="${t('cmpBuoyDesc')}">${t('cmpBuoy')}<small class="gc-desc">${t('cmpBuoyDesc')}</small></th>
            <th title="${t('cmpReefOSDesc')}">${t('cmpReefOS')}<small class="gc-desc">${t('cmpReefOSDesc')}</small></th>
            <th class="gc-ours" title="${t('cmpOursDesc')}">${t('cmpOurs')}<small class="gc-desc">${t('cmpOursDesc')}</small></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="gc-criterion"><svg viewBox="0 0 40 40" width="36" height="36" style="vertical-align:middle;margin-right:6px"><circle cx="20" cy="20" r="16" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="3 2" class="cmp-pulse"/><path d="M14 28 Q17 18 20 22 Q23 26 26 16" stroke="var(--green)" stroke-width="2" fill="none"/><circle cx="20" cy="12" r="2" fill="var(--green)" opacity="0.6"/></svg>${t('cmpNat')}</td>
            <td data-label="${t('cmpCable')}" data-desc="${t('cmpCableDesc')}"><div class="gc-cell gc-4"><span class="gc-score">0.4</span><span class="gc-sub">${t('cmpNatCable')}</span></div></td>
            <td data-label="${t('cmpBuoy')}" data-desc="${t('cmpBuoyDesc')}"><div class="gc-cell gc-2"><span class="gc-score">0.2</span><span class="gc-sub">${t('cmpNatBuoy')}</span></div></td>
            <td data-label="${t('cmpReefOS')}" data-desc="${t('cmpReefOSDesc')}"><div class="gc-cell gc-3"><span class="gc-score">0.3</span><span class="gc-sub">${t('cmpNatReefOS')}</span></div></td>
            <td data-label="${t('cmpOurs')}" data-desc="${t('cmpOursDesc')}"><div class="gc-cell gc-5 gc-best"><span class="gc-score">0.5</span><span class="gc-sub">${t('cmpNatOurs')}</span></div></td>
            <td class="gc-iter-cell"><svg viewBox="0 0 38 100" preserveAspectRatio="xMidYMid meet"><defs><marker id="gc-arrV1" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="var(--green)" stroke-width="1.5"/></marker></defs><text x="30" y="44" text-anchor="middle" fill="var(--green)" font-size="11" font-weight="900" font-family="Inter,sans-serif" writing-mode="tb">${t('cmpIter')}</text><path d="M8 5 Q30 50 8 95" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#gc-arrV1)"/></svg></td>
          </tr>
          <tr>
            <td class="gc-criterion"><svg viewBox="0 0 40 40" width="36" height="36" style="vertical-align:middle;margin-right:6px"><circle cx="20" cy="20" r="14" fill="none" stroke="var(--yellow)" stroke-width="1.5"/><path d="M20 10 v4 M20 26 v4 M14 20 h12" stroke="var(--yellow)" stroke-width="2"/><path d="M16 16 Q20 14 24 16 Q20 18 16 16" stroke="var(--yellow)" stroke-width="1.5" fill="none" class="cmp-coin"/></svg>${t('cmpOpex')}</td>
            <td data-label="${t('cmpCable')}" data-desc="${t('cmpCableDesc')}"><div class="gc-cell gc-4"><span class="gc-score">0.4</span><span class="gc-sub">${t('cmpOpexCable')}</span></div></td>
            <td data-label="${t('cmpBuoy')}" data-desc="${t('cmpBuoyDesc')}"><div class="gc-cell gc-3"><span class="gc-score">0.3</span><span class="gc-sub">${t('cmpOpexBuoy')}</span></div></td>
            <td data-label="${t('cmpReefOS')}" data-desc="${t('cmpReefOSDesc')}"><div class="gc-cell gc-3"><span class="gc-score">0.3</span><span class="gc-sub">${t('cmpOpexReefOS')}</span></div></td>
            <td data-label="${t('cmpOurs')}" data-desc="${t('cmpOursDesc')}"><div class="gc-cell gc-5 gc-best"><span class="gc-score">0.45</span><span class="gc-sub">${t('cmpOpexOurs')}</span></div></td>
            <td class="gc-iter-cell"><svg viewBox="0 0 38 100" preserveAspectRatio="xMidYMid meet"><text x="30" y="44" text-anchor="middle" fill="var(--green)" font-size="11" font-weight="900" font-family="Inter,sans-serif" writing-mode="tb">${t('cmpIter')}</text><path d="M8 5 Q30 50 8 95" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#gc-arrV1)"/></svg></td>
          </tr>
          <tr>
            <td class="gc-criterion"><svg viewBox="0 0 40 40" width="36" height="36" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="20" r="4" fill="none" stroke="var(--cyan)" stroke-width="1.5" class="cmp-scale1"/><circle cx="24" cy="14" r="4" fill="none" stroke="var(--cyan)" stroke-width="1.5" class="cmp-scale2"/><circle cx="24" cy="26" r="4" fill="none" stroke="var(--cyan)" stroke-width="1.5" class="cmp-scale3"/><line x1="16" y1="20" x2="20" y2="15" stroke="var(--cyan)" stroke-width="1" opacity="0.4"/><line x1="16" y1="20" x2="20" y2="25" stroke="var(--cyan)" stroke-width="1" opacity="0.4"/></svg>${t('cmpScale')}</td>
            <td data-label="${t('cmpCable')}" data-desc="${t('cmpCableDesc')}"><div class="gc-cell gc-1"><span class="gc-score">0.1</span><span class="gc-sub">${t('cmpScaleCable')}</span></div></td>
            <td data-label="${t('cmpBuoy')}" data-desc="${t('cmpBuoyDesc')}"><div class="gc-cell gc-4"><span class="gc-score">0.4</span><span class="gc-sub">${t('cmpScaleBuoy')}</span></div></td>
            <td data-label="${t('cmpReefOS')}" data-desc="${t('cmpReefOSDesc')}"><div class="gc-cell gc-3"><span class="gc-score">0.3</span><span class="gc-sub">${t('cmpScaleReefOS')}</span></div></td>
            <td data-label="${t('cmpOurs')}" data-desc="${t('cmpOursDesc')}"><div class="gc-cell gc-6 gc-best"><span class="gc-score">0.6</span><span class="gc-sub">${t('cmpScaleOurs')}</span></div></td>
            <td class="gc-iter-cell"><svg viewBox="0 0 38 100" preserveAspectRatio="xMidYMid meet"><text x="30" y="44" text-anchor="middle" fill="var(--green)" font-size="11" font-weight="900" font-family="Inter,sans-serif" writing-mode="tb">${t('cmpIter')}</text><path d="M8 5 Q30 50 8 95" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#gc-arrV1)"/></svg></td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</section>

<!-- ============ CTA ============ -->
<section class="deck cta-section">
  <div class="cta-glow"></div>
  <div class="deck-content">
    <p class="reveal big-statement">${t('ctaStatement')}</p>
    <div style="display:flex;flex-direction:column;gap:16px;align-items:stretch;width:420px;margin:0 auto">
      <button class="reveal d1 cta-big" style="justify-content:space-between;width:100%;text-align:left" onclick="document.querySelector('[data-tab=simulation]').click()">
        <span>${t('ctaSim')}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l6 6-6 6"/></svg>
      </button>
      <button class="reveal d2 cta-big" style="justify-content:space-between;width:100%;text-align:left;background:linear-gradient(135deg,rgba(52,211,153,0.15),rgba(52,211,153,0.05));border-color:rgba(52,211,153,0.3);color:#86efac" onclick="document.querySelector('[data-tab=coverage]').click()">
        <span>${t('ctaCov')}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l6 6-6 6"/></svg>
      </button>
    </div>
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

  // Comparison table: click on th or td[data-desc] to show tooltip
  el.querySelectorAll('.grid-compare th[title], .grid-compare td[data-desc]').forEach(cell => {
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const existing = cell.querySelector('.gc-tooltip');
      if (existing) { existing.remove(); return; }
      el.querySelectorAll('.gc-tooltip').forEach(t => t.remove());
      const text = cell.title || cell.dataset.desc;
      if (!text) return;
      const tip = document.createElement('span');
      tip.className = 'gc-tooltip';
      tip.textContent = text;
      cell.style.position = 'relative';
      cell.appendChild(tip);
      setTimeout(() => tip.remove(), 3000);
    });
  });

  // Cycle phases scroll observer
  initCycleScroll();

  // Auto-switch table to cards when text overflows any cell
  // Hidden probe cell: switches to stacked when probe text overflows

  // Hero particles canvas
  initHeroParticles();

  // Social links panel (appended after CTA)
  const panel = createSocialPanel({
    ...socialConfig,
    locale: getLang(),
    modal: isDark() ? 'dark' : 'light',
  });
  panel.appendTo(el);

  // Social link icons in the utility bar (icon-only, next to lang/theme)
  const tabUtils = document.querySelector('.tab-utils');
  if (tabUtils && !tabUtils.querySelector('.slp-toolbar-icon')) {
    const icons = panel.createToolbarIcons('tab-btn');
    const firstUtil = tabUtils.firstChild;
    icons.forEach(icon => tabUtils.insertBefore(icon, firstUtil));
  }

  // Nav buttons in the tab bar (from config.nav)
  const tabButtons = document.querySelector('.tab-buttons');
  if (tabButtons) {
    panel.createNavButtons('tab-btn').forEach(btn => {
      if (!document.getElementById(btn.id)) tabButtons.appendChild(btn);
    });
  }

  // Sync modal theme with dark/light toggle
  onThemeChange(() => panel.setModalTheme(isDark() ? 'dark' : 'light'));
}

function initCycleScroll() {
  const phases = document.querySelectorAll('.cy-text-phase');
  const visiblePhases = new Set();

  // Single IntersectionObserver handles both scroll-down and scroll-up
  const phaseObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const p = parseInt(e.target.dataset.phase);
      if (e.isIntersecting) {
        visiblePhases.add(p);
      } else {
        visiblePhases.delete(p);
      }
    });
    const highest = visiblePhases.size > 0 ? Math.max(...visiblePhases) : 0;
    updateCyclePhase(highest);
  }, { threshold: 0.3 });

  phases.forEach(p => phaseObs.observe(p));
}

function updateCyclePhase(phase) {
  for (let i = 1; i <= 4; i++) {
    const g = document.getElementById(`cy-phase${i}`);
    if (!g) continue;
    if (i <= phase) {
      g.style.opacity = i === phase ? '1' : '0.55';
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

  // Pause particles when hero is not visible
  let heroVisible = true;
  const heroObs = new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 });
  heroObs.observe(canvas.parentElement);

  function draw() {
    if (!heroVisible) { requestAnimationFrame(draw); return; }
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
      ctx.fillStyle = isDark() ? `rgba(56,189,248,${p.a})` : `rgba(2,132,199,${p.a * 0.7})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}
