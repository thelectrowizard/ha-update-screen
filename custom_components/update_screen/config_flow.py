"""Config flow for Update Screen."""

from __future__ import annotations

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class UpdateScreenConfigFlow(ConfigFlow, domain=DOMAIN):
    """One-click setup."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="Update Screen", data={})
        return self.async_show_form(step_id="user")
