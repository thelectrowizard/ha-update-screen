/* Update Screen: full-screen notice while Supervisor, Core or OS is updating. */
(() => {
  if (window.__updateScreenLoaded) return;
  window.__updateScreenLoaded = true;

  const DEFAULTS = [
    /^update\.home_assistant_core_update$/,
    /^update\.home_assistant_supervisor_update$/,
    /^update\.home_assistant_(operating_system|os)_update$/,
  ];

  const DEMO_MS = 15000;
  let overlay = null;
  let dismissed = false;
  let selected = [];
  let demoUntil = 0;
  let initialised = false;

  const getStates = () => {
    const ha = document.querySelector("home-assistant");
    return ha && ha.hass ? ha.hass.states : null;
  };

  const activeUpdates = (states) => {
    const out = [];
    for (const [id, st] of Object.entries(states)) {
      const watched = selected.length
        ? selected.includes(id)
        : DEFAULTS.some((re) => re.test(id));
      if (!watched) continue;
      const a = st.attributes || {};
      if (!a.in_progress) continue;
      const pct = typeof a.in_progress === "number" ? a.in_progress : a.update_percentage;
      out.push({ name: a.friendly_name || id, pct: typeof pct === "number" ? pct : null });
    }
    return out;
  };

  const demoUpdates = () => {
    const left = demoUntil - Date.now();
    return left > 0
      ? [{ name: "Demo", pct: Math.min(100, ((DEMO_MS - left) / DEMO_MS) * 100) }]
      : [];
  };

  const init = async (ha) => {
    initialised = true;
    const load = async () => {
      try {
        selected = (await ha.hass.callWS({ type: "update_screen/get_config" })).entities || [];
      } catch (e) { /* keep previous settings */ }
    };
    await load();
    ha.hass.connection.subscribeEvents(load, "update_screen_config_updated");
    ha.hass.connection.subscribeEvents(() => {
      dismissed = false;
      demoUntil = Date.now() + DEMO_MS;
    }, "update_screen_demo");
  };

  const build = () => {
    const el = document.createElement("div");
    el.id = "update-screen-overlay";
    el.innerHTML = `
      <style>
        #update-screen-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;
          align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
          opacity:0;transition:opacity .4s ease;
          background:var(--primary-background-color);color:var(--primary-text-color);
          font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,sans-serif));
          text-align:center}
        #update-screen-overlay{pointer-events:none}
        #update-screen-overlay.visible{opacity:1;pointer-events:auto}
        #update-screen-overlay .box{max-width:480px;width:100%;box-sizing:border-box}
        #update-screen-overlay h1{margin:0 0 4px;font-size:var(--ha-font-size-3xl,28px);
          font-weight:var(--ha-font-weight-medium,500);color:var(--primary-text-color)}
        #update-screen-overlay .what{margin:0 0 24px;color:var(--secondary-text-color)}
        #update-screen-overlay .bar{height:8px;border-radius:4px;overflow:hidden;position:relative;
          background:var(--divider-color)}
        #update-screen-overlay .fill{height:100%;background:var(--primary-color);border-radius:4px;
          transition:width .4s ease}
        #update-screen-overlay .fill.indeterminate{position:absolute;width:35%;
          animation:us-slide 1.4s ease-in-out infinite}
        @keyframes us-slide{0%{left:-35%}100%{left:100%}}
        #update-screen-overlay p.msg{margin:24px 0 28px;line-height:1.5;
          color:var(--secondary-text-color)}
      </style>
      <div class="box">
        <h1>Updating</h1>
        <div class="what"></div>
        <div class="bar"><div class="fill indeterminate"></div></div>
        <p class="msg">The system is updating, and some UI elements may be slow while updating.</p>
        <ha-button variant="danger">Continue</ha-button>
      </div>`;
    el.querySelector("ha-button").addEventListener("click", () => {
      dismissed = true;
      hide();
    });
    return el;
  };

  const hide = () => {
    if (!overlay) return;
    const el = overlay;
    overlay = null;
    el.classList.remove("visible");
    setTimeout(() => el.remove(), 450);
  };

  const render = (updates) => {
    if (!updates.length || dismissed) {
      hide();
      return;
    }
    if (!overlay) {
      overlay = build();
      document.body.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() =>
        overlay && overlay.classList.add("visible")));
    }
    overlay.querySelector(".what").textContent =
      updates.map((u) => u.name).join(" & ");
    const fill = overlay.querySelector(".fill");
    const pcts = updates.map((u) => u.pct).filter((p) => p !== null);
    if (pcts.length) {
      fill.classList.remove("indeterminate");
      fill.style.width = Math.max(...pcts) + "%";
    } else {
      fill.classList.add("indeterminate");
      fill.style.width = "";
    }
  };

  setInterval(() => {
    const ha = document.querySelector("home-assistant");
    if (!ha || !ha.hass) return;
    if (!initialised) init(ha);
    const updates = activeUpdates(ha.hass.states).concat(demoUpdates());
    if (!updates.length) dismissed = false;
    render(updates);
  }, 1000);
})();
