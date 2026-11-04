# Update Screen

A Home Assistant custom integration that shows a full-screen "Updating" notice, while the **Supervisor**, **Core** or **Operating System** is updating.


## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository, category **Integration**.
2. Download **Update Screen** and restart Home Assistant.
3. Settings → Devices & Services → **Add Integration** → **Update Screen**.
4. Hard-refresh your browser.

## Notes

- By default watches `update.home_assistant_core_update`, `update.home_assistant_supervisor_update` and `update.home_assistant_operating_system_update`. Open the integration → **Configure** to choose any `update.*` entities instead, or to **Show demo**. A **Demo** button entity is also added to the integration for previewing.
- Core and OS updates restart Home Assistant, so the screen is only visible before the restart.
