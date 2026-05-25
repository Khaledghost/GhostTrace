# BehavioralDNA SOC Platform

**Open-source behavioral detection & response (BDR) for SOC and MDR teams.**

BehavioralDNA combines real-time behavioral profiling, MITRE ATT&CK mapping, AI-assisted triage, and incident workflows in a single platform you can deploy in front of any application or use as a standalone detection console.

## Why teams use it

- **Alert queue with persistence** — PostgreSQL-backed alerts, not ephemeral memory
- **Incident management** — Escalate, investigate, contain, resolve with audit trail
- **MITRE ATT&CK coverage** — Automatic tactic/technique mapping from detections
- **Threat hunting** — Query alerts by IP, technique, severity, free text
- **Behavioral DNA** — Per-entity fingerprints with Z-score anomaly detection
- **Drop-in protection** — Express middleware blocks SQLi, XSS, brute force, velocity spikes
- **Multi-provider AI** — OpenAI, Claude, Gemini, Grok, Ollama, or any OpenAI-compatible API
- **Live AI on logs** — Auto-analyze suspicious requests in real time (SSE)
- **AI triage** — Alerts, incidents, and sandbox with fallback chain across providers
- **External data sources** — Monitor Postgres, MySQL, MongoDB, Redis tables
- **Integrations** — Webhook ingest for SIEM/SOAR pipelines

## Quick start (Docker)

```bash
cp .env.example .env
# Set DB_PASS, ADMIN_PASS, JWT_SECRET

docker compose up -d --build
```

Open **http://localhost:3001** — login with `ADMIN_USER` / `ADMIN_PASS`.

If Postgres password errors occur after changing `.env`:

```bash
docker compose down -v && docker compose up -d --build
```

## Quick start (local)

```bash
npm install
# PostgreSQL required — set DB_* in .env
npm start
```

## SOC console

| Section | Purpose |
|---------|---------|
| Command Center | KPIs, MITRE summary, live alert stream |
| Alert Queue | Triage, acknowledge, resolve alerts |
| Incidents | Case management with timeline |
| Threat Hunt | Search + IOC summary |
| MITRE ATT&CK | Tactic coverage heatmap |
| Behavioral Profiles | Entity risk & telemetry |
| AI Triage | Sandbox malicious requests |
| Policies | Block thresholds (database-backed) |
| Integrations | Webhook registration & ingest API |
| Audit Trail | Analyst actions log |

## API overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/soc/command-center` | Dashboard aggregates |
| `GET /api/alerts` | Alert queue (filterable) |
| `PATCH /api/alerts/:id` | Update alert status |
| `GET /api/incidents` | Incidents list |
| `POST /api/incidents` | Create incident |
| `POST /api/hunt/query` | Threat hunt search |
| `POST /api/integrations/ingest` | External alert ingest |
| `POST /api/threats/analyze` | Manual analysis |
| `GET /api/threats/feed` | SSE live stats |

## Protection middleware

```javascript
const createProtectionMiddleware = require('./middleware/protection');
app.use(createProtectionMiddleware({
  blockOnThreat: true,
  riskBlockThreshold: 70,
}));
```

## AI configuration

**Option A — Web UI:** Open **AI Engine** in the sidebar, add a provider, paste your API key, click **Test Connection**.

**Option B — Environment variables** (auto-seeded on first boot):

| Provider | Env vars |
|----------|----------|
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Grok | `GROK_API_KEY`, `GROK_MODEL` |
| Ollama | `OLLAMA_ENABLED=true`, `OLLAMA_URL`, `OLLAMA_MODEL` |
| Custom | `CUSTOM_AI_API_KEY`, `CUSTOM_AI_BASE_URL`, `CUSTOM_AI_MODEL` |

Multiple providers can be configured with **priority fallback** — if one fails, the next is tried.

### Live log analysis

Enable **Auto-analyze suspicious logs** in AI Engine. The Request Logs page streams new entries via SSE and shows AI risk, MITRE techniques, and remediation steps.

## Environment

See [.env.example](.env.example). Key variables:

- `AI_LIVE_LOGS=true` — Real-time AI on HTTP logs
- `BLOCK_RISK_THRESHOLD` — Auto-block score (default 70)
- `DB_SYNC=true` — Auto-create tables on first run
- `AUTO_ESCALATE_CRITICAL` — Auto-create incidents for critical alerts

## License

MIT — Built for defenders. Contributions welcome.
