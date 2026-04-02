/**
 * API Documentation routes.
 */
const router = require('express').Router();

// ─── API Documentation ──────────────────────────────────────────────────────────
const API_DOCS = {
  openapi: '3.0.3',
  info: {
    title: 'Agent Dashboard API',
    version: '1.0.0',
    description: 'REST API for managing and monitoring AI agents. Agents report status, receive commands, and can be queried by operators or other AI systems. POST endpoints always require an X-API-Key header. GET endpoints are public. Rate limited to 500 requests per 15 minutes per IP.',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local development server' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Required for all POST operations. GET endpoints are public. Multiple keys supported via API_KEYS env var (comma-separated). Each agent can have its own key.',
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
          health:             { type: 'string',  enum: ['ok','needs_checkin','broken','stale'], example: 'ok', description: 'ok=healthy, needs_checkin=agent requests attention, broken=error state, stale=no update in 30min' },
          lastUpdate:         { type: 'string',  format: 'date-time', nullable: true,   example: '2026-03-08T12:00:00.000Z' },
          pendingCommands:    { type: 'integer', example: 2,                            description: 'Number of pending commands' },
          role:               { type: 'string',  example: 'Optimizer' },
          description:        { type: 'string',  example: 'Metrics-driven optimizer with dry wit.',  description: 'Short personality-based description' },
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
      Quest: {
        type: 'object',
        properties: {
          id:                 { type: 'string',  example: 'quest-1741434000000' },
          title:              { type: 'string',  example: 'Analyze Q1 sales data' },
          description:        { type: 'string',  example: 'Pull the full Q1 sales report and identify top 3 opportunities.' },
          rarity:             { type: 'string',  enum: ['common','uncommon','rare','epic','legendary'], example: 'rare', description: 'Quest rarity. Determines XP/Gold rewards.' },
          type:               { type: 'string',  enum: ['development','personal','learning','social'], example: 'development', description: 'Quest type. development=coding/dev work, personal=life tasks, learning=study/research, social=events/networking. Defaults to development.' },
          categories:         { type: 'array',   items: { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'] }, example: ['Research','Coding'], description: 'Array of categories. Replaces the old category field. Send category (string) for backward compat.' },
          product:            { type: 'string',  nullable: true, enum: ['Dashboard','Companion App','Infrastructure','Other'], example: 'Dashboard', description: 'Optional product this quest belongs to.' },
          humanInputRequired: { type: 'boolean', example: false, description: 'If true, this quest requires human input and agents should not claim it alone.' },
          createdBy:          { type: 'string',  example: 'forge', description: 'Identifier of who created the quest. Use agent names (forge, lyra, pixel) for agent-generated quests, or a human name. Defaults to "unknown".' },
          status:             { type: 'string',  enum: ['open','in_progress','completed','suggested','rejected'], example: 'open', description: 'suggested=agent-created, pending human review; rejected=human rejected; open=ready for agents' },
          createdAt:          { type: 'string',  format: 'date-time' },
          claimedBy:          { type: 'string',  nullable: true, example: 'atlas' },
          completedBy:        { type: 'string',  nullable: true, example: 'atlas' },
          completedAt:        { type: 'string',  nullable: true, format: 'date-time' },
          parentQuestId:      { type: 'string',  nullable: true, example: null, description: 'If set, this quest is a sub-quest of the referenced epic quest.' },
          children:           { type: 'array',   description: 'Populated in GET /api/quests for epic quests. Contains child quest objects.', items: { type: 'object' } },
          progress:           { type: 'object',  description: 'Populated in GET /api/quests for epic quests with children.', properties: { completed: { type: 'integer' }, total: { type: 'integer' } } },
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
    '/api/agent/{name}/checkin': {
      post: {
        summary: 'Mark agent check-in complete',
        description: 'Resets agent health to "ok" after a check-in. Use this after resolving whatever triggered needs_checkin.',
        operationId: 'postAgentCheckin',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        responses: {
          200: { description: 'Health reset to ok', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } }, example: { ok: true, agent: { id: 'nova', health: 'ok' } } } } },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Agent not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/agent/nova/checkin \\\n  -H "X-API-Key: YOUR_API_KEY"',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/agent/nova/checkin",\n    headers={"X-API-Key": "YOUR_API_KEY"}\n)\nprint(resp.json())',
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
    '/api/quest': {
      post: {
        summary: 'Create a quest',
        description: 'Post a new quest to the board. All agents can see open quests and claim them. Use categories (array) for multi-category or category (string) for backward compat.',
        operationId: 'createQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title:              { type: 'string', example: 'Analyze Q1 sales data' },
                  description:        { type: 'string', example: 'Pull the full Q1 sales report and identify top 3 opportunities.' },
                  rarity:             { type: 'string', enum: ['common','uncommon','rare','epic','legendary'], example: 'rare' },
                  categories:         { type: 'array', items: { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'] }, example: ['Research','Coding'], description: 'Preferred: array of categories.' },
                  category:           { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'], example: 'Research', description: 'Backward compat: single category string. Converted to categories array internally.' },
                  product:            { type: 'string', enum: ['Dashboard','Companion App','Infrastructure','Other'], example: 'Dashboard', description: 'Optional product this quest belongs to.' },
                  humanInputRequired: { type: 'boolean', example: false, description: 'Set true if this quest requires human input. Agents will avoid claiming it.' },
                  createdBy:          { type: 'string', example: 'forge', description: 'Optional. Who created this quest. Use agent names for agent-generated quests. Defaults to "unknown".' },
                  type:               { type: 'string', enum: ['development','personal','learning','social'], example: 'development', description: 'Quest type. Defaults to development.' },
                  parentQuestId:      { type: 'string', example: 'quest-1741434000000', description: 'Optional. ID of parent epic quest. Makes this a sub-quest.' },
                },
              },
              example: { title: 'Analyze Q1 sales data', description: 'Identify top opportunities.', rarity: 'rare', categories: ['Research'], product: 'Dashboard', humanInputRequired: false, createdBy: 'forge', type: 'development' },
            },
          },
        },
        responses: {
          200: { description: 'Quest created', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, quest: { $ref: '#/components/schemas/Quest' } } } } } },
          400: { description: 'Missing title or invalid field' },
          401: { description: 'Missing or invalid API key' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"title":"Fix login bug","rarity":"rare","categories":["Coding","Bug Fix"],"product":"Dashboard","humanInputRequired":false}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"title": "Fix login bug", "rarity": "rare", "categories": ["Coding", "Bug Fix"], "product": "Dashboard", "humanInputRequired": False}\n)\nprint(resp.json())',
      },
    },
    '/api/quests': {
      get: {
        summary: 'List all quests',
        description: 'Returns quests grouped by status: open, inProgress, completed, suggested (agent-created, pending review), rejected. Supports ?type=personal|development|learning|social filter. Only top-level quests returned; epic quests include children[] and progress{}.',
        operationId: 'listQuests',
        tags: ['Quests'],
        parameters: [
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['development','personal','learning','social'] }, description: 'Filter quests by type.' },
        ],
        responses: {
          200: {
            description: 'Quests grouped by status',
            content: {
              'application/json': {
                schema: { type: 'object', properties: {
                  open:       { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  inProgress: { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  completed:  { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  suggested:  { type: 'array', items: { $ref: '#/components/schemas/Quest' }, description: 'Agent-created quests pending human review' },
                  rejected:   { type: 'array', items: { $ref: '#/components/schemas/Quest' }, description: 'Quests rejected by human reviewer' },
                } },
              },
            },
          },
        },
        'x-curl': 'curl http://187.77.139.247:3001/api/quests',
        'x-python': 'import requests\nquests = requests.get("http://172.18.0.3:3001/api/quests").json()\nprint(f"Open: {len(quests[\'open\'])}, In Progress: {len(quests[\'inProgress\'])}")',
      },
    },
    '/api/quest/{id}/claim': {
      post: {
        summary: 'Claim a quest',
        description: 'Agent claims an open quest. Sets status to in_progress.',
        operationId: 'claimQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest claimed' },
          409: { description: 'Quest already claimed' },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/claim \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/claim",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
    '/api/quest/{id}/unclaim': {
      post: {
        summary: 'Unclaim a quest',
        description: 'Agent releases a quest back to open status. Only the agent that claimed it can unclaim it.',
        operationId: 'unclaimQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest unclaimed, status reset to open', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, quest: { $ref: '#/components/schemas/Quest' } } }, example: { ok: true, quest: { id: 'quest-1741434000000', status: 'open', claimedBy: null } } } } },
          409: { description: 'Quest not claimed by this agent', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Quest not claimed by this agent' } } } },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/unclaim \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/unclaim",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
    '/api/quest/{id}/complete': {
      post: {
        summary: 'Complete a quest',
        description: 'Marks a quest as completed. Any agent can complete any in-progress quest.',
        operationId: 'completeQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest completed' },
          409: { description: 'Quest already completed' },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/complete \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/complete",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
  },
};

router.get('/api/docs', (req, res) => {
  res.json(API_DOCS);
});

// ─── Web UI Documentation ───────────────────────────────────────────────────────
router.get('/docs', (req, res) => {
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
      const ok = parseInt(code, 10) < 400;
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
    <p>All POST endpoints require an <code>X-API-Key</code> header. GET endpoints are always public. Rate limited to 2000 requests per 15 minutes per IP (429 Too Many Requests when exceeded).</p>
    <pre style="margin-top:0.6rem">X-API-Key: YOUR_API_KEY</pre>
  </div>
  <div class="auth-box" style="background:#0a0c10;border-color:#1e3a5f;margin-bottom:2rem">
    <h3 style="color:#60a5fa">&#127760; Network Access</h3>
    <p>Use the correct address depending on where you are connecting from:</p>
    <table style="margin-top:0.6rem">
      <tr><th>Context</th><th>Address</th></tr>
      <tr><td>Docker containers (same host)</td><td><code>http://172.18.0.3:3001</code></td></tr>
      <tr><td>External (browser, desktop apps)</td><td><code>http://187.77.139.247:3001</code></td></tr>
      <tr><td>Local development</td><td><code>http://localhost:3001</code></td></tr>
    </table>
  </div>
  <h2>Endpoints</h2>
  ${pathsHtml}
  <footer>Agent Dashboard API &middot; <a href="/api/docs">View as JSON</a></footer>
</div>
</body>
</html>`;
}

module.exports = router;
