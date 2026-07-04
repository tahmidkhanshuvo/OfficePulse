"""
device_data.py
---------------
Live data layer for the OfficePulse Discord bot.

This USED TO be an in-memory device simulator. It is now a thin client
for the real OfficePulse backend (Bun API) deployed at:

    https://officepulse.onrender.com

Public functions keep the SAME NAMES as before so bot.py barely has to
change:

    start_simulation()        -> now just checks connectivity + logs in
    get_all_devices()         -> GET /api/v1/devices
    get_room_devices(room)    -> filtered from the above
    get_total_power_watts()   -> GET /api/v1/energy/live
    get_estimated_kwh_today() -> GET /api/v1/energy/today
    get_alerts()               -> GET /api/v1/alerts?status=active
    resolve_room_name(text)    -> unchanged fuzzy matching
    ROOMS                      -> unchanged constant

    New (read-only, from full API doc):
    get_bill_forecast()        -> GET /api/v1/energy/forecast/bill
    get_closing_checklist()    -> GET /api/v1/office/closing-checklist
    get_usage_rankings(metric) -> GET /api/v1/energy/rankings
    get_after_hours_waste()    -> GET /api/v1/energy/waste/after-hours
    get_savings()               -> GET /api/v1/energy/savings
    get_system_health()        -> GET /api/v1/system/components
    get_device_details(id)     -> GET /api/v1/devices/{deviceId}

Env vars (add to .env if not already present):
    OFFICEPULSE_API_URL   -> defaults to https://officepulse.onrender.com
    OFFICEPULSE_PIN       -> the 6-digit platform PIN (only needed if the
                              deployed backend actually enforces the PIN
                              gate on read endpoints; if unset, the client
                              just tries unauthenticated first)
    OFFICEPULSE_DEBUG     -> set to "1" to print raw API responses, useful
                              while we confirm exact field names together

All of the "New" functions above now follow the same defensive pattern the
original get_all_devices()/get_total_power_watts() always used: try several
known field-name aliases, and if the backend route 404s or returns a shape
we don't recognize, fall back to something derived from data we already know
works (mainly the live device list). Every dict they return includes a
"source" key ("backend" | "local-fallback" | "unavailable") so bot.py can be
honest with users about where a number came from instead of quietly showing
nothing and letting the LLM paper over it.
"""

import os
import logging
from datetime import datetime

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("officepulse.client")

API_BASE = os.getenv("OFFICEPULSE_API_URL", "https://officepulse.onrender.com").rstrip("/")
PIN = os.getenv("OFFICEPULSE_PIN")
DEBUG_API = os.getenv("OFFICEPULSE_DEBUG", "").strip().lower() in ("1", "true", "yes")

# Render free instances can take 30-50s to wake up from a cold start.
COLD_START_TIMEOUT = 45
NORMAL_TIMEOUT = 15

ROOMS = ["Drawing Room", "Work Room 1", "Work Room 2"]
ROOM_SLUGS = {"Drawing Room": "drawing", "Work Room 1": "work1", "Work Room 2": "work2"}
SLUG_TO_ROOM = {v: k for k, v in ROOM_SLUGS.items()}

_session = requests.Session()
_authenticated = False
_warmed_up = False


def _debug(msg: str):
    if DEBUG_API:
        log.info(msg)


def _url(path: str) -> str:
    return f"{API_BASE}{path}"


# ---------------------------------------------------------------------
# Low-level request helpers
# ---------------------------------------------------------------------

def check_connection() -> bool:
    """Ping /health. Returns True/False and logs the result."""
    global _warmed_up
    try:
        timeout = NORMAL_TIMEOUT if _warmed_up else COLD_START_TIMEOUT
        resp = _session.get(_url("/health"), timeout=timeout)
        _debug(f"GET /health -> {resp.status_code}: {resp.text[:200]}")
        _warmed_up = True
        return resp.ok
    except requests.RequestException as e:
        log.error(f"OfficePulse API unreachable at {API_BASE}: {e}")
        return False


def _login_with_pin() -> bool:
    """Try POST /api/v1/auth/pin/verify to establish a session cookie."""
    global _authenticated
    if not PIN:
        return False
    try:
        resp = _session.post(_url("/api/v1/auth/pin/verify"), json={"pin": PIN}, timeout=NORMAL_TIMEOUT)
        _debug(f"POST /api/v1/auth/pin/verify -> {resp.status_code}: {resp.text[:300]}")
        if resp.ok:
            _authenticated = True
            log.info("Authenticated to OfficePulse API with platform PIN.")
            return True
        log.warning(f"PIN verification failed ({resp.status_code}): {resp.text[:200]}")
    except requests.RequestException as e:
        log.warning(f"PIN verify request failed: {e}")
    return False


def _request(method: str, path: str, **kwargs):
    global _warmed_up
    kwargs.setdefault("timeout", NORMAL_TIMEOUT if _warmed_up else COLD_START_TIMEOUT)
    url = _url(path)
    try:
        resp = _session.request(method, url, **kwargs)
    except requests.RequestException as e:
        log.error(f"OfficePulse API request failed [{method} {path}]: {e}")
        return None
    _warmed_up = True
    _debug(f"{method} {path} -> {resp.status_code}")

    # If unauthenticated, try a PIN login once and retry.
    if resp.status_code == 401 and not _authenticated and PIN:
        if _login_with_pin():
            try:
                resp = _session.request(method, url, **kwargs)
                _debug(f"{method} {path} (retry after login) -> {resp.status_code}")
            except requests.RequestException as e:
                log.error(f"OfficePulse API retry failed [{method} {path}]: {e}")
                return None
    return resp


def _get_json(path: str, params: dict = None):
    resp = _request("GET", path, params=params)
    if resp is None:
        return None
    try:
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        log.error(f"OfficePulse API error on {path}: {e}")
        _debug(f"Response body: {resp.text[:300]}")
        return None
    except ValueError:
        log.error(f"OfficePulse API returned non-JSON for {path}")
        return None


def _data(payload, default=None):
    """Unwrap the standard {"data": ..., "meta": ...} envelope."""
    if not payload:
        return default
    return payload.get("data", default)


def _first_present(d: dict, *keys, default=None):
    """
    Return the first non-None value found under any of `keys`, checking both
    the top level and one level of common nesting (the backend isn't always
    consistent about whether fields sit at the top or under a sub-object).

    This is the same "try every alias we've seen" approach _normalize_device()
    already uses for device fields (e.g. powerWatts/watts/power_watts) — it's
    why !status, !usage, and !room haven't broken even when the backend's
    exact field names shift around.
    """
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    for nested_key in ("summary", "forecast", "result", "totals", "data"):
        nested = d.get(nested_key)
        if isinstance(nested, dict):
            for k in keys:
                if k in nested and nested[k] is not None:
                    return nested[k]
    return default


def start_simulation():
    """
    Legacy name kept so bot.py doesn't need changes. The real backend
    runs its own simulator/hardware feed, so this just verifies
    connectivity and logs in once at startup if a PIN is configured.
    """
    if check_connection():
        log.info(f"Connected to OfficePulse API at {API_BASE}")
    else:
        log.warning(f"Could not reach OfficePulse API at {API_BASE} yet (will retry per-request)")
    if PIN:
        _login_with_pin()


# ---------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------

def _friendly_room(value) -> str:
    if not value:
        return "Unknown"
    if value in SLUG_TO_ROOM:
        return SLUG_TO_ROOM[value]
    for room in ROOMS:
        if str(value).lower() == room.lower():
            return room
    return str(value)


def _normalize_device(raw: dict) -> dict:
    room = raw.get("room") or raw.get("roomName") or raw.get("roomId") or raw.get("room_id")
    status_raw = raw.get("status", raw.get("state"))
    if isinstance(status_raw, str):
        status = status_raw.lower() == "on"
    else:
        status = bool(status_raw)
    watts = (
        raw.get("powerWatts")
        or raw.get("watts")
        or raw.get("power_watts")
        or raw.get("ratedWatts")
        or raw.get("rated_watts")
        or 0
    )
    return {
        "name": raw.get("name") or raw.get("label") or raw.get("id", "device"),
        "type": raw.get("type", "device"),
        "room": _friendly_room(room),
        "status": status,
        "watts": watts,
        "last_changed": raw.get("lastChangedAt") or raw.get("last_changed_at") or raw.get("lastChanged"),
    }


def get_all_devices() -> dict:
    payload = _get_json("/api/v1/devices")
    data = _data(payload, [])
    devices_list = data.get("devices") if isinstance(data, dict) else data
    devices_list = devices_list or []

    result = {}
    for raw in devices_list:
        key = raw.get("id") or raw.get("deviceId") or f"{raw.get('room', '')}-{raw.get('name', '')}"
        result[key] = _normalize_device(raw)

    if not result:
        _debug(f"get_all_devices(): empty or unexpected payload: {payload}")
    return result


def get_room_devices(room_name: str) -> dict:
    all_devices = get_all_devices()
    return {k: v for k, v in all_devices.items() if v["room"].lower() == room_name.lower()}


def resolve_room_name(user_input: str):
    """Lets users type 'work1', 'workroom1', 'drawing', etc."""
    normalized = user_input.lower().replace(" ", "").replace("room", "")
    for room in ROOMS:
        if normalized in room.lower().replace(" ", "").replace("room", ""):
            return room
    return None


# ---------------------------------------------------------------------
# Energy
# ---------------------------------------------------------------------

def get_total_power_watts():
    payload = _get_json("/api/v1/energy/live")
    data = _data(payload, {}) or {}
    if isinstance(data, dict):
        watts = data.get("totalWatts", data.get("watts"))
        if watts is not None:
            return watts
    _debug(f"get_total_power_watts(): unexpected payload: {payload}")
    # Fallback: derive from device list so !usage still works.
    return sum(d["watts"] for d in get_all_devices().values() if d["status"])


def get_estimated_kwh_today():
    payload = _get_json("/api/v1/energy/today")
    data = _data(payload, {}) or {}
    if isinstance(data, dict):
        kwh = data.get("kwh", data.get("energyKwh", data.get("todayKwh")))
        if kwh is not None:
            return round(kwh, 2)
    _debug(f"get_estimated_kwh_today(): unexpected payload: {payload}")
    return 0.0


def get_power_by_room() -> dict:
    payload = _get_json("/api/v1/energy/live")
    data = _data(payload, {}) or {}
    result = {room: 0 for room in ROOMS}
    rooms_data = data.get("rooms") if isinstance(data, dict) else None
    if rooms_data:
        for r in rooms_data:
            room_id = r.get("roomId") or r.get("room")
            friendly = _friendly_room(room_id)
            if friendly in result:
                result[friendly] = r.get("watts", r.get("totalWatts", 0))
    return result


def get_bill_forecast():
    """GET /api/v1/energy/forecast/bill -> month-end bill forecast + confidence."""
    payload = _get_json("/api/v1/energy/forecast/bill")
    data = _data(payload, {}) or {}

    forecast_kwh = _first_present(data, "forecastKwh", "forecast_kwh", "projectedKwh", "monthEndKwh", "kwh")
    forecast_cost = _first_present(data, "forecastCost", "forecast_cost", "projectedCost", "monthEndCost", "estimatedBill", "cost")
    confidence = _first_present(data, "confidence", "confidenceLevel", "confidence_pct", "confidencePct")
    assumptions = _first_present(data, "assumptions", "notes", "basis")

    if forecast_kwh is None and forecast_cost is None and confidence is None:
        _debug(f"get_bill_forecast(): no known fields in payload: {payload}")
        return {"source": "unavailable", "raw": data}

    return {
        "forecast_kwh": forecast_kwh,
        "forecast_cost": forecast_cost,
        "confidence": confidence,
        "assumptions": assumptions,
        "source": "backend",
    }


def get_closing_checklist():
    """GET /api/v1/office/closing-checklist -> outstanding rooms/devices/alerts before leaving."""
    payload = _get_json("/api/v1/office/closing-checklist")
    data = _data(payload, {}) or {}

    outstanding_devices = _first_present(data, "devices", "outstandingDevices", "devicesOn")
    outstanding_alerts = _first_present(data, "alerts", "openAlerts")
    pending_shutdowns = _first_present(data, "pendingShutdowns", "shutdowns")

    if outstanding_devices is None and outstanding_alerts is None and pending_shutdowns is None:
        _debug(f"get_closing_checklist(): no known fields in payload: {payload}, falling back to local device scan")
        # Local fallback: derive "what's still on" straight from the same
        # get_all_devices() ground truth !status/!room already rely on.
        devices_on = [d for d in get_all_devices().values() if d["status"]]
        return {
            "devices": devices_on,
            "alerts": get_alerts(),
            "pending_shutdowns": [],
            "source": "local-fallback",
        }

    return {
        "devices": outstanding_devices or [],
        "alerts": outstanding_alerts or [],
        "pending_shutdowns": pending_shutdowns or [],
        "source": "backend",
    }


def get_usage_rankings(metric: str = "energy"):
    """GET /api/v1/energy/rankings -> top rooms/devices by energy, runtime, or waste."""
    payload = _get_json("/api/v1/energy/rankings", params={"metric": metric})
    data = _data(payload, {}) or {}

    if isinstance(data, list):
        items = data
    else:
        # The API doc's query-param table doesn't document a "metric" filter,
        # so the response may instead nest all three ranking types together
        # (e.g. {"energy": [...], "runtime": [...], "waste": [...]}).
        # Try the metric name itself as a key before the generic aliases.
        items = _first_present(data, metric, "rankings", "items", "results")

    if items:
        return {"items": items, "source": "backend"}

    _debug(f"get_usage_rankings(): no known fields in payload: {payload}, falling back to local device scan")
    if metric != "energy":
        # Runtime/waste rankings aren't derivable from a point-in-time device
        # snapshot, so be honest that only "energy" (current watts) works locally.
        return {"items": [], "source": "unavailable"}

    devices = get_all_devices()
    ranked = sorted(
        (
            {"name": f"{d['room']} - {d['name']}", "value": d["watts"]}
            for d in devices.values() if d["status"]
        ),
        key=lambda x: x["value"], reverse=True,
    )
    return {"items": ranked, "source": "local-fallback"}


def get_after_hours_waste():
    """GET /api/v1/energy/waste/after-hours -> after-hours energy and cost."""
    payload = _get_json("/api/v1/energy/waste/after-hours")
    data = _data(payload, {}) or {}
    waste_kwh = _first_present(data, "wasteKwh", "kwh")
    waste_cost = _first_present(data, "wasteCost", "cost")

    if waste_kwh is not None or waste_cost is not None:
        return {"waste_kwh": waste_kwh, "waste_cost": waste_cost, "source": "backend"}

    _debug(f"get_after_hours_waste(): endpoint unavailable/empty ({payload}), using local estimate")
    if not is_after_hours():
        return {"waste_kwh": 0, "waste_cost": None, "source": "local-fallback",
                "note": "currently within business hours, so no after-hours waste right now"}

    watts_now = get_total_power_watts()
    return {
        "waste_kwh": None,
        "current_waste_watts": watts_now,
        "source": "local-fallback",
        "note": "backend after-hours-waste endpoint is unavailable; this is instantaneous "
                "power draw right now, not accumulated after-hours energy/cost",
    }


def get_savings():
    """GET /api/v1/energy/savings -> automation savings with evidence."""
    payload = _get_json("/api/v1/energy/savings")
    data = _data(payload, {}) or {}
    kwh_saved = _first_present(data, "kwhSaved", "savedKwh")
    cost_saved = _first_present(data, "costSaved", "savedCost")

    if kwh_saved is None and cost_saved is None:
        _debug(f"get_savings(): no known fields in payload: {payload}")
        return {"source": "unavailable"}

    return {"kwh_saved": kwh_saved, "cost_saved": cost_saved, "source": "backend"}


def get_system_health():
    """GET /api/v1/system/components -> health/heartbeat for API, worker, simulator, bot, AI, gateways."""
    payload = _get_json("/api/v1/system/components")
    data = _data(payload, [])
    components = data.get("components") if isinstance(data, dict) else data

    if components:
        return {"components": components, "source": "backend"}

    _debug(f"get_system_health(): no known fields in payload: {payload}, falling back to a basic reachability check")
    return {
        "components": [{"name": "OfficePulse API", "status": "reachable" if check_connection() else "unreachable"}],
        "source": "local-fallback",
        "note": "backend didn't return a component breakdown, so this only reflects basic API reachability",
    }


def get_device_details(device_id: str):
    """GET /api/v1/devices/{deviceId} -> device health, state, power, history, maintenance info."""
    payload = _get_json(f"/api/v1/devices/{device_id}")
    data = _data(payload, {}) or {}
    if data:
        return {**data, "source": "backend"}

    _debug(f"get_device_details({device_id}): unexpected payload: {payload}, falling back to device list")
    # Local fallback: same ground-truth device list !status/!room already use.
    for key, d in get_all_devices().items():
        if key == device_id or d["name"].lower() == device_id.lower():
            return {**d, "source": "local-fallback"}
    return {}


# ---------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------

def get_alerts() -> list:
    payload = _get_json("/api/v1/alerts", params={"status": "active"})
    data = _data(payload, [])
    alerts_list = data.get("alerts") if isinstance(data, dict) else data
    alerts_list = alerts_list or []

    formatted = []
    for a in alerts_list:
        msg = a.get("message") or a.get("description") or a.get("type", "alert")
        room = a.get("room") or a.get("roomId") or ""
        severity = a.get("severity", "warning")
        formatted.append(f"⚠️ [{severity.upper()}] {msg}" + (f" ({room})" if room else ""))

    if not formatted and DEBUG_API and data:
        _debug(f"get_alerts(): parsed 0 alerts from payload: {payload}")
    return formatted


def is_after_hours() -> bool:
    """Local fallback only — the backend's /alerts already encodes this."""
    now = datetime.now()
    return now.hour < 9 or now.hour >= 17