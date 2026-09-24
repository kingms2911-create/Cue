// Shared 3 Trials and App Initialization Logic
function getRemainingTrials() {
  let trials = localStorage.getItem('cue_free_trials');
  if (trials === null) {
    trials = 3;
    localStorage.setItem('cue_free_trials', trials);
  }
  return parseInt(trials, 10);
}

function updateTrialDisplay() {
  const counter = document.getElementById('trial-counter');
  const trials = getRemainingTrials();
  if (counter) {
    counter.textContent = `Muft trials bache hain: ${trials}/3`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    updateTrialDisplay();
  } catch (e) {
    console.error(e);
  }

  // Robust Tab switching logic for mobile & desktop
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('main > section');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('aria-controls');
      
      // Hide all panels
      panels.forEach(section => {
        section.hidden = true;
      });
      
      // Deactivate all tabs
      tabs.forEach(t => {
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      
      // Activate clicked tab and panel
      tab.setAttribute('aria-selected', 'true');
      tab.removeAttribute('tabindex');
      
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Intercept form submissions across services to check trials
  const briefForm = document.getElementById('brief');
  if (briefForm) {
    briefForm.addEventListener('submit', (e) => {
      let trials = getRemainingTrials();
      if (trials <= 0) {
        e.preventDefault();
        alert('Aapke 3 free trials khatam ho chuke hain! Kripya Publish tab mein jaakar UPI payment karein.');
      } else {
        trials -= 1;
        localStorage.setItem('cue_free_trials', trials);
        updateTrialDisplay();
      }
    });
  }

  // Redirect on trial expiry alert
  const originalAlert = window.alert;
  window.alert = function(msg) {
    if (msg && msg.includes('khatam ho chuke hain')) {
      const pubTab = document.getElementById('tab-publish');
      if (pubTab) pubTab.click();
      setTimeout(() => {
        const upiSec = document.getElementById('h-upi');
        if (upiSec) upiSec.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      return;
    }
    originalAlert(msg);
  };
});
