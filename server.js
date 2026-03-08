/**
 * Agent Dashboard - REST API Server
 * Run: node server.js
 * Serves: http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'public', 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const QUESTS_FILE = path.join(DATA_DIR, 'quests.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'out')));
app.use('/data', express.static(DATA_DIR));

// ─── In-memory store ───────────────────────────────────────────────────────────
const AGENT_NAMES = ['nova', 'hex', 'echo', 'pixel', 'atlas', 'lyra'];

const AGENT_META = {
  lyra: { role: 'AI Orchestrator', description: 'OpenClaw AI — coordinates agents, builds systems, and manages infrastructure.', color: '#e879f9', avatar: 'LY' },
};

let store = {
  agents: {},
  quests: [],
};

function initStore() {
  // Seed agent registry
  for (const name of AGENT_NAMES) {
    const meta = AGENT_META[name] || {};
    store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'idle',
      lastUpdate: null,
      currentTask: null,
      results: [],
      commands: [],
      ...meta,
    };
  }
}

function loadData() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        for (const a of raw) {
          const key = a.id || a.name?.toLowerCase();
          if (key && store.agents[key]) {
            store.agents[key] = { ...store.agents[key], ...a };
          }
        }
      }
    }
    if (fs.existsSync(QUESTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(QUESTS_FILE, 'utf8'));
      if (Array.isArray(raw)) store.quests = raw;
    }
  } catch (e) {
    console.warn('[store] Failed to load persisted data:', e.message);
  }
}

function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(Object.values(store.agents), null, 2));
    fs.writeFileSync(QUESTS_FILE, JSON.stringify(store.quests, null, 2));
  } catch (e) {
    console.warn('[store] Failed to persist data:', e.message);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getAgent(name) {
  return store.agents[name.toLowerCase()] || null;
}

function now() {
  return new Date().toISOString();
}

// ─── Agent API ─────────────────────────────────────────────────────────────────

// POST /api/agent/:name/status — agent posts its current status
app.post('/api/agent/:name/status', (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const { status, currentTask, lastUpdate, metadata } = req.body;
  const validStatuses = ['active', 'idle', 'error', 'working', 'thinking', 'online'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }
  const agent = store.agents[name];
  if (status) agent.status = status;
  if (currentTask !== undefined) agent.currentTask = currentTask;
  if (metadata) agent.metadata = { ...agent.metadata, ...metadata };
  // Allow agent to provide its own timestamp (Unix epoch or ISO string)
  agent.lastUpdate = lastUpdate ? new Date(typeof lastUpdate === 'number' ? lastUpdate * 1000 : lastUpdate).toISOString() : now();
  saveData();
  console.log(`[${name}] status → ${agent.status}${agent.currentTask ? ` | ${agent.currentTask}` : ''}`);
  res.json({ ok: true, agent: sanitizeAgent(agent) });
});

// POST /api/agent/:name/result — agent posts a task result
app.post('/api/agent/:name/result', (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const { questId, title, output, success, tokensUsed, durationMs } = req.body;
  const result = {
    id: `r-${Date.now()}`,
    questId: questId || null,
    title: title || 'Task result',
    output: output || '',
    success: success !== false,
    tokensUsed: tokensUsed || 0,
    durationMs: durationMs || 0,
    timestamp: now(),
  };
  const agent = store.agents[name];
  agent.results = [result, ...(agent.results || [])].slice(0, 20);
  agent.lastUpdate = now();
  if (result.success) {
    agent.status = 'idle';
    agent.currentTask = null;
  }
  // Update matching quest if any
  if (questId) {
    const quest = store.quests.find(q => q.id === questId);
    if (quest) {
      quest.status = result.success ? 'completed' : 'failed';
      quest.completedAt = now();
      quest.output = result.output;
    }
  }
  saveData();
  console.log(`[${name}] result posted: ${result.title} (${result.success ? 'ok' : 'fail'})`);
  res.json({ ok: true, result });
});

// GET /api/agents — get all agents
app.get('/api/agents', (req, res) => {
  res.json(Object.values(store.agents).map(sanitizeAgent));
});

// GET /api/agent/:name — get single agent
app.get('/api/agent/:name', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(sanitizeAgent(agent));
});

// POST /api/agent/:name/command — send a command to an agent
app.post('/api/agent/:name/command', (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
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
  store.agents[name].commands = [cmd, ...(store.agents[name].commands || [])].slice(0, 50);
  saveData();
  console.log(`[${name}] command queued: ${command}`);
  res.json({ ok: true, command: cmd });
});

// GET /api/agent/:name/commands — agent polls for pending commands
app.get('/api/agent/:name/commands', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const pending = (agent.commands || []).filter(c => c.status === 'pending');
  res.json(pending);
});

// PATCH /api/agent/:name/command/:cmdId — agent acknowledges/completes a command
app.patch('/api/agent/:name/command/:cmdId', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const cmd = (agent.commands || []).find(c => c.id === req.params.cmdId);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  cmd.status = req.body.status || 'acknowledged';
  saveData();
  res.json({ ok: true, command: cmd });
});

// ─── Quest API ─────────────────────────────────────────────────────────────────

// GET /api/quests — get all quests
app.get('/api/quests', (req, res) => {
  const { status, agent } = req.query;
  let quests = store.quests;
  if (status) quests = quests.filter(q => q.status === status);
  if (agent) quests = quests.filter(q => q.agentId === agent.toLowerCase());
  res.json(quests);
});

// POST /api/quests — create a new quest
app.post('/api/quests', (req, res) => {
  const { title, description, why, agentId, priority, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const quest = {
    id: `q-${Date.now()}`,
    title,
    description: description || '',
    why: why || '',
    agentId: agentId?.toLowerCase() || null,
    agentName: agentId ? (agentId.charAt(0).toUpperCase() + agentId.slice(1)) : null,
    status: 'pending',
    priority: priority || 'medium',
    tags: tags || [],
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    output: null,
    progress: 0,
  };
  store.quests.push(quest);
  saveData();
  res.status(201).json(quest);
});

// PATCH /api/quest/:id — update a quest
app.patch('/api/quest/:id', (req, res) => {
  const quest = store.quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const allowed = ['status', 'progress', 'output', 'currentStep', 'agentId', 'startedAt', 'completedAt'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) quest[key] = req.body[key];
  }
  if (req.body.status === 'running' && !quest.startedAt) quest.startedAt = now();
  if (['completed', 'failed'].includes(req.body.status) && !quest.completedAt) quest.completedAt = now();
  saveData();
  res.json(quest);
});

// DELETE /api/quest/:id
app.delete('/api/quest/:id', (req, res) => {
  const idx = store.quests.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quest not found' });
  store.quests.splice(idx, 1);
  saveData();
  res.json({ ok: true });
});

// ─── Misc ──────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, agents: AGENT_NAMES.length, quests: store.quests.length, time: now() });
});

// POST /api/agent/:name/register — auto-register a new agent if not known
app.post('/api/agent/:name/register', (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    const { role, description, color, avatar } = req.body;
    store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'idle',
      lastUpdate: null,
      currentTask: null,
      results: [],
      commands: [],
      role: role || 'Agent',
      description: description || '',
      color: color || '#666',
      avatar: avatar || name.slice(0, 2).toUpperCase(),
    };
    AGENT_NAMES.push(name);
    saveData();
    console.log(`[register] new agent: ${name}`);
  }
  res.json({ ok: true, agent: sanitizeAgent(store.agents[name]) });
});

// Serve index.html for non-API routes (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'out', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

function sanitizeAgent(agent) {
  const { commands, ...safe } = agent;
  return { ...safe, pendingCommands: (commands || []).filter(c => c.status === 'pending').length };
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
initStore();
loadData();

app.listen(PORT, () => {
  console.log(`\n🔴 Agent Dashboard API running on http://localhost:${PORT}`);
  console.log(`   Agents: ${AGENT_NAMES.join(', ')}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/agents`);
  console.log(`     GET  /api/agent/:name`);
  console.log(`     POST /api/agent/:name/status`);
  console.log(`     POST /api/agent/:name/result`);
  console.log(`     POST /api/agent/:name/command`);
  console.log(`     GET  /api/quests`);
  console.log(`     POST /api/quests`);
  console.log(`     PATCH /api/quest/:id\n`);
});
