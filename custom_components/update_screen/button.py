"""Demo button for Update Screen."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, EVENT_DEMO


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([UpdateScreenDemoButton(entry)])


class UpdateScreenDemoButton(ButtonEntity):
    """Shows the update screen once, for previewing."""

    _attr_has_entity_name = True
    _attr_name = "Demo"
    _attr_icon = "mdi:play"

    def __init__(self, entry: ConfigEntry) -> None:
        self._attr_unique_id = f"{entry.entry_id}_demo"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)}, name="Update Screen"
        )

    async def async_press(self) -> None:
        self.hass.bus.async_fire(EVENT_DEMO)
