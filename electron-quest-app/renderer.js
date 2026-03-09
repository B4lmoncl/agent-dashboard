// ─── Config (localStorage) ───────────────────────────────────────────────────
const DEFAULT_SERVER = 'http://187.77.139.247:3001';

function loadConfig() {
  return {
    API_BASE: localStorage.getItem('cfg_server') || '',
    API_KEY:  localStorage.getItem('cfg_apikey') || '',
  };
}

function saveConfig(server, apiKey) {
  localStorage.setItem('cfg_server', server);
  localStorage.setItem('cfg_apikey', apiKey);
}

function isConfigured() {
  const { API_BASE, API_KEY } = loadConfig();
  return !!(API_BASE && API_KEY);
}

// ─── App version (from package.json via Node.js) ──────────────────────────────
let APP_VERSION = '1.0.0';
try {
  const path = require('path');
  const { readFileSync } = require('fs');
  const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  APP_VERSION = pkg.version || '1.0.0';
} catch (_) { /* ignore */ }

// ─── Connection status ────────────────────────────────────────────────────────
async function checkConnection() {
  const { API_BASE } = loadConfig();
  const base = API_BASE || DEFAULT_SERVER;
  const dot = document.getElementById('connection-dot');
  if (!dot) return;
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
    dot.classList.toggle('connected', r.ok);
  } catch (_) {
    dot.classList.remove('connected');
  }
}

// ─── DOM refs ────────────────────────────────────────────────────────────────
const form        = document.getElementById('quest-form');
const submitBtn   = document.getElementById('submit-btn');
const msgEl       = document.getElementById('message');
const tabBtns     = document.querySelectorAll('.tab');
const tabQuest    = document.getElementById('tab-quest');
const tabSettings = document.getElementById('tab-settings');
const cfgServer   = document.getElementById('cfg-server');
const cfgApiKey   = document.getElementById('cfg-apikey');
const saveBtn     = document.getElementById('save-settings-btn');
const settingsBtn = document.getElementById('settings-btn');
const appVersionEl      = document.getElementById('app-version');
const dashVersionEl     = document.getElementById('dashboard-version');
const aboutServerEl     = document.getElementById('about-server');

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  tabQuest.classList.toggle('hidden', name !== 'quest');
  tabSettings.classList.toggle('hidden', name !== 'settings');
  if (name === 'settings') populateSettingsFields();
}

tabBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
settingsBtn.addEventListener('click', () => switchTab('settings'));

// ─── Populate settings fields ─────────────────────────────────────────────────
function populateSettingsFields() {
  const { API_BASE, API_KEY } = loadConfig();
  cfgServer.value = API_BASE || DEFAULT_SERVER;
  cfgApiKey.value = API_KEY || '';
  appVersionEl.textContent = `v${APP_VERSION}`;
  aboutServerEl.textContent = API_BASE || DEFAULT_SERVER;
  fetchDashboardVersion();
}

async function fetchDashboardVersion() {
  const { API_BASE } = loadConfig();
  const base = API_BASE || DEFAULT_SERVER;
  try {
    const r = await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      dashVersionEl.textContent = data.dashboard ? `v${data.dashboard}` : '—';
    } else {
      dashVersionEl.textContent = '—';
    }
  } catch (_) {
    dashVersionEl.textContent = '—';
  }
}

// ─── Save settings ────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const server = cfgServer.value.trim().replace(/\/$/, '') || DEFAULT_SERVER;
  const apiKey = cfgApiKey.value.trim();
  saveConfig(server, apiKey);
  aboutServerEl.textContent = server;
  showMessage('Settings saved!');
  checkConnection();
  setTimeout(() => switchTab('quest'), 1200);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showMessage(text, isError = false) {
  msgEl.textContent = text;
  msgEl.className = 'message ' + (isError ? 'error' : 'success');
  setTimeout(() => {
    msgEl.className = 'message hidden';
  }, 4000);
}

// ─── Quest form submit ────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { API_BASE, API_KEY } = loadConfig();
  const base = API_BASE || DEFAULT_SERVER;

  const title            = document.getElementById('title').value.trim();
  const description      = document.getElementById('description').value.trim();
  const priority         = document.getElementById('priority').value;
  const humanInputRequired = document.getElementById('human-input').checked;

  // Collect checked categories
  const checkedBoxes = document.querySelectorAll('.category-cb:checked');
  const categories   = Array.from(checkedBoxes).map(cb => cb.value);
  const category     = categories[0] || undefined;

  if (!title) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting…';

  try {
    const resp = await fetch(`${base}/api/quest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({ title, description, priority, category, categories, humanInputRequired }),
    });

    if (resp.ok) {
      const data = await resp.json();
      showMessage(`Quest posted! ID: ${data.quest.id}`);
      form.reset();
      document.getElementById('priority').value = 'medium';
      document.querySelectorAll('.category-cb').forEach(cb => { cb.checked = false; });
      // Success shimmer on form
      form.classList.add('form-shimmer');
      setTimeout(() => form.classList.remove('form-shimmer'), 800);
    } else {
      const err = await resp.json().catch(() => ({}));
      showMessage(`Error ${resp.status}: ${err.error || resp.statusText}`, true);
    }
  } catch (err) {
    showMessage(`Network error: ${err.message}`, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Quest';
  }
});

// ─── Auto-update check + one-click install ────────────────────────────────────
const GITHUB_REPO = 'b4lmoncl/agent-dashboard';
const updateBtn       = document.getElementById('check-update-btn');
const updateMsgEl     = document.getElementById('update-message');
const updateProgressEl = document.getElementById('update-progress');

let pendingUpdateUrl = null;

function setUpdateProgress(fraction) {
  if (!updateProgressEl) return;
  if (fraction === null) { updateProgressEl.style.display = 'none'; return; }
  updateProgressEl.style.display = 'block';
  updateProgressEl.querySelector('.progress-fill').style.width = `${Math.round(fraction * 100)}%`;
  updateProgressEl.querySelector('.progress-label').textContent = `${Math.round(fraction * 100)}%`;
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http  = require('http');
    const fs    = require('fs');

    const makeRequest = (targetUrl) => {
      const mod = targetUrl.startsWith('https') ? https : http;
      mod.get(targetUrl, { headers: { 'User-Agent': 'quest-forge-app' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return makeRequest(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', chunk => {
          downloaded += chunk.length;
          if (onProgress && total) onProgress(downloaded / total);
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

async function doInstallUpdate(downloadUrl) {
  const os  = require('os');
  const path = require('path');
  const { ipcRenderer } = require('electron');

  if (updateBtn) { updateBtn.disabled = true; updateBtn.textContent = 'Downloading…'; }
  if (updateMsgEl) { updateMsgEl.textContent = 'Downloading update…'; updateMsgEl.className = 'update-available'; }
  setUpdateProgress(0);

  const tempPath = path.join(os.tmpdir(), 'quest-forge-update.exe');

  try {
    await downloadFile(downloadUrl, tempPath, (p) => {
      setUpdateProgress(p);
      if (updateBtn) updateBtn.textContent = `Downloading… ${Math.round(p * 100)}%`;
    });

    setUpdateProgress(1);
    if (updateMsgEl) { updateMsgEl.textContent = 'Installing… App will restart shortly.'; }
    if (updateBtn) updateBtn.textContent = 'Restarting…';

    await ipcRenderer.invoke('perform-update', tempPath);
  } catch (err) {
    setUpdateProgress(null);
    if (updateMsgEl) { updateMsgEl.textContent = `Update failed: ${err.message}`; updateMsgEl.className = 'update-ok'; }
    if (updateBtn) { updateBtn.disabled = false; updateBtn.textContent = 'Retry Update'; }
  }
}

if (updateBtn) {
  updateBtn.addEventListener('click', async () => {
    // If a .exe asset was already found, install immediately
    if (pendingUpdateUrl) {
      doInstallUpdate(pendingUpdateUrl);
      return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = 'Checking…';
    if (updateMsgEl) { updateMsgEl.textContent = ''; updateMsgEl.className = ''; }
    setUpdateProgress(null);

    try {
      const r = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'User-Agent': 'quest-forge-app' }, signal: AbortSignal.timeout(5000) }
      );
      if (!r.ok) {
        if (updateMsgEl) { updateMsgEl.textContent = 'No releases found.'; updateMsgEl.className = 'update-ok'; }
        updateBtn.disabled = false; updateBtn.textContent = 'Check for Updates';
        return;
      }

      const data   = await r.json();
      const latest = (data.tag_name || '').replace(/^v/, '');

      if (!latest) {
        if (updateMsgEl) { updateMsgEl.textContent = 'Could not parse version.'; updateMsgEl.className = 'update-ok'; }
        updateBtn.disabled = false; updateBtn.textContent = 'Check for Updates';
        return;
      }

      if (latest === APP_VERSION) {
        if (updateMsgEl) { updateMsgEl.textContent = "You're up to date!"; updateMsgEl.className = 'update-ok'; }
        updateBtn.disabled = false; updateBtn.textContent = 'Check for Updates';
        return;
      }

      // Newer version found — look for a portable .exe asset
      const assets   = data.assets || [];
      const exeAsset =
        assets.find(a => /portable.*\.exe$/i.test(a.name)) ||
        assets.find(a => /\.exe$/i.test(a.name) && !/setup/i.test(a.name)) ||
        assets.find(a => /\.exe$/i.test(a.name));

      if (exeAsset) {
        pendingUpdateUrl = exeAsset.browser_download_url;
        if (updateMsgEl) {
          updateMsgEl.textContent = `v${latest} ready — click to install & restart.`;
          updateMsgEl.className = 'update-available';
        }
        updateBtn.disabled = false;
        updateBtn.textContent = 'Install Update';
      } else {
        // No .exe asset attached — just show a link
        if (updateMsgEl) {
          updateMsgEl.textContent = `v${latest} available — no .exe found. Visit github.com/${GITHUB_REPO}/releases`;
          updateMsgEl.className = 'update-available';
        }
        updateBtn.disabled = false; updateBtn.textContent = 'Check for Updates';
      }
    } catch (_) {
      if (updateMsgEl) { updateMsgEl.textContent = 'Could not reach GitHub.'; updateMsgEl.className = 'update-ok'; }
      updateBtn.disabled = false; updateBtn.textContent = 'Check for Updates';
    }
  });
}

// ─── Init: show settings on first run if not configured ───────────────────────
if (!isConfigured()) {
  switchTab('settings');
} else {
  switchTab('quest');
}

checkConnection();

// ─── Ember particle system ────────────────────────────────────────────────────
(function initEmbers() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const COLORS = [
    [255, 107, 0],   // #ff6b00
    [255, 69,  0],   // #ff4500
    [255, 140, 0],   // #ff8c00
    [255, 165, 0],   // #ffa500
    [255, 200, 50],  // warm yellow
  ];

  function createEmber(randomY) {
    const rgb = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: Math.random() * canvas.width,
      y: randomY ? Math.random() * canvas.height : canvas.height + 4,
      size: Math.random() * 2.0 + 0.5,
      speedY: -(Math.random() * 0.55 + 0.2),
      speedX: (Math.random() - 0.5) * 0.35,
      maxOpacity: Math.random() * 0.65 + 0.25,
      opacity: 0,
      rgb: rgb,
      flicker: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 0.07 + 0.03,
    };
  }

  const COUNT = 60;
  const particles = Array.from({ length: COUNT }, () => createEmber(true));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y += p.speedY;
      p.x += p.speedX;
      p.flicker += p.flickerSpeed;

      const flicker = Math.sin(p.flicker) * 0.25 + 0.75;
      const fade = canvas.height * 0.2;
      let base;
      if (p.y < fade) {
        base = p.maxOpacity * (p.y / fade);
      } else {
        base = p.maxOpacity;
      }
      p.opacity = base * flicker;

      if (p.y < -6) { particles[i] = createEmber(false); continue; }

      const [r, g, b] = p.rgb;

      // Glow halo
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
      glow.addColorStop(0, `rgba(${r},${g},${b},${(p.opacity * 0.35).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,240,200,${(p.opacity * 0.9).toFixed(3)})`;
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
