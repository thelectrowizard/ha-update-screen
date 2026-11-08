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
  let all = false;
  let pendingRestart = false;
  let serverNeeded = [];
  let banner = null;
  let prev = new Set();
  const lastSeen = new Map();
  const needRestart = new Map();
  let demoUntil = 0;
  let initialised = false;

  const isWatched = (id) =>
    all ? id.startsWith("update.") : selected.length ? selected.includes(id) : DEFAULTS.some((re) => re.test(id));

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
        all = !!cfg.all;
      } catch (e) { /* keep previous settings */ }
    };
    ha.hass.connection.subscribeEvents(() => {
      dismissed = false;
      demoUntil = Date.now() + DEMO_MS;
    }, "update_screen_demo");
    ha.hass.connection.subscribeEvents(load, "update_screen_config_updated");
    ha.hass.connection.subscribeMessage((ev) => {
      pendingRestart = !!ev.pending;
      serverNeeded = ev.needed || [];
      setRestartLabels();
    }, { type: "update_screen/presence" }).catch(() => {});
    await load();
  };

  // The settings dialog sits in the browser's top layer, so z-index alone
  // can't get above it; a manual popover shown later can.
  const toTopLayer = (el) => {
    try {
      el.setAttribute("popover", "manual");
      el.showPopover();
    } catch (e) { /* older browsers: fixed positioning only */ }
  };

  const canRestart = () => {
    const ha = document.querySelector("home-assistant");
    return !!(ha && ha.hass && ha.hass.user && ha.hass.user.is_admin);
  };

  const setRestartLabels = () => {
    document.querySelectorAll("#update-screen-overlay .restart, #update-screen-banner .restart")
      .forEach((b) => { b.textContent = pendingRestart ? "Cancel restart" : "Restart"; });
    const msg = document.querySelector("#update-screen-overlay .msg.restartable-msg");
    if (msg) msg.textContent = restartMessage();
  };

  const restartMessage = () => pendingRestart
    ? "Restart scheduled. Home Assistant will restart once everyone has left."
    : "Restart Home Assistant to finish applying the update.";

  // Restarts once no one is connected, so other people's sessions aren't cut off.
  const requestRestart = () => {
    const ha = document.querySelector("home-assistant");
    ha.hass.callWS({ type: "update_screen/request_restart", enable: !pendingRestart });
  };

  const buildBanner = () => {
    const el = document.createElement("div");
    el.id = "update-screen-banner";
    el.innerHTML = `
      <style>
        #update-screen-banner{position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;height:auto;margin:0;border:0;z-index:2147482000;
          display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;
          padding:12px 16px;box-sizing:border-box;opacity:0;pointer-events:none;
          transition:opacity .4s ease;background:var(--card-background-color);
          color:var(--primary-text-color);border-top:1px solid var(--divider-color);
          font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,sans-serif))}
        #update-screen-banner.visible{opacity:1;pointer-events:auto}
      </style>
      <span>A system restart is required to update</span>
      <ha-button class="restart" variant="danger">Restart</ha-button>`;
    el.querySelector(".restart").addEventListener("click", requestRestart);
    return el;
  };

  const syncBanner = () => {
    const show = enabled && !overlay && (needRestart.size > 0 || serverNeeded.length > 0);
    if (show && !banner) {
      banner = buildBanner();
      document.body.appendChild(banner);
      toTopLayer(banner);
      setRestartLabels();
      requestAnimationFrame(() => requestAnimationFrame(() =>
        banner && banner.classList.add("visible")));
    }
    if (banner) {
      banner.querySelector(".restart").style.display = canRestart() ? "" : "none";
      if (!show) {
        const el = banner;
        banner = null;
        el.classList.remove("visible");
        setTimeout(() => el.remove(), 450);
      }
    }
  };

  const build = () => {
    const el = document.createElement("div");
    el.id = "update-screen-overlay";
    el.innerHTML = `
      <style>
        #update-screen-overlay{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;overflow:visible;z-index:2147483000;display:flex;
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
        #update-screen-overlay .continue-wrap{position:relative;display:inline-block}
        #update-screen-overlay .continue{transition:opacity .4s ease}
        #update-screen-overlay .continue.neutral{position:absolute;inset:0;opacity:0;pointer-events:none}
        #update-screen-overlay .restartable .continue.danger{opacity:0;pointer-events:none}
        #update-screen-overlay .restartable .continue.neutral{opacity:1;pointer-events:auto}
        #update-screen-overlay .restart-row{margin-top:12px;opacity:0;pointer-events:none;
          transition:opacity .4s ease}
        #update-screen-overlay .restart-row.show{opacity:1;pointer-events:auto}
      </style>
      <div class="box">
        <h1>Updating</h1>
        <div class="what"></div>
        <div class="bar"><div class="fill indeterminate"></div></div>
        <p class="msg">The system is updating, and some UI elements may be slow or unusable.</p>
        <div class="continue-wrap">
          <ha-button class="continue danger" variant="danger">Continue</ha-button>
          <ha-button class="continue neutral" variant="neutral">Continue</ha-button>
        </div>
        <div class="restart-row"><ha-button class="restart" variant="danger">Restart</ha-button></div>
      </div>`;
    el.querySelectorAll(".continue").forEach((b) => b.addEventListener("click", () => {
      dismissed = true;
      hide();
    }));
    el.querySelector(".restart").addEventListener("click", requestRestart);
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
      toTopLayer(overlay);
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
    const msgEl = overlay.querySelector(".msg");
    msgEl.classList.toggle("restartable-msg", restartable);
    msgEl.textContent = restartable
      ? restartMessage()
      : "The system is updating, and some UI elements may be slow or unusable.";
    setRestartLabels();
    overlay.querySelector(".box").classList.toggle("restartable", restartable);
    overlay.querySelector(".restart-row").classList.toggle("show", restartable && canRestart());
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
    syncBanner();
  }, 1000);
})();
