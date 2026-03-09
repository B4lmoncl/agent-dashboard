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

// ─── Auto-update check ────────────────────────────────────────────────────────
const GITHUB_REPO = 'b4lmoncl/agent-dashboard';
const updateBtn  = document.getElementById('check-update-btn');
const updateMsgEl = document.getElementById('update-message');

if (updateBtn) {
  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    updateBtn.textContent = 'Checking…';
    if (updateMsgEl) { updateMsgEl.textContent = ''; updateMsgEl.className = ''; }
    try {
      const r = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'User-Agent': 'quest-forge-app' }, signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const data = await r.json();
        const latest = (data.tag_name || '').replace(/^v/, '');
        if (latest && latest !== APP_VERSION) {
          if (updateMsgEl) {
            updateMsgEl.textContent = `v${latest} available! Download at github.com/${GITHUB_REPO}/releases`;
            updateMsgEl.className = 'update-available';
          }
        } else if (latest) {
          if (updateMsgEl) { updateMsgEl.textContent = 'You\'re up to date!'; updateMsgEl.className = 'update-ok'; }
        } else {
          if (updateMsgEl) { updateMsgEl.textContent = 'Could not parse version.'; updateMsgEl.className = 'update-ok'; }
        }
      } else {
        if (updateMsgEl) { updateMsgEl.textContent = 'No releases found.'; updateMsgEl.className = 'update-ok'; }
      }
    } catch (_) {
      if (updateMsgEl) { updateMsgEl.textContent = 'Could not reach GitHub.'; updateMsgEl.className = 'update-ok'; }
    } finally {
      updateBtn.disabled = false;
      updateBtn.textContent = 'Check for Updates';
    }
  });
}

// ─── Init: show settings on first run if not configured ───────────────────────
if (!isConfigured()) {
  switchTab('settings');
} else {
  switchTab('quest');
}
