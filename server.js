/**
 * Agent Dashboard - REST API Server
 * Run: node server.js
 * Serves: http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'public', 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');

app.use(cors());
app.use(express.json());

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.set('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
  },
});
app.use(limiter);

app.use(express.static(path.join(__dirname, 'out')));
app.use('/data', express.static(DATA_DIR));

// ─── Auth ───────────────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('[fatal] API_KEY environment variable is not set. Exiting.');
  process.exit(1);
}
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Set X-API-Key header' });
  }
  next();
}

// ─── In-memory store ───────────────────────────────────────────────────────────
const AGENT_NAMES = ['nova', 'hex', 'echo', 'pixel', 'atlas', 'lyra'];

const AGENT_META = {
  nova:  { avatar: 'NO', color: '#8b5cf6', role: 'Optimizer' },
  hex:   { avatar: 'HX', color: '#10b981', role: 'Code Engineer' },
  echo:  { avatar: 'EC', color: '#ef4444', role: 'Sales' },
  pixel: { avatar: 'PX', color: '#f59e0b', role: 'Marketer' },
  atlas: { avatar: 'AT', color: '#6366f1', role: 'Researcher' },
  lyra:  { avatar: 'LY', color: '#e879f9', role: 'AI Orchestrator' },
};

let store = { agents: {} };

function initStore() {
  for (const name of AGENT_NAMES) {
    const meta = AGENT_META[name] || {};
    store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'offline',
      platform: null,
      uptime: 0,
      currentJobDuration: 0,
      jobsCompleted: 0,
      revenue: 0.00,
      health: 'ok',
      lastUpdate: null,
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
  } catch (e) {
    console.warn('[store] Failed to load persisted data:', e.message);
  }
}

function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(Object.values(store.agents), null, 2));
  } catch (e) {
    console.warn('[store] Failed to persist data:', e.message);
  }
}

function getAgent(name) {
  return store.agents[name.toLowerCase()] || null;
}

function now() {
  return new Date().toISOString();
}

function sanitizeAgent(agent) {
  const { commands, ...safe } = agent;
  return { ...safe, pendingCommands: (commands || []).filter(c => c.status === 'pending').length };
}

// ─── Agent API ─────────────────────────────────────────────────────────────────

// POST /api/agent/:name/status — agent posts its current status
app.post('/api/agent/:name/status', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
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

  const agent = store.agents[name];
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
app.post('/api/agent/:name/command', requireApiKey, (req, res) => {
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

// POST /api/agent/:name/register — auto-register a new agent if not known
app.post('/api/agent/:name/register', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    const { role, description, color, avatar } = req.body;
    store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'offline',
      platform: null,
      uptime: 0,
      currentJobDuration: 0,
      jobsCompleted: 0,
      revenue: 0.00,
      health: 'ok',
      lastUpdate: null,
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

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, agents: AGENT_NAMES.length, time: now() });
});

// ─── API Documentation ──────────────────────────────────────────────────────────
const API_DOCS = {
  openapi: '3.0.3',
  info: {
    title: 'Agent Dashboard API',
    version: '1.0.0',
    description: 'REST API for managing and monitoring AI agents. Agents report status, receive commands, and can be queried by operators or other AI systems. POST endpoints always require an X-API-Key header. GET endpoints are public. Rate limited to 100 requests per 15 minutes per IP.',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local server' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Required for all POST operations. GET endpoints are public.',
      },
    },
    schemas: {
      Agent: {
        type: 'object',
        properties: {
          id:                 { type: 'string',  example: 'nova',                       description: 'Unique agent id (lowercase)' },
          name:               { type: 'string',  example: 'Nova',                       description: 'Display name' },
          status:             { type: 'string',  enum: ['online','working','idle','offline'], example: 'working' },
          platform:           { type: 'string',  nullable: true, example: 'AWS',        description: 'Platform the agent runs on' },
          uptime:             { type: 'number',  example: 3600,                         description: 'Uptime in seconds' },
          currentJobDuration: { type: 'number',  example: 120,                          description: 'Current job duration in seconds' },
          jobsCompleted:      { type: 'number',  example: 42 },
          revenue:            { type: 'number',  example: 125.50,                       description: 'Total revenue generated (USD)' },
          health:             { type: 'string',  enum: ['ok','needs_checkin','broken'],  example: 'ok' },
          lastUpdate:         { type: 'string',  format: 'date-time', nullable: true,   example: '2026-03-08T12:00:00.000Z' },
          pendingCommands:    { type: 'integer', example: 2,                            description: 'Number of pending commands' },
          role:               { type: 'string',  example: 'Optimizer' },
          avatar:             { type: 'string',  example: 'NO',                         description: '2-char avatar code' },
          color:              { type: 'string',  example: '#8b5cf6',                    description: 'Hex color for dashboard display' },
        },
      },
      Command: {
        type: 'object',
        properties: {
          id:        { type: 'string', example: 'cmd-1741434000000',              description: 'Command id (cmd-{timestamp})' },
          command:   { type: 'string', example: 'run_task',                       description: 'Command name/type' },
          params:    { type: 'object', example: { task: 'analyze_sales', limit: 100 }, description: 'Optional command parameters' },
          issuedAt:  { type: 'string', format: 'date-time', example: '2026-03-08T12:00:00.000Z' },
          status:    { type: 'string', enum: ['pending','acknowledged','completed'], example: 'pending' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Agent not found' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        description: 'Check if the API server is running.',
        operationId: 'getHealth',
        tags: ['System'],
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean' }, agents: { type: 'integer' }, time: { type: 'string', format: 'date-time' } } },
                example: { ok: true, agents: 6, time: '2026-03-08T12:00:00.000Z' },
              },
            },
          },
        },
        'x-curl': 'curl http://localhost:3001/api/health',
        'x-python': 'import requests\nresp = requests.get("http://localhost:3001/api/health")\nprint(resp.json())',
      },
    },
    '/api/docs': {
      get: {
        summary: 'API documentation (this endpoint)',
        description: 'Returns the full OpenAPI 3.0 specification as JSON. Machine-parseable.',
        operationId: 'getDocs',
        tags: ['System'],
        responses: {
          200: { description: 'OpenAPI specification', content: { 'application/json': { schema: { type: 'object' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/docs',
        'x-python': 'import requests\ndocs = requests.get("http://localhost:3001/api/docs").json()\nfor path in docs["paths"]:\n    print(path)',
      },
    },
    '/api/agents': {
      get: {
        summary: 'List all agents',
        description: 'Returns current status of all registered agents. Good for an initial fleet overview. The dashboard polls this every 8 seconds.',
        operationId: 'listAgents',
        tags: ['Agents'],
        responses: {
          200: {
            description: 'Array of all agents',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
                example: [
                  { id: 'nova', name: 'Nova', status: 'working', platform: 'AWS', uptime: 7200, currentJobDuration: 300, jobsCompleted: 42, revenue: 125.50, health: 'ok', lastUpdate: '2026-03-08T12:00:00.000Z', pendingCommands: 1, role: 'Optimizer', avatar: 'NO', color: '#8b5cf6' },
                  { id: 'hex',  name: 'Hex',  status: 'idle',    platform: null, uptime: 1800, currentJobDuration: 0,   jobsCompleted: 17, revenue: 48.00,  health: 'ok', lastUpdate: '2026-03-08T11:55:00.000Z', pendingCommands: 0, role: 'Code Engineer', avatar: 'HX', color: '#10b981' },
                ],
              },
            },
          },
        },
        'x-curl': 'curl http://localhost:3001/api/agents',
        'x-python': 'import requests\nagents = requests.get("http://localhost:3001/api/agents").json()\nfor a in agents:\n    print(f"{a[\'name\']}: {a[\'status\']} | health={a[\'health\']} | revenue=${a[\'revenue\']}")',
      },
    },
    '/api/agent/{name}': {
      get: {
        summary: 'Get single agent',
        description: 'Returns current status for one agent. Agent name is case-insensitive. Known agents: nova, hex, echo, pixel, atlas, lyra.',
        operationId: 'getAgent',
        tags: ['Agents'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent name (case-insensitive)', example: 'nova' },
        ],
        responses: {
          200: { description: 'Agent object',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Agent' } } } },
          404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Agent not found' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/agent/nova',
        'x-python': 'import requests\nagent = requests.get("http://localhost:3001/api/agent/nova").json()\nprint(agent["status"], agent["health"])',
      },
    },
    '/api/agent/{name}/status': {
      post: {
        summary: 'Update agent status',
        description: 'Agent reports its current status. All fields are optional — only provided fields are updated. Use this as an agent heartbeat. Persists to disk.',
        operationId: 'postAgentStatus',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status:             { type: 'string', enum: ['online','working','idle','offline'] },
                  platform:           { type: 'string', example: 'AWS Lambda' },
                  uptime:             { type: 'number', example: 3600, description: 'Uptime in seconds' },
                  currentJobDuration: { type: 'number', example: 120,  description: 'Current job duration in seconds' },
                  jobsCompleted:      { type: 'number', example: 42 },
                  revenue:            { type: 'number', example: 125.50 },
                  health:             { type: 'string', enum: ['ok','needs_checkin','broken'] },
                },
              },
              example: { status: 'working', platform: 'AWS Lambda', uptime: 3600, currentJobDuration: 120, jobsCompleted: 42, revenue: 125.50, health: 'ok' },
            },
          },
        },
        responses: {
          200: { description: 'Status updated',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } }, example: { ok: true, agent: { id: 'nova', name: 'Nova', status: 'working', health: 'ok', pendingCommands: 0 } } } } },
          400: { description: 'Invalid status/health',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Invalid status. Use: online, working, idle, offline' } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized', hint: 'Set X-API-Key header' } } } },
          404: { description: 'Agent not found',          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/nova/status \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"status":"working","health":"ok","uptime":3600,"revenue":125.50}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/nova/status",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"status": "working", "health": "ok", "uptime": 3600, "revenue": 125.50}\n)\nprint(resp.json())',
      },
    },
    '/api/agent/{name}/command': {
      post: {
        summary: 'Send command to agent',
        description: 'Queue a command for an agent. The agent picks it up on its next poll of /commands. Queue is LIFO, capped at 50. Use PATCH /command/:cmdId to mark commands as done.',
        operationId: 'postAgentCommand',
        tags: ['Commands'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['command'],
                properties: {
                  command: { type: 'string', example: 'run_task',                       description: 'Command name/type to execute' },
                  params:  { type: 'object', example: { task: 'analyze_sales', limit: 100 }, description: 'Optional parameters' },
                },
              },
              example: { command: 'run_task', params: { task: 'analyze_sales', limit: 100 } },
            },
          },
        },
        responses: {
          200: { description: 'Command queued',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, command: { $ref: '#/components/schemas/Command' } } }, example: { ok: true, command: { id: 'cmd-1741434000000', command: 'run_task', params: { task: 'analyze_sales' }, issuedAt: '2026-03-08T12:00:00.000Z', status: 'pending' } } } } },
          400: { description: 'Missing command field',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'command is required' } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Agent not found',          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/nova/command \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"command":"run_task","params":{"task":"analyze_sales"}}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/nova/command",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"command": "run_task", "params": {"task": "analyze_sales"}}\n)\ncmd = resp.json()["command"]\nprint(f"Queued: {cmd[\'id\']}")',
      },
    },
    '/api/agent/{name}/commands': {
      get: {
        summary: 'Get pending commands',
        description: 'Returns all pending commands for an agent. Agents poll this to pick up new work. After processing, PATCH the command id to update its status.',
        operationId: 'getAgentCommands',
        tags: ['Commands'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        responses: {
          200: {
            description: 'Array of pending commands',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Command' } },
                example: [
                  { id: 'cmd-1741434000000', command: 'run_task', params: { task: 'analyze_sales' }, issuedAt: '2026-03-08T12:00:00.000Z', status: 'pending' },
                ],
              },
            },
          },
          404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/agent/nova/commands',
        'x-python': 'import requests\ncmds = requests.get("http://localhost:3001/api/agent/nova/commands").json()\nfor cmd in cmds:\n    print(f"[{cmd[\'id\']}] {cmd[\'command\']} — {cmd[\'params\']}")',
      },
    },
    '/api/agent/{name}/command/{cmdId}': {
      patch: {
        summary: 'Acknowledge or complete a command',
        description: "Update a command's status. Agents call this after processing to acknowledge or mark complete.",
        operationId: 'patchAgentCommand',
        tags: ['Commands'],
        parameters: [
          { name: 'name',  in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
          { name: 'cmdId', in: 'path', required: true, schema: { type: 'string' }, example: 'cmd-1741434000000' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { status: { type: 'string', example: 'completed' } } },
              example: { status: 'completed' },
            },
          },
        },
        responses: {
          200: { description: 'Command updated',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, command: { $ref: '#/components/schemas/Command' } } }, example: { ok: true, command: { id: 'cmd-1741434000000', command: 'run_task', params: {}, issuedAt: '2026-03-08T12:00:00.000Z', status: 'completed' } } } } },
          404: { description: 'Agent or command not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X PATCH http://localhost:3001/api/agent/nova/command/cmd-1741434000000 \\\n  -H "Content-Type: application/json" \\\n  -d \'{"status":"completed"}\'',
        'x-python': 'import requests\nresp = requests.patch(\n    "http://localhost:3001/api/agent/nova/command/cmd-1741434000000",\n    json={"status": "completed"}\n)\nprint(resp.json())',
      },
    },
    '/api/agent/{name}/register': {
      post: {
        summary: 'Register a new agent',
        description: 'Dynamically register a new agent. If the agent already exists, returns the existing record (idempotent). Use for self-registration.',
        operationId: 'registerAgent',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'myagent', description: 'Unique agent name (lowercase)' },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role:        { type: 'string', example: 'Analyzer' },
                  description: { type: 'string', example: 'Analyzes market data' },
                  color:       { type: 'string', example: '#60a5fa', description: 'Hex color' },
                  avatar:      { type: 'string', example: 'MA',      description: '2-char code' },
                },
              },
              example: { role: 'Analyzer', description: 'Analyzes market data', color: '#60a5fa', avatar: 'MA' },
            },
          },
        },
        responses: {
          200: { description: 'Agent registered',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/myagent/register \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"role":"Analyzer","color":"#60a5fa","avatar":"MA"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/myagent/register",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"role": "Analyzer", "color": "#60a5fa", "avatar": "MA"}\n)\nprint(resp.json())',
      },
    },
  },
};

app.get('/api/docs', (req, res) => {
  res.json(API_DOCS);
});

// ─── Web UI Documentation ───────────────────────────────────────────────────────
app.get('/docs', (req, res) => {
  res.type('html').send(buildDocsHtml(API_DOCS));
});

function buildDocsHtml(docs) {
  const methodColor = { get: '#3b82f6', post: '#22c55e', patch: '#f59e0b', delete: '#ef4444' };
  const methodBg    = { get: '#1e3a5f', post: '#14532d', patch: '#451a03', delete: '#450a0a' };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderEndpoint(method, pathKey, op) {
    const color       = methodColor[method] || '#888';
    const bg          = methodBg[method]    || '#222';
    const requiresAuth = op.security && op.security.length > 0;
    const params      = op.parameters || [];
    const reqBody     = op.requestBody;

    const paramsHtml = params.length ? `
      <div class="section">
        <div class="section-title">Path Parameters</div>
        <table>
          <tr><th>Name</th><th>Type</th><th>Description</th><th>Example</th></tr>
          ${params.map(p => `<tr>
            <td>${p.name}</td>
            <td><span style="color:#aaa">${p.schema?.type || 'string'}</span></td>
            <td>${esc(p.description || '')}</td>
            <td><code>${esc(String(p.example || ''))}</code></td>
          </tr>`).join('')}
        </table>
      </div>` : '';

    const bodyHtml = reqBody ? `
      <div class="section">
        <div class="section-title">Request Body</div>
        <pre>${esc(JSON.stringify(reqBody.content['application/json'].example, null, 2))}</pre>
      </div>` : '';

    const responsesHtml = Object.entries(op.responses || {}).map(([code, resp]) => {
      const ex = resp.content?.['application/json']?.example;
      const ok = parseInt(code) < 400;
      return `<div style="margin-bottom:0.8rem">
        <span style="font-family:monospace;color:${ok ? '#22c55e' : '#ef4444'};font-weight:700">${code}</span>
        <span style="color:#aaa;font-size:0.9rem;margin-left:0.5rem">${esc(resp.description)}</span>
        ${ex ? `<pre style="margin-top:0.3rem">${esc(JSON.stringify(ex, null, 2))}</pre>` : ''}
      </div>`;
    }).join('');

    const curlHtml = op['x-curl'] ? `
      <div class="section">
        <div class="section-title">curl</div>
        <pre>${esc(op['x-curl'])}</pre>
      </div>` : '';

    const pythonHtml = op['x-python'] ? `
      <div class="section">
        <div class="section-title">Python</div>
        <pre>${esc(op['x-python'])}</pre>
      </div>` : '';

    return `
    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge" style="background:${bg};color:${color}">${method.toUpperCase()}</span>
        <span class="path">${esc(pathKey)}</span>
        ${requiresAuth ? '<span class="auth-badge">&#128273; API Key</span>' : ''}
        <span class="desc">${esc(op.summary || '')}</span>
      </div>
      <div class="endpoint-body">
        <p>${esc(op.description || '')}</p>
        ${paramsHtml}
        ${bodyHtml}
        <div class="section">
          <div class="section-title">Responses</div>
          ${responsesHtml}
        </div>
        ${curlHtml}
        ${pythonHtml}
      </div>
    </div>`;
  }

  const pathsHtml = Object.entries(docs.paths || {})
    .map(([pathKey, methods]) =>
      Object.entries(methods).map(([method, op]) =>
        renderEndpoint(method, pathKey, op)
      ).join('')
    ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(docs.info.title)} — API Docs</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d0d;color:#e8e8e8;line-height:1.6}
    .container{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
    header{margin-bottom:2.5rem;border-bottom:1px solid #2a2a2a;padding-bottom:1.5rem}
    h1{font-size:1.8rem;color:#ff4444;margin-bottom:0.4rem}
    .chip{display:inline-block;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:0.15em 0.6em;font-size:0.78rem;font-family:monospace;color:#aaa;margin-right:0.4rem}
    .server{font-family:monospace;font-size:0.9rem;color:#60a5fa;margin-top:0.4rem}
    .desc-main{color:#888;margin-top:0.6rem;font-size:0.9rem}
    h2{font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;margin:2.5rem 0 0.8rem;padding-bottom:0.3rem;border-bottom:1px solid #1a1a1a}
    .endpoint{background:#111;border:1px solid #222;border-radius:8px;margin-bottom:0.8rem;overflow:hidden}
    .endpoint-header{padding:0.85rem 1.2rem;display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap}
    .endpoint-body{padding:1.2rem 1.5rem;border-top:1px solid #1a1a1a}
    .badge{display:inline-block;padding:0.2em 0.55em;border-radius:4px;font-size:0.72rem;font-weight:700;font-family:monospace;letter-spacing:0.05em;min-width:3.5rem;text-align:center}
    .path{font-family:monospace;font-size:0.95rem;color:#e8e8e8}
    .auth-badge{background:#1c1000;color:#f59e0b;border:1px solid #78350f;border-radius:4px;padding:0.15em 0.5em;font-size:0.72rem}
    .desc{color:#666;font-size:0.82rem;margin-left:auto}
    p{color:#888;margin-bottom:1rem;font-size:0.88rem}
    .section{margin-bottom:1.2rem}
    .section-title{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;color:#444;margin-bottom:0.35rem;font-weight:700}
    pre{background:#080808;border:1px solid #1c1c1c;border-radius:6px;padding:0.85rem 1rem;overflow-x:auto;font-family:'Courier New',monospace;font-size:0.8rem;color:#ccc;line-height:1.5;white-space:pre-wrap;word-break:break-word}
    code{font-family:monospace;background:#1a1a1a;padding:0.1em 0.35em;border-radius:3px;font-size:0.88em;color:#7dd3fc}
    table{width:100%;border-collapse:collapse;margin-bottom:0.5rem}
    th{text-align:left;padding:0.35rem 0.8rem;background:#0c0c0c;color:#444;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #1c1c1c}
    td{padding:0.4rem 0.8rem;border-bottom:1px solid #141414;font-size:0.84rem;vertical-align:top}
    td:first-child{font-family:monospace;color:#7dd3fc}
    .auth-box{background:#0c0800;border:1px solid #2d1f00;border-radius:8px;padding:1.1rem 1.4rem;margin-bottom:2rem}
    .auth-box h3{color:#f59e0b;margin-bottom:0.4rem;font-size:0.9rem}
    .auth-box p{margin-bottom:0;font-size:0.84rem}
    footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid #1a1a1a;color:#333;font-size:0.78rem;text-align:center}
    footer a{color:#444;text-decoration:none}
    footer a:hover{color:#666}
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>${esc(docs.info.title)}</h1>
    <div><span class="chip">v${esc(docs.info.version)}</span><span class="chip">OpenAPI 3.0.3</span></div>
    <div class="server">${esc(docs.servers[0].url)}</div>
    <p class="desc-main">${esc(docs.info.description)}</p>
  </header>
  <div class="auth-box">
    <h3>&#128273; Authentication</h3>
    <p>All POST endpoints require an <code>X-API-Key</code> header. GET endpoints are always public. Rate limited to 100 requests per 15 minutes per IP (429 Too Many Requests when exceeded).</p>
    <pre style="margin-top:0.6rem">X-API-Key: YOUR_API_KEY</pre>
  </div>
  <h2>Endpoints</h2>
  ${pathsHtml}
  <footer>Agent Dashboard API &middot; <a href="/api/docs">View as JSON</a></footer>
</div>
</body>
</html>`;
}

// Serve index.html for non-API routes (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'out', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

// ─── Boot ──────────────────────────────────────────────────────────────────────
initStore();
loadData();

app.listen(PORT, () => {
  console.log(`\n🔴 Agent Dashboard API running on http://localhost:${PORT}`);
  console.log(`   Agents: ${AGENT_NAMES.join(', ')}`);
  console.log(`   API Key: ${API_KEY}`);
  console.log(`   Rate limit: 100 req / 15 min per IP`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/agents`);
  console.log(`     GET  /api/agent/:name`);
  console.log(`     POST /api/agent/:name/status  [auth]`);
  console.log(`     POST /api/agent/:name/command [auth]`);
  console.log(`     GET  /api/agent/:name/commands\n`);
});
