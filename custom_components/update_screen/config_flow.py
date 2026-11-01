"""Config and options flow for Update Screen."""

from __future__ import annotations

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector
import voluptuous as vol

from .const import CONF_ENTITIES, DOMAIN, EVENT_DEMO


class UpdateScreenConfigFlow(ConfigFlow, domain=DOMAIN):
    """One-click setup."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return UpdateScreenOptionsFlow()

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="Update Screen", data={})
        return self.async_show_form(step_id="user")


class UpdateScreenOptionsFlow(OptionsFlow):
    """Pick which update entities show the screen, or run a demo."""

    async def async_step_init(self, user_input=None) -> ConfigFlowResult:
        return self.async_show_menu(step_id="init", menu_options=["entities", "demo"])

    async def async_step_entities(self, user_input=None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = self.config_entry.options.get(CONF_ENTITIES, [])
        return self.async_show_form(
            step_id="entities",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_ENTITIES, default=current
                    ): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="update", multiple=True)
                    )
                }
            ),
        )

    async def async_step_demo(self, user_input=None) -> ConfigFlowResult:
        self.hass.bus.async_fire(EVENT_DEMO)
        return self.async_abort(reason="demo_started")
