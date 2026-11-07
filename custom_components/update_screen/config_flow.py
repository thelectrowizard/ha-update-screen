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

from .const import CONF_ALL, CONF_ENTITIES, DOMAIN, EVENT_DEMO


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
        """Select-all checkbox; unticked continues to the entity list."""
        if user_input is not None:
            if user_input[CONF_ALL]:
                return self.async_create_entry(
                    data={**self.config_entry.options, CONF_ALL: True, CONF_ENTITIES: []}
                )
            return await self.async_step_pick()
        return self.async_show_form(
            step_id="entities",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_ALL, default=self.config_entry.options.get(CONF_ALL, False)
                    ): selector.BooleanSelector()
                }
            ),
        )

    async def async_step_pick(self, user_input=None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(
                data={**self.config_entry.options, CONF_ALL: False, **user_input}
            )
        current = self.config_entry.options.get(CONF_ENTITIES, [])
        names = {
            state.entity_id: state.name for state in self.hass.states.async_all("update")
        }
        for entity_id in current:
            names.setdefault(entity_id, entity_id)
        options = [
            selector.SelectOptionDict(value=entity_id, label=f"{name} ({entity_id})")
            for entity_id, name in sorted(names.items(), key=lambda item: item[1].lower())
        ]
        return self.async_show_form(
            step_id="pick",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_ENTITIES, default=current): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=options,
                            multiple=True,
                            mode=selector.SelectSelectorMode.LIST,
                        )
                    )
                }
            ),
        )

    async def async_step_demo(self, user_input=None) -> ConfigFlowResult:
        self.hass.bus.async_fire(EVENT_DEMO)
        return self.async_abort(reason="demo_started")
