const GITHUB_USER = 'weberBen';
const GITHUB_REPO = 'coral-reef-scope';

import readmeMd from '../../readme_presentation.md?raw';

export default {
  links: [
    { type: 'resources', url: 'https://ifrecor.fr/', label: { fr: 'Corail', en: 'Coral' }, aria: { fr: 'Ressources corail', en: 'Coral resources' }, desc: { fr: 'Ressources sur les récifs coralliens (IFRECOR, etc.)', en: 'Resources on coral reefs (IFRECOR, etc.)' } },
    { type: 'github', url: `https://github.com/${GITHUB_USER}/${GITHUB_REPO}`, aria: { fr: 'Dépôt GitHub', en: 'GitHub repository' }, desc: { fr: 'Voir le code open source sur Github et contribuer', en: 'See the open source code on Github and contribute' } },
    { type: 'blog', url: 'https://feed.rnznr.com/@ben', label: { fr: 'Ma Vie', en: 'My Life' }, aria: { fr: 'Flux du blog', en: 'Blog feed link' }, desc: { fr: 'Suivez mon flux personnel (Twitter/Instagram) pour les dernières infos', en: 'Follow my personal feed (Twitter/Instagram) for up to date info' } },
  ],
  readme: {
    md: readmeMd,
    fallbackUrl: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/README.md`,
    label: { fr: 'À propos du projet', en: 'About this project' },
  },
  toolbar: true,
  nav: [
    { key: 'info', label: { fr: 'Info ?', en: 'Info?' }, action: 'modal' },
  ],
};
