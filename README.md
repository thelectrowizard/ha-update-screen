# Update Screen

A Home Assistant custom integration that shows a full-screen "Updating" notice, while the **Supervisor**, **Core** or **Operating System** is updating.


## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository, category **Integration**.
2. Download **Update Screen** and restart Home Assistant.
3. Settings → Devices & Services → **Add Integration** → **Update Screen**.
4. Hard-refresh your browser.

## Notes

- By default watches `update.home_assistant_core_update`, `update.home_assistant_supervisor_update` and `update.home_assistant_operating_system_update`. Open the integration → **Configure** to choose any `update.*` entities instead, or to **Show demo**.
- The **Enabled** switch on the integration turns the whole screen on or off.
- Core, Supervisor and OS updates restart themselves: at 98% the screen says "Preparing to restart". With several updates running it shows "# Updating".
- Any other selected entity that finishes updating is assumed to need a restart. Once nothing else is updating, the screen shows a red **Restart** button and Continue turns gray.
- **Restart** (on the screen and in the bottom banner "A system restart is required to update") schedules a restart for when you and everyone else have left Home Assistant (15 seconds after the last browser tab disconnects). Click again to cancel. Only admins see the button.
