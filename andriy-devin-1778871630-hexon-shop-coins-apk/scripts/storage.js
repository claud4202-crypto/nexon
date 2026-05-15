/* ---------- Storage ----------
   Two keys are used in localStorage:
     hexon.deviceId.v1  — the stable player ID. Created once on first
                          launch and NEVER deleted, even when the
                          user signs out or resets progress. This is
                          what guarantees "1 ID per device, forever".
     hexon.beta.v1      — everything else (profile, stats, settings,
                          wallet, shop, etc.).

   On Android the same ID is ALSO mirrored to a file in the public
   Documents folder via the AndroidHexon JS bridge. That file lives
   outside the app's sandbox and therefore survives an uninstall,
   so reinstalling the app brings the old ID back — only the
   nickname is asked again.
*/
const STORE_KEY  = "hexon.beta.v1";
const DEVICE_KEY = "hexon.deviceId.v1";

/* Format the device ID enforces. Keep in sync with the Android side
   (HexonStorage.isValidDeviceId in MainActivity.java). */
const DEVICE_ID_RE = /^HX-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

/* ---------- Android bridge helpers ---------- */
function androidBridge(){
  /* Set by MainActivity via addJavascriptInterface(name="AndroidHexon").
     Calls are synchronous and run on a binder thread on the Java side,
     which is exactly what we need during the boot sequence. */
  return (typeof window !== "undefined" && window.AndroidHexon) || null;
}
function androidReadDeviceId(){
  const b = androidBridge();
  if(!b || typeof b.readDeviceId !== "function") return "";
  try{
    const v = b.readDeviceId();
    if(typeof v === "string" && DEVICE_ID_RE.test(v)) return v;
  }catch{ /* native side threw — treat as "no id" */ }
  return "";
}
function androidWriteDeviceId(id){
  const b = androidBridge();
  if(!b || typeof b.writeDeviceId !== "function") return false;
  if(!DEVICE_ID_RE.test(id || "")) return false;
  try{ b.writeDeviceId(id); return true; }catch{ return false; }
}

/* Load (or create) the permanent device ID.

   Priority order so reinstalling the .apk doesn't wipe identity:
     1. Public file in /sdcard/Documents/HexonBeta/ via Android bridge
        — survives uninstall.
     2. localStorage on this WebView — survives normal app updates
        but gets cleared on uninstall.
     3. Brand-new randomly-generated ID.

   Whatever wins is mirrored to BOTH stores before returning so the
   two layers re-sync after an uninstall/reinstall cycle. */
function loadDeviceId(){
  let id = "";

  /* (1) External file (Android only). */
  id = androidReadDeviceId();

  /* (2) localStorage fallback. */
  if(!id){
    try{
      const v = localStorage.getItem(DEVICE_KEY);
      if(v && DEVICE_ID_RE.test(v)) id = v;
    }catch{ /* no localStorage available — keep id empty */ }
  }

  /* (3) Fresh ID. */
  if(!id) id = genId();

  /* Mirror into both stores so future boots are consistent regardless
     of which one was the source of truth this time around. */
  try{ localStorage.setItem(DEVICE_KEY, id); }catch{ /* ignore */ }
  androidWriteDeviceId(id);

  return id;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}

function saveState(){
  try{
    const copy = {
      profile: state.profile,
      stats: state.stats,
      settings: state.settings,
      achievements: Array.from(state.achievements),
      hidden: state.hidden,
      dailyTasks: state.dailyTasks,
      leaderboards: state.leaderboards,
      wallet: state.wallet,
      daily: state.daily,
      shop: state.shop,
      admin: state.admin,
      run: null, // not persisted across reloads (live game state)
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(copy));
  }catch{}
}

/* Reset progress without touching the device ID — the user keeps
   their permanent player ID even after a full reset. Returns the
   preserved ID so callers can put it back into the fresh profile.

   The external Android copy is NOT cleared either: it's the ID,
   not the progress, that is permanent. */
function resetProgressKeepDeviceId(){
  const keep = loadDeviceId();           // ensures key exists in both stores
  try{ localStorage.removeItem(STORE_KEY); }catch{}
  return keep;
}
