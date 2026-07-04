# OfficePulse Discord Bot

A Discord bot that reports live office energy/device data by talking to the
OfficePulse backend (Bun API). Responses are humanized with a Llama model
(`llama-3.1-8b-instant` via the Groq API) so answers read like a friendly
teammate, not a data dump — but the bot never invents numbers: every command
either shows verified data from the backend, or clearly says when it's
falling back to a locally-derived estimate because the backend endpoint is
unavailable or unrecognized.

## Meeting the requirements

The three required commands pull real, live data every time — nothing is
hardcoded or randomized — and responses are humanized by an LLM
(`llama-3.1-8b-instant`) so they read naturally instead of as a raw data
dump:

| Command | What it does |
|---|---|
| `!status` | *"Drawing Room: 1 fan ON, 2 lights ON. Work Room 1: all off. Work Room 2: 2 fans ON, 3 lights ON."* |
| `!room <name>` | Status of one specific room, e.g. `!room work1`. |
| `!usage` | *"Total power right now: 740W. Today's estimated usage: 4.2 kWh."* |

Each of these calls the OfficePulse backend fresh on every invocation
(`GET /api/v1/devices`, `GET /api/v1/energy/live`, `GET /api/v1/energy/today`)
and only ever reports whatever the backend/simulator currently says — the
humanize step rewrites the phrasing, not the numbers.

**Bonus proactive alert:** `after_hours_device_watcher` posts unprompted to a
designated channel when a room has devices left on after hours, e.g.:

> ⚠️ Hey! Work Room 2 still has 2 fans and 3 lights ON and it's 10 PM. Did
> someone forget to leave?

See the [Proactive alerts](#proactive-alerts) section below for exactly how
that's triggered.

### Extra commands beyond the requirements

On top of the three required commands, the bot adds several more
data-backed commands as extra features: `!predict`, `!forecast`, `!closing`,
`!rankings`, `!waste`, `!savings`, and `!health`. These
aren't part of the original spec — they're additional ways to query the same
live OfficePulse data (bill forecasting, closing checklists, usage rankings,
after-hours waste, automation savings, and backend health). Full list and endpoints in the [Commands](#commands) table below.

## How it works

```
Discord  <-->  bot.py  <-->  device_data.py  <-->  OfficePulse Bun API
                                                    (https://officepulse.onrender.com)
```

- **`bot.py`** — Discord command handlers (`discord.py`), plus an optional
  LLM step (Groq's `llama-3.1-8b-instant`) that turns raw verified facts into
  a short, friendly sentence. The LLM is only allowed to rephrase — it's
  explicitly instructed not to add commentary, hedge about data sources, or
  invent anything.
- **`device_data.py`** — a thin HTTP client for the OfficePulse API. It
  handles the PIN login flow, retries once on a 401, and normalizes each
  endpoint's response. For a handful of endpoints, if the backend 404s or
  returns an unrecognized shape, it falls back to a value computed from data
  we already know works (mostly the live device list) rather than showing
  nothing.

## Setup

1. Create and activate a virtual environment (do this once, and re-activate
   it every time you open a new terminal to work on the bot — dependencies
   are installed inside the venv, not globally, so skipping this step is
   the most common cause of "discord not installed" / `ModuleNotFoundError`
   errors):
   ```
   python -m venv venv
   venv\Scripts\activate
   ```
   *(macOS/Linux: `source venv/bin/activate`)*

   Your terminal prompt should show `(venv)` at the start once it's active.

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
   (needs at minimum: `discord.py`, `requests`, `python-dotenv`, and `groq`
   if you want humanized responses)

3. Create a `.env` file in the project root:
   ```
   # Discord
   DISCORD_TOKEN=your-discord-bot-token

   # Optional: enables humanized (LLM-rewritten) responses
   GROQ_API_KEY=your-groq-api-key

   # Optional: channel ID for proactive after-hours alerts
   ALERT_CHANNEL_ID=123456789012345678

   # OfficePulse backend
   OFFICEPULSE_API_URL=https://officepulse.onrender.com
   OFFICEPULSE_PIN=123456
   OFFICEPULSE_DEBUG=0
   ```

4. Run the bot (with the venv still active — see step 1):
   ```
   python bot.py
   ```

> **Every new terminal session needs `venv\Scripts\activate` run again**
> before `python bot.py` — activation doesn't persist between terminal
> windows. If you see an error like `ModuleNotFoundError: No module named
> 'discord'`, it almost always means the venv isn't active in that terminal.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token. |
| `GROQ_API_KEY` | No | Enables the humanize step (Groq's `llama-3.1-8b-instant`). Without it, commands send the raw factual summary as-is. |
| `ALERT_CHANNEL_ID` | No | Discord channel ID for proactive after-hours nudges. Without it, that feature is disabled. |
| `OFFICEPULSE_API_URL` | No | Defaults to `https://officepulse.onrender.com`. |
| `OFFICEPULSE_PIN` | No | The platform's 6-digit PIN, if the backend enforces it on read endpoints. |
| `OFFICEPULSE_DEBUG` | No | Set to `1` to log raw API responses — useful when the backend's field names change. |

## Commands

**Required by the spec:**

| Command | Description | Backend endpoint |
|---|---|---|
| `!status` | Summary of all three rooms — fans/lights on. | `GET /api/v1/devices` |
| `!room <name>` | One room's device status (e.g. `!room work1`, `!room drawing`). | `GET /api/v1/devices` (filtered) |
| `!usage` | Current total watts + estimated kWh used today. | `GET /api/v1/energy/live`, `GET /api/v1/energy/today` |

**Extra commands (additional features, not required):**

| Command | Description | Backend endpoint |
|---|---|---|
| `!predict` | Same-day usage forecast from a rolling average of recent watt readings| No backend call required |
| `!forecast` | Month-end bill forecast with confidence. | `GET /api/v1/energy/forecast/bill` |
| `!closing` | What's still on / unresolved before leaving the office. | `GET /api/v1/office/closing-checklist` |
| `!rankings [energy\|runtime\|waste]` | Top rooms/devices by the given metric (defaults to energy). | `GET /api/v1/energy/rankings` |
| `!waste` | After-hours energy/cost waste. | `GET /api/v1/energy/waste/after-hours` |
| `!savings` | Energy/cost saved by automation so far. | `GET /api/v1/energy/savings` |
| `!health` | Backend component health (API, worker, simulator, etc). | `GET /api/v1/system/components` |

Room names accepted by `!room` are fuzzy-matched — `work1`, `workroom1`, and
`work room 1` all resolve to **Work Room 1**. Valid rooms: **Drawing Room**,
**Work Room 1**, **Work Room 2**.

## Proactive alerts

If `ALERT_CHANNEL_ID` is set, two background loops run every 5 minutes:

- **`alert_watcher`** — posts to the channel when the backend's `/api/v1/alerts`
  endpoint reports any active alerts.
- **`after_hours_device_watcher`** — independently checks each room's live
  device list and posts a friendly nudge (e.g. *"Hey! Work Room 2 still has
  2 fans and 3 lights ON and it's 10:00 PM. Did someone forget to leave?"*)
  when devices are left on outside office hours. It only nudges once per
  room per after-hours window — it won't repeat every 5 minutes, and it
  resets once that room's devices are switched off or business hours resume.

## Reliability behavior

Several commands (`!forecast`, `!closing`, `!rankings`, `!waste`, `!health`)
are resilient to backend inconsistency by design:

- Field names are checked against multiple known aliases (the backend has
  been inconsistent about exact key names between updates).
- If a backend route 404s, or returns a shape none of the aliases match,
  the bot falls back to a value it can compute locally (usually from the
  live `/api/v1/devices` list) instead of silently showing nothing.
- Every fallback is labeled — the bot will say when a number came from a
  local estimate rather than the backend, instead of letting the LLM smooth
  it over as if it were authoritative.

Set `OFFICEPULSE_DEBUG=1` and re-run a command to see the raw JSON payload
if you need to update the field-name aliases in `device_data.py` after a
backend change.

## Files

| File | Purpose |
|---|---|
| `bot.py` | Discord bot: command handlers, humanize step, proactive alert loops. |
| `device_data.py` | HTTP client for the OfficePulse backend: auth, per-endpoint parsing, and local fallbacks. |

## Troubleshooting

**`ModuleNotFoundError: No module named 'discord'`**
The virtual environment isn't active in this terminal. Every new terminal
session needs it re-activated before running the bot — activation doesn't
persist between windows:
```
venv\Scripts\activate
```
*(macOS/Linux: `source venv/bin/activate`)*
Your prompt should show `(venv)` at the start once it's active. Then run
`python bot.py` again.

**`Missing DISCORD_TOKEN in .env`**
Your `.env` file is missing, in the wrong folder, or doesn't define
`DISCORD_TOKEN`. It must sit in the same folder as `bot.py` and match the
format shown in [Setup](#setup).

**A command replies with "Couldn't fetch ... right now" or similarly vague**
This means the OfficePulse backend either 404'd or returned an unexpected
response shape for that endpoint — not a bug in the bot's Discord-side logic.
Set `OFFICEPULSE_DEBUG=1` in `.env`, restart, and re-run the command to see
the raw API response in the console logs.

**Bot connects but never responds to commands**
Check that **Message Content Intent** is enabled for your bot in the
Discord Developer Portal (Bot → Privileged Gateway Intents) — prefix
commands like `!status` require it.