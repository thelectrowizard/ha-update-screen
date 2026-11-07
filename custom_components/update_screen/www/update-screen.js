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
  let enabled = true;
  let prev = new Set();
  const lastSeen = new Map();
  const needRestart = new Map();
  let demoUntil = 0;
  let initialised = false;

  const isWatched = (id) =>
    selected.length ? selected.includes(id) : DEFAULTS.some((re) => re.test(id));

  // Core, Supervisor and OS restart themselves when an update finishes.
  const restartsItself = (id) => DEFAULTS.some((re) => re.test(id));

  const activeUpdates = (states) => {
    const out = [];
    for (const [id, st] of Object.entries(states)) {
      if (!isWatched(id)) continue;
      const a = st.attributes || {};
      if (!a.in_progress) continue;
      const pct = typeof a.in_progress === "number" ? a.in_progress : a.update_percentage;
      out.push({
        id,
        name: a.friendly_name || id,
        pct: typeof pct === "number" ? pct : null,
        auto: restartsItself(id),
      });
    }
    return out;
  };

  const demoUpdates = () => {
    const left = demoUntil - Date.now();
    return left > 0
      ? [{ id: "demo", name: "Demo", auto: true, pct: Math.min(100, ((DEMO_MS - left) / DEMO_MS) * 100) }]
      : [];
  };

  const init = async (ha) => {
    initialised = true;
    const load = async () => {
      try {
        const cfg = await ha.hass.callWS({ type: "update_screen/get_config" });
        selected = cfg.entities || [];
        enabled = cfg.enabled !== false;
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
        #update-screen-overlay .restart-row{margin-top:12px;visibility:hidden}
        #update-screen-overlay .restart-row.show{visibility:visible}
      </style>
      <div class="box">
        <h1>Updating</h1>
        <div class="what"></div>
        <div class="bar"><div class="fill indeterminate"></div></div>
        <p class="msg">The system is updating, and some UI elements may be slow or unusable.</p>
        <ha-button class="continue" variant="danger">Continue</ha-button>
        <div class="restart-row"><ha-button class="restart" variant="danger">Restart</ha-button></div>
      </div>`;
    el.querySelector(".continue").addEventListener("click", () => {
      dismissed = true;
      hide();
    });
    const restart = el.querySelector(".restart");
    restart.addEventListener("click", () => {
      restart.disabled = true;
      restart.textContent = "Restarting…";
      const ha = document.querySelector("home-assistant");
      ha.hass.callService("homeassistant", "restart");
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
    const restartable = !updates.length && needRestart.size > 0;
    if ((!updates.length && !restartable) || dismissed) {
      hide();
      return;
    }
    if (!overlay) {
      overlay = build();
      document.body.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() =>
        overlay && overlay.classList.add("visible")));
    }
    let title = "Updating";
    let names;
    let pct = null;
    if (restartable) {
      title = "Restart required";
      names = [...needRestart.values()];
      pct = 100;
    } else {
      names = updates.map((u) => u.name);
      const pcts = updates.map((u) => u.pct).filter((p) => p !== null);
      if (pcts.length) pct = Math.max(...pcts);
      if (updates.length > 1) title = `${updates.length} Updating`;
      else if (updates[0].auto && pct !== null && pct >= 98) title = "Preparing to restart";
    }
    overlay.querySelector("h1").textContent = title;
    overlay.querySelector(".what").textContent = names.join(" & ");
    overlay.querySelector(".msg").textContent = restartable
      ? "Restart Home Assistant to finish applying the update."
      : "The system is updating, and some UI elements may be slow or unusable.";
    overlay.querySelector(".continue").setAttribute("variant", restartable ? "neutral" : "danger");
    overlay.querySelector(".restart-row").classList.toggle("show", restartable);
    const fill = overlay.querySelector(".fill");
    if (pct !== null) {
      fill.classList.remove("indeterminate");
      fill.style.width = pct + "%";
    } else {
      fill.classList.add("indeterminate");
      fill.style.width = "";
    }
  };

  setInterval(() => {
    const ha = document.querySelector("home-assistant");
    if (!ha || !ha.hass) return;
    if (!initialised) init(ha);
    const real = enabled ? activeUpdates(ha.hass.states) : [];
    const now = new Set(real.map((u) => u.id));
    for (const u of real) {
      lastSeen.set(u.id, u);
      needRestart.delete(u.id);
    }
    for (const id of prev) {
      const u = lastSeen.get(id);
      if (!now.has(id) && u && !u.auto && isWatched(id)) {
        needRestart.set(id, u.name);
        dismissed = false;
      }
    }
    prev = now;
    if (!enabled) needRestart.clear();
    const updates = real.concat(demoUpdates());
    if (!updates.length && !needRestart.size) dismissed = false;
    render(updates);
  }, 1000);
})();
