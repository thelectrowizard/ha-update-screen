"""Show a full-screen notice while Supervisor, Core or the OS is updating."""

from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback

from .const import CONF_ENTITIES, DOMAIN, EVENT_CONFIG_UPDATED, JS_FILE, URL_BASE

PLATFORMS = [Platform.BUTTON]
_REGISTERED = f"{DOMAIN}_registered"


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_config"})
@callback
def ws_get_config(hass: HomeAssistant, connection, msg) -> None:
    """Return the entities the overlay should watch (empty = defaults)."""
    entries = hass.config_entries.async_entries(DOMAIN)
    entities = entries[0].options.get(CONF_ENTITIES, []) if entries else []
    connection.send_result(msg["id"], {"entities": entities})


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the overlay script and load it in the frontend."""
    if not hass.data.get(_REGISTERED):
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(www), cache_headers=False)]
        )
        websocket_api.async_register_command(hass, ws_get_config)
        hass.data[_REGISTERED] = True
    add_extra_js_url(hass, f"{URL_BASE}/{JS_FILE}")
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Tell open browsers to reload their settings."""
    hass.bus.async_fire(EVENT_CONFIG_UPDATED)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload; the script stops loading after the next frontend restart."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
