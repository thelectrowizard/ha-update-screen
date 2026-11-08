"""Show a full-screen notice while Supervisor, Core or the OS is updating."""

from __future__ import annotations

from pathlib import Path
import re

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later

from .const import CONF_ALL, CONF_ENABLED, CONF_ENTITIES, DOMAIN, EVENT_CONFIG_UPDATED, JS_FILE, URL_BASE

PLATFORMS = [Platform.SWITCH]
_REGISTERED = f"{DOMAIN}_registered"


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_config"})
@callback
def ws_get_config(hass: HomeAssistant, connection, msg) -> None:
    """Return the entities the overlay should watch (empty = defaults)."""
    entries = hass.config_entries.async_entries(DOMAIN)
    options = entries[0].options if entries else {}
    connection.send_result(
        msg["id"],
        {
            "entities": options.get(CONF_ENTITIES, []),
            "enabled": options.get(CONF_ENABLED, True),
            "all": options.get(CONF_ALL, False),
        },
    )


# Core, Supervisor and OS restart themselves when an update finishes.
_SELF_RESTARTING = re.compile(
    r"^update\.home_assistant_(core|supervisor|operating_system|os)_update$"
)
RESTART_GRACE = 15  # seconds, so a page reload doesn't trigger the restart
_STATE = f"{DOMAIN}_state"


def _state(hass: HomeAssistant) -> dict:
    return hass.data.setdefault(
        _STATE, {"conns": {}, "pending": False, "cancel": None, "needed": {}}
    )


@callback
def _on_change(hass: HomeAssistant) -> None:
    """Tell open pages the new state; restart once everyone has left."""
    st = _state(hass)
    payload = {
        "pending": st["pending"],
        "sessions": len(st["conns"]),
        "needed": list(st["needed"].values()),
    }
    for send in list(st["conns"].values()):
        send(payload)
    if st["cancel"]:
        st["cancel"]()
        st["cancel"] = None
    if st["pending"] and not st["conns"]:

        @callback
        def _restart(_now) -> None:
            st["cancel"] = None
            if st["pending"] and not st["conns"]:
                hass.async_create_task(
                    hass.services.async_call("homeassistant", "restart")
                )

        st["cancel"] = async_call_later(hass, RESTART_GRACE, _restart)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/presence"})
@callback
def ws_presence(hass: HomeAssistant, connection, msg) -> None:
    """Each open page subscribes; closing the page ends the subscription."""
    st = _state(hass)
    key = (id(connection), msg["id"])
    st["conns"][key] = lambda payload: connection.send_message(
        websocket_api.event_message(msg["id"], payload)
    )

    @callback
    def _unsub() -> None:
        st["conns"].pop(key, None)
        _on_change(hass)

    connection.subscriptions[msg["id"]] = _unsub
    connection.send_result(msg["id"])
    _on_change(hass)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/request_restart", vol.Required("enable"): bool}
)
@callback
def ws_request_restart(hass: HomeAssistant, connection, msg) -> None:
    """Schedule (or cancel) a restart for when no one is connected."""
    _state(hass)["pending"] = msg["enable"]
    _on_change(hass)
    connection.send_result(msg["id"])


def _is_watched(entry: ConfigEntry, entity_id: str) -> bool:
    options = entry.options
    if options.get(CONF_ALL):
        return entity_id.startswith("update.")
    if options.get(CONF_ENTITIES):
        return entity_id in options[CONF_ENTITIES]
    return bool(_SELF_RESTARTING.match(entity_id))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the overlay script and load it in the frontend."""
    if not hass.data.get(_REGISTERED):
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(www), cache_headers=False)]
        )
        websocket_api.async_register_command(hass, ws_get_config)
        websocket_api.async_register_command(hass, ws_presence)
        websocket_api.async_register_command(hass, ws_request_restart)
        hass.data[_REGISTERED] = True
    add_extra_js_url(hass, f"{URL_BASE}/{JS_FILE}")
    registry = er.async_get(hass)
    if old := registry.async_get_entity_id("button", DOMAIN, f"{entry.entry_id}_demo"):
        registry.async_remove(old)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    @callback
    def _state_changed(event: Event) -> None:
        """Remember updates that finished and need a manual restart."""
        entity_id = event.data["entity_id"]
        old, new = event.data.get("old_state"), event.data.get("new_state")
        if not entity_id.startswith("update.") or old is None or new is None:
            return
        if _SELF_RESTARTING.match(entity_id) or not _is_watched(entry, entity_id):
            return
        needed = _state(hass)["needed"]
        if new.attributes.get("in_progress"):
            changed = needed.pop(entity_id, None) is not None
        elif old.attributes.get("in_progress"):
            needed[entity_id] = new.name
            changed = True
        else:
            return
        if changed:
            _on_change(hass)

    entry.async_on_unload(hass.bus.async_listen(EVENT_STATE_CHANGED, _state_changed))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Tell open browsers to reload their settings."""
    hass.bus.async_fire(EVENT_CONFIG_UPDATED)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload; the script stops loading after the next frontend restart."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
