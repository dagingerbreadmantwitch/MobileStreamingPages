/**
 * MobileStreamingPages - Client Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initStreamControls();
  initTelemetrySimulator();
  initGalleryModal();
});

/* Theme Toggle (Dark/Light Mode) */
function initThemeToggle() {
  const themeBtn = document.getElementById('themeToggleBtn');
  if (!themeBtn) return;

  const savedTheme = localStorage.getItem('msp_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeBtn, savedTheme);

  themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('msp_theme', newTheme);
    updateThemeIcon(themeBtn, newTheme);
  });
}

function updateThemeIcon(btn, theme) {
  btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  btn.setAttribute('title', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`);
}

/* Camera Switcher & Stream Controls */
function initStreamControls() {
  const cameraBtns = document.querySelectorAll('.cam-select-btn');
  const feedTitle = document.getElementById('activeFeedTitle');
  const resolutionBadge = document.getElementById('resolutionBadge');

  if (cameraBtns.length > 0) {
    cameraBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        cameraBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
        cameraBtns.forEach(b => b.classList.add('btn-glass'));

        btn.classList.remove('btn-glass');
        btn.classList.add('active', 'btn-primary');

        const cameraName = btn.getAttribute('data-cam');
        const res = btn.getAttribute('data-res') || '4K 60fps';

        if (feedTitle) feedTitle.textContent = cameraName;
        if (resolutionBadge) resolutionBadge.textContent = res;
      });
    });
  }

  // Mute / Audio Toggle
  const muteBtn = document.getElementById('muteToggleBtn');
  if (muteBtn) {
    let isMuted = false;
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Audio On';
      muteBtn.style.opacity = isMuted ? '0.6' : '1';
    });
  }
}

/* Real-Time Telemetry Data Generator */
function initTelemetrySimulator() {
  const bitrateEl = document.getElementById('telemetryBitrate');
  const fpsEl = document.getElementById('telemetryFps');
  const viewersEl = document.getElementById('telemetryViewers');

  if (!bitrateEl && !fpsEl && !viewersEl) return;

  setInterval(() => {
    if (bitrateEl) {
      const bitrate = (8.4 + (Math.random() * 0.8 - 0.4)).toFixed(1);
      bitrateEl.textContent = `${bitrate} Mbps`;
    }
    if (fpsEl) {
      const fps = Math.min(60, Math.max(58, Math.floor(60 - Math.random() * 2)));
      fpsEl.textContent = `${fps} FPS`;
    }
    if (viewersEl) {
      const current = parseInt(viewersEl.textContent.replace(/,/g, '')) || 14280;
      const change = Math.floor(Math.random() * 25) - 10;
      viewersEl.textContent = (current + change).toLocaleString();
    }
  }, 2000);
}

/* Gallery Lightbox */
function initGalleryModal() {
  const cards = document.querySelectorAll('.gallery-card');
  const modal = document.getElementById('mediaModal');
  const modalClose = document.getElementById('modalCloseBtn');
  const modalTitle = document.getElementById('modalTitle');

  if (!modal) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const title = card.getAttribute('data-title') || 'Stream Recording Clip';
      if (modalTitle) modalTitle.textContent = title;
      modal.style.display = 'flex';
    });
  });

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}
