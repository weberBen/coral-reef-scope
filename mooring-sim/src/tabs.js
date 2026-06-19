const listeners = [];

export function onTabChange(callback) {
  listeners.push(callback);
}

export function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const tabs = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      if (!target) return;

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabs.forEach(t => {
        t.style.display = t.id === `tab-${target}` ? '' : 'none';
        t.classList.toggle('active', t.id === `tab-${target}`);
      });

      // Notify listeners after display change
      requestAnimationFrame(() => {
        listeners.forEach(cb => cb(target));
      });
    });
  });
}
