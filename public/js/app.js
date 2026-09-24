document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tabs .tab');
  const panels = document.querySelectorAll('main.wrap > section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active states
      tabs.forEach(t => {
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      panels.forEach(p => p.hidden = true);

      // Activate clicked tab
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');

      const targetId = 'panel-' + tab.id.replace('tab-', '');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.hidden = false;
      }
    });
  });
});
