// ─── Agent API ─────────────────────────────────────────────────────────────────
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, AGENT_NAMES, saveData } = require('../lib/state');
const { now, getAgent, sanitizeAgent } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');

// POST /api/agent/:name/status — agent posts its current status
router.post('/api/agent/:name/status', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!state.store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const validStatuses = ['online', 'working', 'idle', 'offline'];
  const validHealth = ['ok', 'needs_checkin', 'broken'];

  const { status, platform, uptime, currentJobDuration, jobsCompleted, revenue, health } = req.body;

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }
  if (health && !validHealth.includes(health)) {
    return res.status(400).json({ error: `Invalid health. Use: ${validHealth.join(', ')}` });
  }

  const agent = state.store.agents[name];
  if (status !== undefined) agent.status = status;
  if (platform !== undefined) agent.platform = platform;
  if (uptime !== undefined) agent.uptime = Number(uptime);
  if (currentJobDuration !== undefined) agent.currentJobDuration = Number(currentJobDuration);
  if (jobsCompleted !== undefined) agent.jobsCompleted = Number(jobsCompleted);
  if (revenue !== undefined) agent.revenue = Number(revenue);
  if (health !== undefined) agent.health = health;
  agent.lastUpdate = now();

  saveData();
  console.log(`[${name}] status → ${agent.status} | platform: ${agent.platform} | health: ${agent.health}`);
  res.json({ ok: true, agent: sanitizeAgent(agent) });
});

// GET /api/agents — get all agents
router.get('/api/agents', (req, res) => {
  const STALE_MS = 30 * 60 * 1000; // 30 minutes
  const nowMs = Date.now();
  const agents = Object.values(state.store.agents).map(agent => {
    const copy = sanitizeAgent(agent);
    if (agent.lastUpdate && (nowMs - new Date(agent.lastUpdate).getTime()) > STALE_MS) {
      if (agent.health === 'ok') copy.health = 'stale';
    }
    return copy;
  });
  res.json(agents);
});

// GET /api/agent/:name — get single agent
router.get('/api/agent/:name', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(sanitizeAgent(agent));
});

// POST /api/agent/:name/command — send a command to an agent
router.post('/api/agent/:name/command', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!state.store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const { command, params } = req.body;
  if (!command) return res.status(400).json({ error: 'command is required' });
  const cmd = {
    id: `cmd-${Date.now()}`,
    command,
    params: params || {},
    issuedAt: now(),
    status: 'pending',
  };
  state.store.agents[name].commands = [cmd, ...(state.store.agents[name].commands || [])].slice(0, 50);
  saveData();
  console.log(`[${name}] command queued: ${command}`);
  res.json({ ok: true, command: cmd });
});

// GET /api/agent/:name/commands — agent polls for pending commands
router.get('/api/agent/:name/commands', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const pending = (agent.commands || []).filter(c => c.status === 'pending');
  res.json(pending);
});

// PATCH /api/agent/:name/command/:cmdId — agent acknowledges/completes a command
router.patch('/api/agent/:name/command/:cmdId', requireApiKey, (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const cmd = (agent.commands || []).find(c => c.id === req.params.cmdId);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  cmd.status = req.body.status || 'acknowledged';
  saveData();
  res.json({ ok: true, command: cmd });
});

// POST /api/agent/:name/register — auto-register a new agent if not known
router.post('/api/agent/:name/register', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  const { role, description, color, avatar } = req.body;
  if (!state.store.agents[name]) {
    state.store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'offline',
      platform: null,
      uptime: 0,
      currentJobDuration: 0,
      jobsCompleted: 0,
      questsCompleted: 0,
      revenue: 0.00,
      health: 'ok',
      lastUpdate: null,
      commands: [],
      role: String(role || 'Agent').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      description: String(description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      color: color || '#666',
      avatar: avatar || name.slice(0, 2).toUpperCase(),
    };
    AGENT_NAMES.push(name);
    console.log(`[register] new agent: ${name}`);
  } else {
    // Update meta fields if provided in the request body
    if (avatar !== undefined) state.store.agents[name].avatar = avatar;
    if (role !== undefined) state.store.agents[name].role = role;
    if (description !== undefined) state.store.agents[name].description = description;
    if (color !== undefined) state.store.agents[name].color = color;
  }
  saveData();
  res.json({ ok: true, agent: sanitizeAgent(state.store.agents[name]) });
});

// POST /api/agent/:name/checkin — mark check-in complete, reset health to "ok"
router.post('/api/agent/:name/checkin', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!state.store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  state.store.agents[name].health = 'ok';
  state.store.agents[name].lastUpdate = now();
  saveData();
  console.log(`[${name}] checkin complete — health reset to ok`);
  res.json({ ok: true, agent: sanitizeAgent(state.store.agents[name]) });
});

// GET /api/version
const dashboardPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const electronPkg  = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'electron-quest-app', 'package.json'), 'utf8')); }
  catch (_) { return { version: '1.0.0' }; }
})();
router.get('/api/version', (req, res) => {
  res.json({ dashboard: dashboardPkg.version, app: electronPkg.version });
});

// GET /api/health
router.get('/api/health', (req, res) => {
  res.json({ ok: true, agents: AGENT_NAMES.length, time: now() });
});

module.exports = router;
