/* ============================================================
   HEXON BETA — Admin panel (dev-only cheats / overrides).

   Activation: type "@admin" as the nickname on the login screen.
   Once enabled the flag is persisted (state.admin.enabled = true)
   and the "Admin" tile appears in the main menu. Everything here
   bypasses normal economy and progression rules — keep this file
   isolated so the rest of the game doesn't have to know about it.
   ============================================================ */
"use strict";

/* Toggle the menu tile visibility. Called from ui.go("menu") and
   on init() once the persisted state is restored. Putting the
   visibility behind a function avoids leaking the tile's id all
   over the rest of the codebase. */
function applyAdminVisibility(){
  const tile = document.getElementById("menu-tile-admin");
  if(!tile) return;
  const on = !!(state.admin && state.admin.enabled);
  tile.style.display = on ? "" : "none";
}

/* Disable admin entirely — drops the flag, hides the tile, kills
   the noGameOver cheat. Exposed mainly for the "lock admin" button
   inside the admin panel itself. */
function disableAdmin(){
  state.admin = state.admin || {};
  state.admin.enabled = false;
  state.admin.noGameOver = false;
  saveState();
  applyAdminVisibility();
  toast(typeof t === "function" ? t("admin.toast.locked") : "Admin mode locked", "info");
  if(typeof go === "function") go("menu");
}

function _adminAndroidPathHint(){
  /* Best-effort path label so the user knows where to look on the
     device after install. The real path is decided by HexonStorage
     at runtime depending on the API level. */
  const bridge = (typeof window !== "undefined") && window.AndroidHexon;
  if(!bridge) return "(WebView only — Android bridge not attached)";
  return "/sdcard/Documents/HexonBeta/device_id.txt";
}

/* Build the admin panel. Re-runs every time the screen is opened
   so each section reflects the current state without needing
   diffing logic. */
function renderAdmin(){
  const root = document.getElementById("admin-body");
  if(!root) return;
  state.admin = state.admin || { enabled: false, noGameOver: false };

  const ownedAll = (state.shop.ownedSkins || []).length >= (typeof SKINS !== "undefined" ? SKINS.length : 0);
  const noGO = !!state.admin.noGameOver;

  /* All admin sections in one go. Inline styles are used liberally
     so we don't need a new stylesheet just for dev controls. */
  root.innerHTML = ""
    + '<div class="admin-grid" style="display:grid;gap:12px;padding:8px 4px 24px">'

    /* --- HEX wallet ----------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-hex"/></svg> Add HEX'
    +   '</h3>'
    +   '<p style="margin:0 0 10px;color:var(--fg-dim);font-size:13px">Current balance: <b class="mono" id="adm-hex-now">'+(state.wallet.hex||0).toLocaleString()+'</b> HEX</p>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +     '<input id="adm-hex-input" type="number" min="-1000000" max="1000000" value="1000" '
    +       'style="flex:1;min-width:120px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);'
    +       'background:var(--bg-2);color:var(--fg);font:600 14px/1 \'JetBrains Mono\',monospace">'
    +     '<button class="btn btn-primary" id="adm-hex-add"><svg class="ic-svg"><use href="#i-check"/></svg><span>Add</span></button>'
    +     '<button class="btn" id="adm-hex-set-zero"><span>Zero</span></button>'
    +     '<button class="btn" id="adm-hex-add-10k"><span>+10k</span></button>'
    +     '<button class="btn" id="adm-hex-add-100k"><span>+100k</span></button>'
    +   '</div>'
    + '</section>'

    /* --- Skins ---------------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-shop"/></svg> Skins'
    +   '</h3>'
    +   '<p style="margin:0 0 10px;color:var(--fg-dim);font-size:13px">Owned: <b>'+(state.shop.ownedSkins||[]).length+' / '+(typeof SKINS !== "undefined" ? SKINS.length : "?")+'</b>'+(ownedAll? ' (all unlocked)':'')+'</p>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +     '<button class="btn btn-primary" id="adm-skins-all"><span>Unlock ALL skins</span></button>'
    +     '<button class="btn" id="adm-skins-reset"><span>Reset to default only</span></button>'
    +   '</div>'
    + '</section>'

    /* --- Nickname ------------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-profile"/></svg> Nickname'
    +   '</h3>'
    +   '<p style="margin:0 0 10px;color:var(--fg-dim);font-size:13px">Current: <b id="adm-nick-now">'+(state.profile.nickname || '(empty)')+'</b></p>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +     '<input id="adm-nick-input" type="text" maxlength="20" placeholder="new nickname" '
    +       'style="flex:1;min-width:160px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);'
    +       'background:var(--bg-2);color:var(--fg);font:600 14px/1 \'Manrope\',sans-serif">'
    +     '<button class="btn btn-primary" id="adm-nick-set"><svg class="ic-svg"><use href="#i-check"/></svg><span>Set</span></button>'
    +   '</div>'
    +   '<p style="margin:6px 0 0;color:var(--fg-dim);font-size:11px">Admin overrides bypass the uniqueness check.</p>'
    + '</section>'

    /* --- Device ID ------------------------------------------ */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-grid"/></svg> Device ID'
    +   '</h3>'
    +   '<p style="margin:0 0 10px;color:var(--fg-dim);font-size:13px">Current: <code class="mono" id="adm-id-now" style="background:var(--bg-2);padding:2px 6px;border-radius:6px">'+(state.profile.id || '(none)')+'</code></p>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +     '<input id="adm-id-input" type="text" placeholder="HX-XXXXX-XXXXX" '
    +       'style="flex:1;min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);'
    +       'background:var(--bg-2);color:var(--fg);font:600 13px/1 \'JetBrains Mono\',monospace;text-transform:uppercase">'
    +     '<button class="btn btn-primary" id="adm-id-set"><svg class="ic-svg"><use href="#i-check"/></svg><span>Set</span></button>'
    +     '<button class="btn" id="adm-id-regen"><svg class="ic-svg"><use href="#i-reset"/></svg><span>Regenerate</span></button>'
    +   '</div>'
    +   '<p style="margin:6px 0 0;color:var(--fg-dim);font-size:11px">Format: HX-XXXXX-XXXXX (A–Z, 0–9). Mirrored to <span class="mono">'+_adminAndroidPathHint()+'</span> on Android.</p>'
    + '</section>'

    /* --- Game over toggle ----------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-bolt"/></svg> Modes'
    +   '</h3>'
    +   '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">'
    +     '<input type="checkbox" id="adm-no-gameover"'+(noGO?' checked':'')+' style="width:18px;height:18px">'
    +     '<span>No Game Over (immortal run)</span>'
    +   '</label>'
    +   '<p style="margin:0;color:var(--fg-dim);font-size:11px">When on, the game-over check is skipped and you can keep placing forever.</p>'
    + '</section>'

    /* --- Reset progress ------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-reset"/></svg> Reset / wipe'
    +   '</h3>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +     '<button class="btn btn-danger" id="adm-reset-stats"><span>Reset stats</span></button>'
    +     '<button class="btn btn-danger" id="adm-reset-lb"><span>Reset leaderboard</span></button>'
    +     '<button class="btn btn-danger" id="adm-reset-all"><span>Reset ALL progress</span></button>'
    +   '</div>'
    +   '<p style="margin:6px 0 0;color:var(--fg-dim);font-size:11px">Device ID is preserved.</p>'
    + '</section>'

    /* --- Debug info ----------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:8px">'
    +     '<svg class="ic-svg lg"><use href="#i-search"/></svg> Debug info'
    +   '</h3>'
    +   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    +     '<button class="btn" id="adm-dbg-refresh"><svg class="ic-svg"><use href="#i-reset"/></svg><span>Refresh</span></button>'
    +     '<button class="btn" id="adm-dbg-copy"><svg class="ic-svg"><use href="#i-copy"/></svg><span>Copy</span></button>'
    +   '</div>'
    +   '<pre id="adm-dbg-dump" style="background:var(--bg-2);border:1px solid var(--line);border-radius:10px;'
    +     'padding:10px;max-height:280px;overflow:auto;font:500 11px/1.4 \'JetBrains Mono\',monospace;'
    +     'white-space:pre-wrap;word-break:break-all;color:var(--fg-dim)"></pre>'
    + '</section>'

    /* --- Lock admin ----------------------------------------- */
    + '<section class="admin-card glass" style="padding:14px;border-radius:14px">'
    +   '<button class="btn btn-block" id="adm-lock"><svg class="ic-svg"><use href="#i-lock"/></svg><span>Lock admin mode</span></button>'
    + '</section>'

    + '</div>';

  _bindAdmin();
  _refreshAdminDebug();
}

/* ---------- Action handlers ---------- */
function _q(id){ return document.getElementById(id); }

function _bindAdmin(){
  /* HEX */
  _q("adm-hex-add").onclick = () => {
    const n = parseInt(_q("adm-hex-input").value, 10) || 0;
    addHex(n, { toast: true });
    _q("adm-hex-now").textContent = (state.wallet.hex||0).toLocaleString();
  };
  _q("adm-hex-set-zero").onclick = () => {
    state.wallet.hex = 0; saveState();
    if(typeof refreshHexPill === "function") refreshHexPill();
    _q("adm-hex-now").textContent = "0";
    toast("HEX wallet zeroed", "info");
  };
  _q("adm-hex-add-10k").onclick  = () => { addHex(10000,  { toast:true }); _q("adm-hex-now").textContent = (state.wallet.hex||0).toLocaleString(); };
  _q("adm-hex-add-100k").onclick = () => { addHex(100000, { toast:true }); _q("adm-hex-now").textContent = (state.wallet.hex||0).toLocaleString(); };

  /* Skins */
  _q("adm-skins-all").onclick = () => {
    if(typeof SKINS === "undefined") return;
    state.shop.ownedSkins = SKINS.map(s => s.id);
    saveState();
    if(typeof renderShop === "function") renderShop();
    toast("All "+SKINS.length+" skins unlocked", "success");
    renderAdmin();
  };
  _q("adm-skins-reset").onclick = () => {
    state.shop.ownedSkins = ["default"];
    state.shop.activeSkin = "default";
    saveState();
    if(typeof applyActiveSkin === "function") applyActiveSkin();
    if(typeof restyleRunForActiveSkin === "function") restyleRunForActiveSkin();
    if(typeof renderShop === "function") renderShop();
    toast("Skins reset to default", "info");
    renderAdmin();
  };

  /* Nickname */
  _q("adm-nick-set").onclick = () => {
    const v = (_q("adm-nick-input").value || "").trim().slice(0, 20);
    if(!v){ toast("Empty nickname", "warn"); return; }
    state.profile.nickname = v;
    saveState();
    if(typeof refreshAllUI === "function") refreshAllUI();
    if(typeof renderMenu === "function") renderMenu();
    _q("adm-nick-now").textContent = v;
    toast("Nickname set to "+v, "success");
  };

  /* Device ID */
  const idInput = _q("adm-id-input");
  idInput.addEventListener("input", () => { idInput.value = (idInput.value||"").toUpperCase(); });
  _q("adm-id-set").onclick = () => {
    const v = (idInput.value || "").trim().toUpperCase();
    const re = /^HX-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
    if(!re.test(v)){
      toast("Invalid ID format (HX-XXXXX-XXXXX)", "warn");
      return;
    }
    state.profile.id = v;
    try{ localStorage.setItem("hexon.deviceId.v1", v); }catch{}
    if(typeof androidWriteDeviceId === "function") androidWriteDeviceId(v);
    saveState();
    _q("adm-id-now").textContent = v;
    if(typeof refreshAllUI === "function") refreshAllUI();
    toast("Device ID set", "success");
    _refreshAdminDebug();
  };
  _q("adm-id-regen").onclick = () => {
    const v = (typeof genId === "function") ? genId() : ("HX-"+Math.random().toString(36).slice(2,7).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase());
    state.profile.id = v;
    try{ localStorage.setItem("hexon.deviceId.v1", v); }catch{}
    if(typeof androidWriteDeviceId === "function") androidWriteDeviceId(v);
    saveState();
    _q("adm-id-now").textContent = v;
    idInput.value = v;
    if(typeof refreshAllUI === "function") refreshAllUI();
    toast("Device ID regenerated", "success");
    _refreshAdminDebug();
  };

  /* No Game Over */
  _q("adm-no-gameover").addEventListener("change", (e) => {
    state.admin.noGameOver = !!e.target.checked;
    saveState();
    toast("No Game Over: " + (state.admin.noGameOver ? "ON" : "OFF"), "info");
  });

  /* Reset */
  _q("adm-reset-stats").onclick = () => {
    if(!confirm("Reset stats to zero?")) return;
    state.stats = { games:0, best:0, bestRun:0, totalScore:0, totalTimeMs:0, lines:0, bestCombo:0, placedTotal:0, xp:0, totalScoreFromGames:0 };
    saveState();
    if(typeof refreshAllUI === "function") refreshAllUI();
    toast("Stats reset", "success");
    _refreshAdminDebug();
  };
  _q("adm-reset-lb").onclick = () => {
    state.leaderboards = [];
    saveState();
    if(typeof renderLeaderboards === "function" && document.querySelector('[data-screen="leaderboards"].active')) renderLeaderboards();
    toast("Leaderboard reset", "success");
    _refreshAdminDebug();
  };
  _q("adm-reset-all").onclick = () => {
    if(!confirm("Wipe ALL progress? (Device ID and admin flag are preserved.)")) return;
    const keepId    = state.profile.id;
    const keepAdmin = state.admin && state.admin.enabled;
    if(typeof resetProgressKeepDeviceId === "function") resetProgressKeepDeviceId();
    /* In-memory state needs to be cleared too — reload guarantees a
       clean rebuild from defaults. */
    setTimeout(() => { location.reload(); }, 200);
    toast("All progress wiped — reloading…", "warn");
  };

  /* Debug */
  _q("adm-dbg-refresh").onclick = _refreshAdminDebug;
  _q("adm-dbg-copy").onclick = () => {
    const txt = _q("adm-dbg-dump").textContent || "";
    if(navigator.clipboard){
      navigator.clipboard.writeText(txt).then(
        () => toast("Debug dump copied", "success"),
        () => toast("Clipboard blocked", "warn")
      );
    }
  };

  /* Lock */
  _q("adm-lock").onclick = () => {
    if(!confirm("Disable admin mode? You'll need to type @admin again on the login screen to re-enable it.")) return;
    disableAdmin();
  };
}

function _refreshAdminDebug(){
  const dump = _q("adm-dbg-dump");
  if(!dump) return;
  let ls = {};
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      ls[k] = localStorage.getItem(k);
    }
  }catch{ ls = { error: "localStorage unavailable" }; }
  const bridge = (typeof window !== "undefined") && window.AndroidHexon;
  const info = {
    androidBridge: bridge ? "present" : "absent",
    deviceIdFile: _adminAndroidPathHint(),
    deviceId: state.profile.id,
    nickname: state.profile.nickname,
    admin: state.admin,
    wallet: state.wallet,
    shop: state.shop,
    stats: state.stats,
    settings: state.settings,
    leaderboardSize: (state.leaderboards||[]).length,
    achievements: Array.from(state.achievements || []),
    localStorage: ls,
  };
  dump.textContent = JSON.stringify(info, null, 2);
}
