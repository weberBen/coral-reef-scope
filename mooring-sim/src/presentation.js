export function buildPresentation() {
  const el = document.getElementById('presentation');
  if (!el) return;

  el.innerHTML = `

<!-- ============ HERO ============ -->
<section class="deck-section hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-badge">Monitoring Recifal</div>
    <h1>CORAL</h1>
    <p class="hero-tagline">Surveillance autonome des recifs coralliens<br>par capteurs flottants et stations ancrees</p>
    <div class="hero-scroll-hint">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    </div>
  </div>
</section>

<!-- ============ LE PROBLEME ============ -->
<section class="deck-section">
  <div class="section-inner">
    <h2 class="section-title">Le probleme</h2>
    <p class="section-subtitle">Les methodes actuelles de monitoring sous-marin sont couteuses, risquees ou non scalables</p>

    <div class="card-grid three">
      <div class="card">
        <div class="card-icon">
          <svg viewBox="0 0 48 48" width="48" height="48"><rect x="14" y="12" width="20" height="16" rx="3" stroke="#f97316" stroke-width="2" fill="none"/><circle cx="24" cy="20" r="4" stroke="#f97316" stroke-width="2" fill="none"/><path d="M24 32v10M18 42h12" stroke="#f97316" stroke-width="2"/><path d="M8 18c-2 1-3 3-3 3" stroke="#34d399" stroke-width="1.5" opacity="0.5"/><path d="M40 16c2 1 4 4 4 4" stroke="#34d399" stroke-width="1.5" opacity="0.5"/></svg>
        </div>
        <h3>Cameras fixes</h3>
        <ul>
          <li>Biofouling rapide — nettoyage frequent</li>
          <li>Cables d'alimentation couteux</li>
          <li>Intervention de plongeurs pour l'entretien</li>
          <li>Couverture limitee a la zone fixe</li>
        </ul>
        <div class="card-verdict bad">OPEX eleve</div>
      </div>

      <div class="card">
        <div class="card-icon">
          <svg viewBox="0 0 48 48" width="48" height="48"><ellipse cx="24" cy="24" rx="12" ry="6" stroke="#f97316" stroke-width="2" fill="none"/><path d="M12 24v4c0 3.3 5.4 6 12 6s12-2.7 12-6v-4" stroke="#f97316" stroke-width="2" fill="none"/><path d="M24 18v-8M20 10h8" stroke="#f97316" stroke-width="2"/><path d="M16 30l-6 8M32 30l6 8" stroke="#f97316" stroke-width="1.5"/></svg>
        </div>
        <h3>Drones sous-marins</h3>
        <ul>
          <li>R&D couteuse — controle en eau difficile</li>
          <li>Risque de collision avec le corail</li>
          <li>Autonomie limitee</li>
          <li>Recuperation complexe</li>
        </ul>
        <div class="card-verdict bad">CAPEX + risque</div>
      </div>

      <div class="card">
        <div class="card-icon">
          <svg viewBox="0 0 48 48" width="48" height="48"><path d="M10 8h28v6H10z" stroke="#f97316" stroke-width="2" fill="none" rx="2"/><path d="M24 14v20" stroke="#f97316" stroke-width="2"/><circle cx="24" cy="38" r="4" stroke="#f97316" stroke-width="2" fill="none"/><path d="M8 8c0-3 3-5 6-5M40 8c0-3-3-5-6-5" stroke="#38bdf8" stroke-width="1.5" opacity="0.4"/></svg>
        </div>
        <h3>Alimentation</h3>
        <ul>
          <li>Cable principal = infrastructure lourde</li>
          <li>Bouees solaires en surface = pollution visuelle</li>
          <li>Batteries = autonomie limitee</li>
          <li>Chaque solution ajoute de la complexite</li>
        </ul>
        <div class="card-verdict bad">Pas de solution ideale</div>
      </div>
    </div>
  </div>
</section>

<!-- ============ SOLUTION NAIVE ============ -->
<section class="deck-section alt">
  <div class="section-inner">
    <h2 class="section-title">Approche naive : capteurs jetables</h2>
    <div class="split">
      <div class="split-text">
        <p>Produire en masse des capteurs bas cout avec courte autonomie. Une fois la batterie HS, le capteur remonte par flottabilite et est recupere en surface.</p>
        <div class="pro-con">
          <div class="pro">
            <h4>Avantages</h4>
            <ul>
              <li>Cout unitaire tres bas</li>
              <li>Couverture massive du recif</li>
              <li>Pas de cable, pas d'infrastructure</li>
            </ul>
          </div>
          <div class="con">
            <h4>Problemes</h4>
            <ul>
              <li>Chocs repetes avec le corail lors du largage</li>
              <li>Materiel non degradable en cas de perte</li>
              <li>Empetrement possible dans les coraux</li>
              <li>Aucun controle de la zone de pose</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="split-visual">
        <svg viewBox="0 0 300 400" class="illustration">
          <!-- Water -->
          <rect x="0" y="60" width="300" height="340" fill="url(#waterGrad)" rx="0"/>
          <!-- Surface wave -->
          <path d="M0 60 Q50 50 100 60 T200 60 T300 60 V0 H0Z" fill="#0a1628"/>
          <!-- Scattered sensors -->
          <rect x="60" y="180" width="18" height="14" rx="3" fill="#e2e8f0" opacity="0.8"/>
          <circle cx="69" cy="172" r="5" fill="#f97316" opacity="0.8"/>
          <rect x="180" y="250" width="18" height="14" rx="3" fill="#e2e8f0" opacity="0.7"/>
          <circle cx="189" cy="242" r="5" fill="#f97316" opacity="0.7"/>
          <rect x="120" y="310" width="18" height="14" rx="3" fill="#e2e8f0" opacity="0.6"/>
          <circle cx="129" cy="302" r="5" fill="#f97316" opacity="0.6"/>
          <!-- Coral -->
          <path d="M40 380 Q60 340 80 380 Q100 350 120 380 Q140 330 160 380 Q180 345 200 380 Q220 340 240 380 Q260 350 280 380" stroke="#34d399" stroke-width="2" fill="none" opacity="0.5"/>
          <!-- X marks -->
          <g stroke="#ef4444" stroke-width="2" opacity="0.7">
            <path d="M115 305 l12 12 M127 305 l-12 12"/>
            <path d="M55 175 l12 12 M67 175 l-12 12"/>
          </g>
          <!-- Arrow up -->
          <path d="M189 240 L189 90" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
          <polygon points="185,95 189,80 193,95" fill="#38bdf8" opacity="0.5"/>
          <defs>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#0c3a5e" stop-opacity="0.3"/>
              <stop offset="1" stop-color="#051525" stop-opacity="0.6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</section>

<!-- ============ NOTRE SOLUTION ============ -->
<section class="deck-section highlight">
  <div class="section-inner">
    <h2 class="section-title">Notre solution : systeme hybride cable</h2>
    <p class="section-subtitle">Stations ancrees avec dispositifs interchangeables — tout l'entretien se fait en surface</p>

    <div class="system-diagram">
      <svg viewBox="0 0 800 500" class="illustration wide">
        <!-- Ocean background -->
        <rect x="0" y="70" width="800" height="430" fill="url(#oceanGrad)" rx="0"/>
        <!-- Surface -->
        <path d="M0 70 Q100 55 200 70 T400 70 T600 70 T800 70 V0 H0Z" fill="#0a1628"/>
        <!-- Seabed -->
        <rect x="0" y="440" width="800" height="60" fill="#3a2c1c" opacity="0.6"/>

        <!-- == Station 1: Deployed == -->
        <!-- Anchor -->
        <rect x="180" y="435" width="40" height="12" rx="3" fill="#64748b"/>
        <rect x="192" y="425" width="16" height="14" rx="2" fill="#718096"/>
        <!-- Cable -->
        <line x1="200" y1="425" x2="200" y2="140" stroke="#38bdf8" stroke-width="2"/>
        <!-- Device at depth -->
        <rect x="186" y="130" width="28" height="22" rx="4" fill="#e2e8f0"/>
        <circle cx="200" cy="138" r="4" fill="#1a202c"/>
        <circle cx="200" cy="118" r="8" fill="#f97316"/>
        <!-- Label -->
        <text x="200" y="100" text-anchor="middle" fill="#7dd3fc" font-size="11" font-weight="600">EN SERVICE</text>

        <!-- == Station 2: Ascending == -->
        <!-- Anchor -->
        <rect x="380" y="435" width="40" height="12" rx="3" fill="#64748b"/>
        <!-- Cable with buoy at top -->
        <line x1="400" y1="425" x2="400" y2="80" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 3"/>
        <circle cx="400" cy="78" r="7" fill="#f97316" opacity="0.8"/>
        <!-- Device ascending (detached) -->
        <rect x="420" y="180" width="28" height="22" rx="4" fill="#e2e8f0" opacity="0.9"/>
        <circle cx="434" cy="168" r="8" fill="#f97316" opacity="0.9"/>
        <!-- Arrow up -->
        <path d="M434 175 L434 90" stroke="#34d399" stroke-width="2" stroke-dasharray="5 3"/>
        <polygon points="430,95 434,80 438,95" fill="#34d399"/>
        <!-- Arrow to shore -->
        <path d="M448 85 Q550 75 650 85" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5 3"/>
        <polygon points="645,80 660,85 645,90" fill="#fbbf24"/>
        <text x="400" y="100" text-anchor="middle" fill="#34d399" font-size="11" font-weight="600">REMONTEE</text>
        <text x="550" y="68" text-anchor="middle" fill="#fbbf24" font-size="10">vers la rive</text>

        <!-- == Shore == -->
        <path d="M700 70 Q720 65 740 70 L800 70 V500 H700Z" fill="#5c4a32" opacity="0.4"/>
        <text x="750" y="50" text-anchor="middle" fill="#e8f0fa" font-size="12" font-weight="600">RIVE</text>
        <!-- Fresh device -->
        <rect x="720" y="130" width="28" height="22" rx="4" fill="#e2e8f0"/>
        <circle cx="734" cy="118" r="8" fill="#34d399"/>
        <text x="734" y="165" text-anchor="middle" fill="#34d399" font-size="9">PRET</text>
        <!-- Arrow from shore to buoy -->
        <path d="M720 135 Q600 120 450 80" stroke="#34d399" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>

        <defs>
          <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0c3a5e" stop-opacity="0.4"/>
            <stop offset="1" stop-color="#041020" stop-opacity="0.7"/>
          </linearGradient>
        </defs>
      </svg>
    </div>

    <div class="card-grid two">
      <div class="card glow">
        <h3>Cycle operationnel</h3>
        <ol class="steps">
          <li><span class="step-num">1</span> Le dispositif capture des images en profondeur</li>
          <li><span class="step-num">2</span> Batterie HS — le dispositif se detache et remonte</li>
          <li><span class="step-num">3</span> Le cable reste en place avec sa bouee en surface</li>
          <li><span class="step-num">4</span> Le dispositif rejoint la rive (navigation surface)</li>
          <li><span class="step-num">5</span> Nettoyage + recharge a terre</li>
          <li><span class="step-num">6</span> Un dispositif frais rejoint la bouee et descend</li>
        </ol>
      </div>
      <div class="card glow">
        <h3>Avantages cles</h3>
        <ul class="check-list">
          <li>Zero intervention de plongeurs</li>
          <li>Tout l'entretien en surface / a terre</li>
          <li>Remontee verticale = pas de contact avec le corail</li>
          <li>Infrastructure permanente minimale (ancre + cable)</li>
          <li>Dispositifs interchangeables et standardises</li>
          <li>Scalable : ajouter des stations = ajouter des ancres</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ============ PHASES ============ -->
<section class="deck-section">
  <div class="section-inner">
    <h2 class="section-title">Feuille de route</h2>

    <div class="timeline">
      <div class="timeline-item">
        <div class="timeline-marker phase1"></div>
        <div class="timeline-content">
          <h3>Phase 1 — Recuperation manuelle</h3>
          <p>Les dispositifs remontent en surface et flottent. Un bateau les collecte periodiquement. Infrastructure legere, validation du concept.</p>
          <div class="card-verdict good">CAPEX bas — OPEX moyen</div>
        </div>
      </div>

      <div class="timeline-item">
        <div class="timeline-marker phase2"></div>
        <div class="timeline-content">
          <h3>Phase 2 — Collecte automatisee</h3>
          <p>Un anneau de collecte ancre au large guide les dispositifs flottants. Recharge automatique, nettoyage, relance vers les bouees de station. Le cycle est entierement autonome.</p>
          <div class="card-verdict good">CAPEX moyen — OPEX tres bas</div>
        </div>
      </div>

      <div class="timeline-item">
        <div class="timeline-marker phase3"></div>
        <div class="timeline-content">
          <h3>Phase 3 — Sans cable (TumblerBots)</h3>
          <p>Elimination des cables. Descente controlee par culbutage aerien (TumblerBots) ou largage guide. Les dispositifs se posent precisement sur des zones d'atterrissage predefinies.</p>
          <div class="refs">
            <span>Ref: TumblerBots (arXiv 2410.23049)</span>
            <span>Ref: Ramsby 2026, Restoration Ecology</span>
          </div>
          <div class="card-verdict good">Autonomie totale</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ CARTOGRAPHIE ============ -->
<section class="deck-section alt">
  <div class="section-inner">
    <h2 class="section-title">Bonus : cartographie photogrammetrique</h2>
    <div class="split reverse">
      <div class="split-text">
        <p>Pendant la remontee, les cameras orientees vers le bas capturent une vue panoramique du recif a differentes altitudes.</p>
        <p>Ces images assemblees par photogrammetrie permettent de reconstruire un modele 3D haute resolution du recif — sans survol de drone, sans plongeur.</p>
        <p class="highlight-text">Chaque cycle de maintenance genere automatiquement une mise a jour de la cartographie.</p>
      </div>
      <div class="split-visual">
        <svg viewBox="0 0 300 350" class="illustration">
          <rect x="0" y="50" width="300" height="300" fill="url(#waterGrad2)" rx="0"/>
          <!-- Device ascending -->
          <rect x="136" y="100" width="28" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="150" cy="88" r="8" fill="#f97316"/>
          <!-- Camera cone below -->
          <path d="M140 122 L80 280 L220 280Z" fill="#38bdf8" opacity="0.08" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4 3"/>
          <path d="M140 170 L100 240 L200 240Z" fill="#38bdf8" opacity="0.06"/>
          <!-- Coral below -->
          <path d="M60 300 Q80 270 100 300 Q120 275 140 300 Q160 265 180 300 Q200 270 220 300 Q240 280 260 300" stroke="#34d399" stroke-width="2" fill="none" opacity="0.6"/>
          <!-- Arrow up -->
          <path d="M150 95 L150 60" stroke="#34d399" stroke-width="2"/>
          <polygon points="146,65 150,52 154,65" fill="#34d399"/>
          <!-- Labels -->
          <text x="150" y="260" text-anchor="middle" fill="#38bdf8" font-size="10" opacity="0.7">zone capturee</text>
          <text x="245" y="140" fill="#7dd3fc" font-size="10">remontee</text>
          <defs>
            <linearGradient id="waterGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#0c3a5e" stop-opacity="0.3"/>
              <stop offset="1" stop-color="#051525" stop-opacity="0.6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</section>

<!-- ============ SECURITE ============ -->
<section class="deck-section">
  <div class="section-inner">
    <h2 class="section-title">Securite et impact minimal</h2>
    <div class="card-grid two">
      <div class="card">
        <h3>Verticalite du cable</h3>
        <p>En conditions calmes et avec des zones bien choisies (loin des formations coralliennes sensibles), le cable reste vertical lors de la remontee.</p>
        <p>La flottabilite nette du dispositif assure une tension constante vers le haut — pas de boucle, pas de raclage lateral.</p>
        <button class="cta-btn" onclick="document.querySelector('[data-tab=simulation]').click()">Tester dans la simulation →</button>
      </div>
      <div class="card">
        <h3>Zones d'ancrage</h3>
        <p>Les stations sont positionnees sur des zones de substrat nu (sable, roche) identifiees par cartographie prealable.</p>
        <p>La seule infrastructure en contact avec le fond est l'ancre — un bloc de beton de faible emprise.</p>
        <p>Aucun contact avec les formations coralliennes vivantes.</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ COMPARATIF ============ -->
<section class="deck-section alt">
  <div class="section-inner">
    <h2 class="section-title">CAPEX vs OPEX</h2>
    <div class="comparison-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Cameras fixes</th>
            <th>Drones</th>
            <th class="highlight-col">CORAL (hybride)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CAPEX initial</td>
            <td>Moyen</td>
            <td>Eleve</td>
            <td class="highlight-col">Bas</td>
          </tr>
          <tr>
            <td>OPEX / entretien</td>
            <td class="bad-cell">Eleve (plongeurs)</td>
            <td class="bad-cell">Eleve (R&D, reparations)</td>
            <td class="good-cell">Bas (surface uniquement)</td>
          </tr>
          <tr>
            <td>Risque corail</td>
            <td>Faible</td>
            <td class="bad-cell">Eleve (collisions)</td>
            <td class="good-cell">Minimal (vertical)</td>
          </tr>
          <tr>
            <td>Couverture</td>
            <td class="bad-cell">Fixe, limitee</td>
            <td>Mobile, bonne</td>
            <td class="good-cell">Multi-stations + mapping</td>
          </tr>
          <tr>
            <td>Scalabilite</td>
            <td class="bad-cell">Lineaire (cout)</td>
            <td class="bad-cell">Complexe</td>
            <td class="good-cell">Ajout de stations</td>
          </tr>
          <tr>
            <td>Autonomie</td>
            <td>Manuelle</td>
            <td>Semi-auto</td>
            <td class="good-cell">Phase 2 : totale</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ============ FOOTER ============ -->
<section class="deck-section footer-section">
  <div class="section-inner">
    <h2 class="section-title">Prochain pas</h2>
    <p class="section-subtitle">Validez le concept avec notre simulation interactive, explorez les parametres, et contactez-nous pour un pilote.</p>
    <button class="cta-btn large" onclick="document.querySelector('[data-tab=simulation]').click()">Ouvrir la simulation →</button>
  </div>
</section>

  `;

  // Animate sections on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.1 });

  el.querySelectorAll('.deck-section').forEach(s => observer.observe(s));
}
