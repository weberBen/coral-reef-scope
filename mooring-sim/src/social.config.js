const GITHUB_USER = 'weberBen';
const GITHUB_REPO = 'coral-reef-scope';

import readmeMd from '../../README.md?raw';

export default {
  links: [
    { type: 'github', url: `https://github.com/${GITHUB_USER}/${GITHUB_REPO}`, aria: 'GitHub repository', desc: 'See the open source code on Github and contribute' },
    { type: 'blog', url: 'https://feed.rnznr.com/@ben', label: 'Mon blabla', aria: 'Blog feed link', desc: 'Follow my personal feed (Twitter/Instagram) for up to date info' },
  ],
  readme: {
    md: readmeMd,
    fallbackUrl: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/README.md`,
    label: 'About this project',
  },
  toolbar: true,
  nav: [
    { key: 'info', label: 'Info ?', action: 'modal' },
  ],
};
