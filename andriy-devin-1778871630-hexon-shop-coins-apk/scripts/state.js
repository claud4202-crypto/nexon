/* ---------- State ---------- */
const state = {
  profile: { nickname:"", id:"", registeredAt:0, lastLoginDay:0, loginDays:[] },
  stats: { games:0, best:0, bestRun:0, totalScore:0, totalTimeMs:0, lines:0, bestCombo:0, placedTotal:0, xp:0 },
  settings: {
    lang: "uk",
    sound: true,
    vibration: true,
    theme: "dark",
    /* "auto" detects from screen width on each launch.
       "pc" / "laptop" / "tablet" / "phone" pin a specific layout density. */
    device: "auto",
    /* When true the chosen device is restored on every future login.
       When false the user is asked again on the next login screen. */
    rememberDevice: true,
  },
  achievements: new Set(), // ids
  hidden: { firstPlace:false, tripleClear:false, quadClear:false, speedrun:false, pacifist:false, survivor:false, cleaner:false },
  dailyTasks: { date:"", tasks:[] },
  leaderboards: [], // simulated global pool

  /* ---------- Economy / shop ---------- */
  /* HEX is the in-game soft currency. Earned via daily reward, spent
     on shop skins. Coin packs are purchased OFF-GAME via @PloxoyHard. */
  wallet: { hex: 0 },
  /* Daily reward: the user can claim once per day. The reward window
     opens at 11:00 local time each day. `lastClaim` is the timestamp
     of the most recent claim; `lastAmount` is what they got. */
  daily: { lastClaim: 0, lastAmount: 0, streak: 0 },
  /* Skins ownership + currently equipped skin. `ownedSkins` always
     contains "default" so the user never loses their pieces. */
  shop: { ownedSkins: ["default"], activeSkin: "default" },

  // live, not persisted
  run: null,
};

/* ---------- XP / Level ---------- */
function levelInfo(totalXp){
  // levels grow: need(level) = 80 + level*40
  let lvl = 1, remaining = totalXp;
  while(true){
    const need = 80 + (lvl-1)*40;
    if(remaining < need) return { lvl, into: remaining, need };
    remaining -= need;
    lvl++;
    if(lvl > 999) return { lvl, into: 0, need: 80 + (lvl-1)*40 };
  }
}
function addXP(n){
  const before = levelInfo(state.stats.xp).lvl;
  state.stats.xp = (state.stats.xp||0) + n;
  const after = levelInfo(state.stats.xp).lvl;
  if(after > before){
    toast(t("toast.lvlup",{n:after}), "success");
    if(window.fx) fx.celebrateLevelUp(after);
    else { if(typeof sfx !== "undefined") sfx.lvlup(); vibrate(30); }
  }
}

/* ---------- HEX wallet helpers ---------- */
function addHex(n, opts){
  if(!n) return;
  state.wallet.hex = Math.max(0, (state.wallet.hex || 0) + n);
  saveState();
  if(typeof refreshHexPill === "function") refreshHexPill();
  if(opts && opts.toast){
    toast(t("toast.hex.add", { n: n.toLocaleString() }), "success");
  }
}
function spendHex(n){
  if((state.wallet.hex||0) < n) return false;
  state.wallet.hex -= n;
  saveState();
  if(typeof refreshHexPill === "function") refreshHexPill();
  return true;
}
