"""Show a full-screen notice while Supervisor, Core or the OS is updating."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, JS_FILE, URL_BASE

_REGISTERED = f"{DOMAIN}_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the overlay script and load it in the frontend."""
    if not hass.data.get(_REGISTERED):
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(www), cache_headers=False)]
        )
        hass.data[_REGISTERED] = True
    add_extra_js_url(hass, f"{URL_BASE}/{JS_FILE}")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload; the script stops loading after the next frontend restart."""
    return True
