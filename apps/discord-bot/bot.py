"""
bot.py
------
Discord bot for the office monitoring hackathon project.

Commands:
  !status         -> full office status
  !room <name>    -> status of one room (e.g. !room work1)
  !usage          -> current power draw + estimated kWh today
  !predict        -> same-day forecast using recent rolling watt average
  !forecast       -> authoritative month-end bill forecast (backend model)
  !closing        -> smart closing checklist (what still needs attention)
  !rankings [metric] -> top rooms/devices by energy, runtime, or waste
  !waste          -> after-hours energy and cost waste
  !savings        -> automation-driven energy/cost savings
  !health         -> backend/system component health
  !device <id>    -> details for one device (e.g. !device work2-fan-1)

Uses Groq's LLM API to turn raw data into a friendly sentence.
If GROQ_API_KEY is missing, falls back to a plain (non-AI) formatted
response so the bot still works without AI.
"""

import os
import asyncio
from dotenv import load_dotenv
load_dotenv()  # must run BEFORE device_data is imported, so its env vars (e.g. OFFICEPULSE_PIN) are populated

import discord
from discord.ext import commands, tasks
from datetime import datetime

import device_data as data

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ALERT_CHANNEL_ID = os.getenv("ALERT_CHANNEL_ID")  # optional, for bonus proactive alerts

# --- Groq client setup (optional) ---
groq_client = None
if GROQ_API_KEY:
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY)


def humanize(raw_summary: str) -> str:
    """Ask an LLM to turn raw data into a friendly sentence. Falls back to raw text."""
    if not groq_client:
        return raw_summary
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a friendly office assistant bot. Rewrite the given "
                        "raw device data into a short, warm, conversational reply. "
                        "Keep all numbers and facts exactly accurate. Do not invent "
                        "any data. Max 3 sentences.\n\n"
                        "Strict rules:\n"
                        "- State only what is in the raw data. Do not add commentary "
                        "about the backend, data sources, reliability, or apologize for "
                        "missing data ('I couldn't find...', 'unpredictable today', "
                        "'I'll follow up...', etc.) unless that exact sentiment is "
                        "already in the raw text.\n"
                        "- Do not editorialize or add reassurances that aren't directly "
                        "supported by the numbers given (e.g. don't call a value 'normal' "
                        "or 'higher than usual' unless the raw text says so).\n"
                        "- Never wrap the reply, or any part of it, in quotation marks.\n"
                        "- Output only the reply itself — no preamble, no meta-commentary."
                    ),
                },
                {"role": "user", "content": raw_summary},
            ],
            max_tokens=150,
        )
        reply = completion.choices[0].message.content.strip()
        return reply.strip('"\u201c\u201d\'')
    except Exception as e:
        print(f"[Groq error] falling back to raw text: {e}")
        return raw_summary


intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Tracks which rooms currently have an active after-hours alert, so we
# nudge once per room per after-hours window instead of every 5 minutes.
_alerted_rooms = set()

# Rolling history of (timestamp, watts) samples, used by !predict for a
# steadier estimate than a single instantaneous reading. Capped to the
# last 30 samples (~2.5 hours at the 5-minute sampling interval below).
_watt_samples = []
_MAX_WATT_SAMPLES = 30


def format_room_status(room_name: str, devices: dict) -> str:
    fans_on = sum(1 for d in devices.values() if d["type"] == "fan" and d["status"])
    lights_on = sum(1 for d in devices.values() if d["type"] == "light" and d["status"])
    return f"{room_name}: {fans_on} fan(s) ON, {lights_on} light(s) ON"


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    data.start_simulation()
    watt_sampler.start()
    if ALERT_CHANNEL_ID:
        alert_watcher.start()
        after_hours_device_watcher.start()


@bot.command(name="status")
async def status(ctx):
    all_devices = data.get_all_devices()
    lines = []
    for room in data.ROOMS:
        room_devices = {k: v for k, v in all_devices.items() if v["room"] == room}
        lines.append(format_room_status(room, room_devices))
    raw = " | ".join(lines)
    await ctx.send(humanize(raw))


@bot.command(name="room")
async def room(ctx, *, room_name: str = None):
    if not room_name:
        await ctx.send("Usage: `!room <name>` e.g. `!room work1`, `!room drawing`")
        return

    resolved = data.resolve_room_name(room_name)
    if not resolved:
        await ctx.send(f"I don't recognize '{room_name}'. Try: Drawing Room, Work Room 1, Work Room 2.")
        return

    devices = data.get_room_devices(resolved)
    detail_lines = [f"{d['name']}: {'ON' if d['status'] else 'OFF'}" for d in devices.values()]
    raw = f"{resolved} -> " + ", ".join(detail_lines)
    await ctx.send(humanize(raw))


@bot.command(name="usage")
async def usage(ctx):
    watts = data.get_total_power_watts()
    kwh_today = data.get_estimated_kwh_today()
    raw = f"Total power right now: {watts}W. Estimated usage today: {kwh_today} kWh."
    await ctx.send(humanize(raw))


@tasks.loop(minutes=5)
async def watt_sampler():
    """Keeps a short rolling history of watt readings so !predict can use
    a recent average instead of a single instantaneous snapshot."""
    watts = data.get_total_power_watts()
    _watt_samples.append((datetime.now(), watts))
    del _watt_samples[:-_MAX_WATT_SAMPLES]


@bot.command(name="predict")
async def predict(ctx):
    """
    Same-day energy forecast based on a rolling average of recent power
    draw + kWh used so far.

    Assumption: average draw over the last ~30 samples (or the current
    reading if we don't have history yet) holds roughly steady for the
    rest of business hours (9 AM - 5 PM). This is a simple linear
    projection using only data already collected for !status and !usage.
    For a real backend-modeled forecast, use !forecast instead.
    """
    if _watt_samples:
        avg_watts = sum(w for _, w in _watt_samples) / len(_watt_samples)
        sample_note = f" (avg of last {len(_watt_samples)} reading(s))"
    else:
        avg_watts = data.get_total_power_watts()
        sample_note = " (single reading, no history yet)"

    kwh_so_far = data.get_estimated_kwh_today()

    now = datetime.now()
    business_start, business_end = 9, 17

    if now.hour < business_start:
        hours_remaining = business_end - business_start
    elif now.hour >= business_end:
        hours_remaining = 0
    else:
        hours_remaining = max((business_end - now.hour) - (now.minute / 60), 0)

    if hours_remaining == 0:
        raw = (
            f"Business hours are over for today. Final estimated usage: "
            f"{kwh_so_far:.2f} kWh."
        )
    else:
        projected_additional_kwh = (avg_watts / 1000) * hours_remaining
        projected_total_kwh = kwh_so_far + projected_additional_kwh
        raw = (
            f"Average draw{sample_note}: {avg_watts:.0f}W. Used so far today: "
            f"{kwh_so_far:.2f} kWh. Assuming this average holds for the remaining "
            f"{hours_remaining:.1f} business hour(s), projected total by close: "
            f"{projected_total_kwh:.2f} kWh. (Rough estimate, not a backend forecast — "
            f"try !forecast for that.)"
        )

    await ctx.send(humanize(raw))


@bot.command(name="forecast")
async def forecast(ctx):
    """Authoritative month-end bill forecast from the backend model (GET /api/v1/energy/forecast/bill)."""
    result = data.get_bill_forecast()
    if result.get("source") == "unavailable":
        await ctx.send("⚠️ OfficePulse hasn't got a bill forecast to give right now — try again shortly.")
        return

    parts = []
    if result.get("forecast_kwh") is not None:
        parts.append(f"projected month-end usage {result['forecast_kwh']} kWh")
    if result.get("forecast_cost") is not None:
        parts.append(f"projected cost {result['forecast_cost']}")
    if result.get("confidence") is not None:
        parts.append(f"confidence {result['confidence']}")
    raw = "Bill forecast: " + ", ".join(parts)
    if result.get("assumptions"):
        raw += f". Assumptions: {result['assumptions']}"

    await ctx.send(humanize(raw))


@bot.command(name="closing")
async def closing(ctx):
    """Smart closing checklist — what still needs attention before leaving (GET /api/v1/office/closing-checklist)."""
    result = data.get_closing_checklist()
    devices = result.get("devices") or []
    alerts = result.get("alerts") or []
    shutdowns = result.get("pending_shutdowns") or []

    if not devices and not alerts and not shutdowns:
        raw = "Closing checklist: everything looks clear, nothing outstanding."
    else:
        raw = (
            f"Closing checklist: {len(devices)} device(s) still on, "
            f"{len(alerts)} unresolved alert(s), "
            f"{len(shutdowns)} pending shutdown(s)."
        )
    if result.get("source") == "local-fallback":
        raw += " (Backend checklist endpoint unavailable — computed locally from live device/alert data.)"
    await ctx.send(humanize(raw))


@bot.command(name="rankings")
async def rankings(ctx, metric: str = "energy"):
    """Top rooms/devices by consumption, runtime, or waste. Usage: !rankings [energy|runtime|waste]"""
    metric = metric.lower()
    if metric not in ("energy", "runtime", "waste"):
        await ctx.send("Usage: `!rankings <energy|runtime|waste>` (defaults to energy)")
        return

    result = data.get_usage_rankings(metric)
    items = result.get("items") or []

    if not items:
        if result.get("source") == "unavailable" and metric != "energy":
            await ctx.send(f"⚠️ {metric.title()} rankings aren't available from the backend right now, "
                            f"and there's no local way to compute {metric} rankings — try `!rankings energy` instead.")
        else:
            await ctx.send(f"No {metric} ranking data available right now.")
        return

    top = items[:5]
    lines = [f"{i+1}. {it.get('name', it.get('id', 'unknown'))}: {it.get('value', '?')}" for i, it in enumerate(top)]
    raw = f"Top {metric} rankings: " + "; ".join(lines)
    if result.get("source") == "local-fallback":
        raw += " (Backend rankings endpoint unavailable — ranked from current live device wattage instead.)"
    await ctx.send(humanize(raw))


@bot.command(name="waste")
async def waste(ctx):
    """After-hours energy and cost waste (GET /api/v1/energy/waste/after-hours)."""
    result = data.get_after_hours_waste()

    if result.get("waste_kwh") is not None:
        raw = f"After-hours waste: {result['waste_kwh']} kWh"
        if result.get("waste_cost") is not None:
            raw += f", costing approximately {result['waste_cost']}"
    elif result.get("current_waste_watts") is not None:
        raw = f"Backend after-hours waste data isn't available, but right now (after hours) {result['current_waste_watts']}W is being drawn."
    else:
        raw = result.get("note", "No after-hours waste right now.")
    await ctx.send(humanize(raw))


@bot.command(name="savings")
async def savings(ctx):
    """Automation-driven savings with evidence (GET /api/v1/energy/savings)."""
    result = data.get_savings()
    if result.get("source") == "unavailable":
        await ctx.send("⚠️ Couldn't fetch savings data right now — try again shortly.")
        return

    raw = f"Automation savings: {result.get('kwh_saved')} kWh saved"
    if result.get("cost_saved") is not None:
        raw += f", approximately {result['cost_saved']} saved"
    await ctx.send(humanize(raw))


@bot.command(name="health")
async def health(ctx):
    """Backend/system component health (GET /api/v1/system/components)."""
    result = data.get_system_health()
    components = result.get("components") or []
    if not components:
        await ctx.send("Couldn't fetch system health right now — try again shortly.")
        return

    lines = []
    for c in components:
        name = c.get("name") or c.get("id", "component")
        status = c.get("status") or c.get("health", "unknown")
        lines.append(f"{name}: {status}")
    raw = "System health: " + "; ".join(lines)
    if result.get("source") == "local-fallback":
        raw += f" ({result.get('note')})"
    await ctx.send(humanize(raw))


@bot.command(name="device")
async def device(ctx, *, device_id: str = None):
    """Details for one device by ID, e.g. !device work2-fan-1 (GET /api/v1/devices/{deviceId})."""
    if not device_id:
        await ctx.send("Usage: `!device <device_id>` e.g. `!device work2-fan-1`")
        return

    result = data.get_device_details(device_id.strip())
    if not result:
        await ctx.send(f"Couldn't find device '{device_id}' — check the ID (e.g. `work2-fan-1`).")
        return

    name = result.get("name", device_id)
    status = result.get("status", "unknown")
    watts = result.get("watts") or result.get("powerWatts")
    last_changed = result.get("lastChangedAt") or result.get("last_changed_at") or result.get("last_changed")
    raw = f"{name}: status {status}, {watts}W"
    if last_changed:
        raw += f", last changed {last_changed}"
    if result.get("source") == "local-fallback":
        raw += " (Backend device-detail endpoint unavailable — pulled from the live device list instead, so history/maintenance fields aren't included.)"
    await ctx.send(humanize(raw))


@tasks.loop(minutes=5)
async def alert_watcher():
    """Bonus feature: proactively posts to a channel when devices are left on after hours."""
    alerts = data.get_alerts()
    if not alerts:
        return
    channel = bot.get_channel(int(ALERT_CHANNEL_ID))
    if channel:
        raw = "ALERT: " + "; ".join(alerts)
        await channel.send(humanize(raw))


@alert_watcher.before_loop
async def before_alert_watcher():
    # tasks.loop's first iteration otherwise fires at an unpredictable point
    # relative to bot readiness; wait for the gateway then a short fixed
    # delay so the first check (and demo) happens ~10s after startup.
    await bot.wait_until_ready()
    await asyncio.sleep(10)


@tasks.loop(minutes=5)
async def after_hours_device_watcher():
    """
    Bonus feature: directly checks each room's devices (independent of the
    backend's generic /alerts endpoint) and proactively posts a friendly
    nudge when fans/lights are left ON after hours, e.g.:

        "Hey! Work Room 2 still has 2 fans and 3 lights ON and it's
         10:00 PM. Did someone forget to leave?"

    Only alerts once per room per after-hours window (won't spam every
    5 minutes) — it resets once that room's devices are turned off, or
    once business hours resume.
    """
    if not ALERT_CHANNEL_ID:
        return

    if not data.is_after_hours():
        _alerted_rooms.clear()
        return

    channel = bot.get_channel(int(ALERT_CHANNEL_ID))
    if not channel:
        return

    now_str = datetime.now().strftime("%I:%M %p").lstrip("0")

    for room in data.ROOMS:
        devices = data.get_room_devices(room)
        fans_on = sum(1 for d in devices.values() if d["type"] == "fan" and d["status"])
        lights_on = sum(1 for d in devices.values() if d["type"] == "light" and d["status"])

        if fans_on == 0 and lights_on == 0:
            _alerted_rooms.discard(room)
            continue

        if room in _alerted_rooms:
            continue  # already nudged for this room during this after-hours window

        parts = []
        if fans_on:
            parts.append(f"{fans_on} fan{'s' if fans_on != 1 else ''}")
        if lights_on:
            parts.append(f"{lights_on} light{'s' if lights_on != 1 else ''}")
        devices_str = " and ".join(parts)

        raw = (
            f"Hey! {room} still has {devices_str} ON and it's {now_str}. "
            f"Did someone forget to leave?"
        )
        await channel.send("⚠️ " + humanize(raw))
        _alerted_rooms.add(room)


@after_hours_device_watcher.before_loop
async def before_after_hours_watcher():
    # Same reasoning as before_alert_watcher: guarantees the first after-hours
    # check (and its Discord message, if conditions are met) happens ~10s
    # after the bot comes online rather than depending on loop-start timing.
    await bot.wait_until_ready()
    await asyncio.sleep(10)


if __name__ == "__main__":
    if not DISCORD_TOKEN:
        raise SystemExit("Missing DISCORD_TOKEN in .env — see README.md")
    bot.run(DISCORD_TOKEN)