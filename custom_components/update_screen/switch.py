"""On/off switch for Update Screen."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_ENABLED, DOMAIN


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([UpdateScreenSwitch(entry)])


class UpdateScreenSwitch(SwitchEntity):
    """Turns the whole integration on or off."""

    _attr_has_entity_name = True
    _attr_name = "Enabled"
    _attr_icon = "mdi:update"

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_enabled"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)}, name="Update Screen"
        )

    @property
    def is_on(self) -> bool:
        return self._entry.options.get(CONF_ENABLED, True)

    async def _async_set(self, value: bool) -> None:
        self.hass.config_entries.async_update_entry(
            self._entry, options={**self._entry.options, CONF_ENABLED: value}
        )
        self.async_write_ha_state()

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)
