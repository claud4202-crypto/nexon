/* ============================================================
   HEXON BETA — Shop, HEX wallet, daily reward, skins
   ============================================================ */
"use strict";

/* Telegram admin handle for buying HEX coin packs. */
const TG_ADMIN = "PloxoyHard";

/* ---------- Daily reward window ----------
   Window opens at 11:00 local time each day and stays open for the
   rest of that day. Once claimed, the user must wait until 11:00
   the next day before they can claim again. */
const DAILY_HOUR = 11;
const DAILY_MIN_HEX = 10;
const DAILY_MAX_HEX = 5000;

function dailyWindowStart(d){
  d = d || new Date();
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAILY_HOUR, 0, 0, 0);
  return x.getTime();
}
function nextDailyWindow(now){
  now = now || Date.now();
  const todayOpen = dailyWindowStart(new Date(now));
  if(now < todayOpen) return todayOpen;
  // already past today's open — next window is tomorrow at 11:00
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return dailyWindowStart(d);
}
/* True if the daily reward can be claimed *right now*. */
function dailyAvailable(){
  const now = Date.now();
  const open = dailyWindowStart(new Date(now));
  if(now < open) return false;                  // before 11:00 today
  const last = state.daily.lastClaim || 0;
  return last < open;                           // not yet claimed today
}
/* Time string "Xh Ym" until the next claim window. */
function dailyCountdown(){
  const now = Date.now();
  const target = dailyAvailable() ? 0 : nextDailyWindow(now);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if(h <= 0) return m + "m";
  return h + "h " + m + "m";
}
/* Deterministic reward for today so the player can't "save scum"
   by reloading: seed by (deviceId + date). 10..5000 HEX, weighted
   slightly toward the middle. */
function dailyRewardAmount(){
  const seed = hashStr((state.profile.id || "x") + ":" + todayKey());
  const rnd = mulberry32(seed);
  /* Two rolls averaged -> mild bell curve. */
  const r = (rnd() + rnd()) / 2;
  return Math.max(DAILY_MIN_HEX, Math.min(DAILY_MAX_HEX,
    Math.round(DAILY_MIN_HEX + r * (DAILY_MAX_HEX - DAILY_MIN_HEX))));
}
function claimDaily(){
  if(!dailyAvailable()) return null;
  const amount = dailyRewardAmount();
  state.daily.lastClaim = Date.now();
  state.daily.lastAmount = amount;
  state.daily.streak = (state.daily.streak || 0) + 1;
  addHex(amount);
  if(typeof sfx !== "undefined") sfx.dailyClaim();
  vibrate([16, 22, 16]);
  if(window.fx){
    fx.flash();
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
    fx.burst(cx, cy, { count: 28, spread: 180, size: 11, colors: ["#ffd166","#ffba49","#7c5cff","#24bdff","#3ddc97"] });
    fx.popup("+" + amount + " HEX", cx, cy, "score");
  }
  saveState();
  return amount;
}

/* ---------- Skins ----------
   Each skin maps the in-game piece palette to a custom color stop
   or gradient. `palette` is used by game.js when rendering pieces;
   `swatchColors` is what we show on the shop card.
   The first three skins are free / default; the rest cost HEX. */
const SKINS = [
  {
    id: "default", name: "shop.skin.default",
    price: 0,
    palette: ["#7c5cff","#24bdff","#3ddc97","#ffb454","#ff6470","#a766ff","#22d3ee","#facc15","#f472b6","#34d399"],
    swatchColors: ["#7c5cff","#24bdff","#3ddc97","#ffb454"],
  },
  {
    id: "mono-mint", name: "shop.skin.mint",
    price: 500,
    palette: ["#3ddc97","#34d399","#10b981","#5eead4","#22d3ee"],
    swatchColors: ["#3ddc97","#10b981","#5eead4"],
  },
  {
    id: "sunset", name: "shop.skin.sunset",
    price: 1200,
    palette: ["#ff6470","#ff8a3d","#ffb454","#fbbf24","#f472b6"],
    swatchColors: ["#ff6470","#ff8a3d","#ffb454","#f472b6"],
  },
  {
    id: "ocean", name: "shop.skin.ocean",
    price: 1800,
    palette: ["#24bdff","#22d3ee","#0ea5e9","#3b82f6","#6366f1"],
    swatchColors: ["#24bdff","#22d3ee","#3b82f6","#6366f1"],
  },
  {
    id: "neon", name: "shop.skin.neon",
    price: 3500,
    palette: ["#f72585","#b5179e","#7209b7","#560bad","#3a0ca3","#4361ee","#4cc9f0"],
    swatchColors: ["#f72585","#7209b7","#4cc9f0","#4361ee"],
  },
  {
    id: "gold", name: "shop.skin.gold",
    price: 6000,
    palette: ["#fbbf24","#f59e0b","#facc15","#fcd34d","#fde68a"],
    swatchColors: ["#fbbf24","#f59e0b","#fde68a"],
  },
  {
    id: "aurora", name: "shop.skin.aurora",
    price: 9500,
    palette: ["#7c5cff","#24bdff","#3ddc97","#a78bfa","#22d3ee","#34d399"],
    swatchColors: ["#7c5cff","#3ddc97","#24bdff","#a78bfa"],
  },
  {
    id: "cyber", name: "shop.skin.cyber",
    price: 14000,
    palette: ["#ec4899","#f472b6","#a855f7","#8b5cf6","#06b6d4"],
    swatchColors: ["#ec4899","#a855f7","#06b6d4"],
  },
  {
    id: "lava", name: "shop.skin.lava",
    price: 22000,
    palette: ["#ef4444","#dc2626","#f97316","#fb923c","#fde047"],
    swatchColors: ["#ef4444","#f97316","#fde047"],
  },
  {
    id: "galaxy", name: "shop.skin.galaxy",
    price: 35000,
    palette: ["#1e3a8a","#7c3aed","#9333ea","#ec4899","#06b6d4","#fbbf24"],
    swatchColors: ["#1e3a8a","#9333ea","#ec4899","#fbbf24"],
  },
];
function skinById(id){
  return SKINS.find(s => s.id === id) || SKINS[0];
}
function activePalette(){
  return skinById(state.shop.activeSkin || "default").palette;
}
function ownsSkin(id){
  return (state.shop.ownedSkins || []).indexOf(id) !== -1;
}

/* Stable picker for a piece color out of the active palette.
   We key on piece.id so the SAME piece keeps the SAME slot in the
   new palette (i.e. picks the palette colour at the same index)
   when the player switches skins repeatedly. Falls back to a fresh
   random colour if piece.id is missing. */
function colorForPiece(piece, palette){
  if(!piece) return null;
  const pal = palette || activePalette();
  if(!pal || !pal.length) return piece.color;
  if(piece.id){
    /* hashStr lives in util.js — already loaded before shop.js */
    const h = (typeof hashStr === "function") ? hashStr(piece.id) : 0;
    return pal[h % pal.length];
  }
  return pal[Math.floor(Math.random() * pal.length)];
}

/* Push the active skin's id onto the <html> element so the
   per-skin CSS in styles/skins.css can scope textures correctly.
   Safe to call at any point (idempotent). */
function applyActiveSkin(){
  const id = (state && state.shop && state.shop.activeSkin) || "default";
  if(document && document.documentElement){
    document.documentElement.setAttribute("data-skin", id);
  }
}

/* Re-skin every visible piece + every settled board cell so changing
   the skin from the shop is visible IMMEDIATELY without having to
   start a new run. We keep a stable mapping per piece.id and per
   (row,col) so re-equipping the previous skin gives back the same
   colour layout the player had before. */
function restyleRunForActiveSkin(){
  if(!state || !state.run) return;
  const pal = activePalette();
  if(!pal || !pal.length) return;
  /* Pieces in the tray. */
  if(Array.isArray(state.run.pieces)){
    state.run.pieces.forEach(p => { if(p) p.color = colorForPiece(p, pal); });
  }
  /* Cells already placed on the board. We key the remap on a fixed
     "r:c" string so the position keeps the same palette slot under
     the new skin — that way the board doesn't visually "melt". */
  if(Array.isArray(state.run.board)){
    for(let r=0; r<state.run.board.length; r++){
      const row = state.run.board[r];
      if(!row) continue;
      for(let c=0; c<row.length; c++){
        if(!row[c]) continue;
        const key = r + ":" + c;
        const h = (typeof hashStr === "function") ? hashStr(key) : (r*100 + c);
        row[c] = pal[h % pal.length];
      }
    }
  }
}
function buySkin(id){
  const skin = skinById(id);
  if(!skin || skin.id === "default") return false;
  if(ownsSkin(id)) return false;
  if(!spendHex(skin.price)){
    toast(t("shop.notEnough"), "warn");
    if(typeof sfx !== "undefined") sfx.invalid();
    return false;
  }
  state.shop.ownedSkins = (state.shop.ownedSkins || []).concat([id]);
  state.shop.activeSkin = id;       // auto-equip on purchase
  applyActiveSkin();
  restyleRunForActiveSkin();
  saveState();
  if(typeof sfx !== "undefined") sfx.purchase();
  vibrate([18, 26, 18]);
  toast(t("shop.bought", { name: t(skin.name) }), "success");
  renderShop();
  if(state.run){
    if(typeof renderTray  === "function") renderTray();
    if(typeof renderBoard === "function") renderBoard();
  }
  return true;
}
function equipSkin(id){
  if(!ownsSkin(id)) return false;
  state.shop.activeSkin = id;
  applyActiveSkin();
  restyleRunForActiveSkin();
  saveState();
  if(typeof sfx !== "undefined") sfx.skinEquip();
  vibrate(12);
  renderShop();
  if(state.run){
    if(typeof renderTray  === "function") renderTray();
    if(typeof renderBoard === "function") renderBoard();
  }
  return true;
}

/* ---------- Coin packs (Telegram purchase) ---------- */
const COIN_PACKS = [
  { hex: 500,    price: "0.99 USD" },
  { hex: 1000,   price: "1.99 USD" },
  { hex: 2000,   price: "2.99 USD" },
  { hex: 5000,   price: "5.99 USD" },
  { hex: 10000,  price: "9.99 USD" },
  { hex: 20000,  price: "17.99 USD" },
  { hex: 50000,  price: "39.99 USD" },
  { hex: 100000, price: "69.99 USD" },
];
function openTelegram(url){
  /* Try the Android JS bridge first (so the WebView app actually
     hands the URL off to the system Telegram app), then fall back
     to a same-tab navigation that the WebView's URL-handler
     re-dispatches to an external Intent. */
  if(window.AndroidHexon && typeof window.AndroidHexon.openUrl === "function"){
    try { window.AndroidHexon.openUrl(url); return; } catch {}
  }
  /* In a regular browser, opening in a new tab requires user-gesture
     context, which we have here (button click). */
  try {
    const w = window.open(url, "_blank");
    if(!w) window.location.href = url;
  } catch {
    window.location.href = url;
  }
}
function confirmCoinPurchase(pack){
  const m = $("#modal-confirm-buy");
  if(!m) return;
  $("#cbm-amount").textContent = pack.hex.toLocaleString();
  $("#cbm-price").textContent = pack.price;
  $("#cbm-admin").textContent = "@" + TG_ADMIN;
  /* Hook the Yes button afresh each time so it carries the
     correct pack into the click handler. */
  const yes = $("#cbm-yes");
  const no  = $("#cbm-no");
  const close = ()=> closeModal("#modal-confirm-buy");
  const onYes = ()=> {
    close();
    const msg = encodeURIComponent(
      "Привіт! Хочу купити " + pack.hex.toLocaleString() + " HEX за " + pack.price +
      ".\nМій ID: " + (state.profile.id || "—") +
      "\nНік: " + (state.profile.nickname || "—")
    );
    openTelegram("https://t.me/" + TG_ADMIN + "?text=" + msg);
    toast(t("shop.tgRedirect"), "info");
    if(typeof sfx !== "undefined") sfx.purchase();
    yes.removeEventListener("click", onYes);
    no.removeEventListener("click", onNo);
  };
  const onNo = ()=> {
    close();
    yes.removeEventListener("click", onYes);
    no.removeEventListener("click", onNo);
  };
  yes.addEventListener("click", onYes);
  no.addEventListener("click", onNo);
  openModal("#modal-confirm-buy");
}

/* ---------- Rendering ---------- */
let shopTab = "skins";
function setShopTab(tab){
  shopTab = tab;
  $$("#shop-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $$(".shop-panel").forEach(p => p.classList.toggle("on", p.dataset.tab === tab));
  if(typeof sfx !== "undefined") sfx.shopTab();
  if(tab === "daily") renderDailyPanel();
}

function renderShop(){
  renderShopSkinsPanel();
  renderDailyPanel();
  renderShopCoinsPanel();
  refreshHexPill();
}

function renderShopSkinsPanel(){
  const grid = $("#shop-skins-grid");
  if(!grid) return;
  grid.innerHTML = "";
  SKINS.forEach((skin, idx) => {
    const card = document.createElement("div");
    card.className = "shop-skin-card";
    card.dataset.skinId = skin.id;        // lets skins.css style the swatches
    card.style.setProperty("--i", idx);
    if(ownsSkin(skin.id)) card.classList.add("owned");
    if(state.shop.activeSkin === skin.id) card.classList.add("active");

    const preview = document.createElement("div");
    preview.className = "shop-skin-preview";
    /* mini grid swatch showing 4 sample pieces */
    skin.swatchColors.forEach(col => {
      const sw = document.createElement("div");
      sw.className = "shop-skin-swatch";
      sw.style.background = col;
      preview.appendChild(sw);
    });
    card.appendChild(preview);

    const name = document.createElement("div");
    name.className = "shop-skin-name";
    name.textContent = t(skin.name);
    card.appendChild(name);

    const ft = document.createElement("div");
    ft.className = "shop-skin-foot";

    if(skin.id === "default"){
      ft.innerHTML = '<span class="shop-pill free">' + t("shop.free") + '</span>';
    } else if(ownsSkin(skin.id)){
      ft.innerHTML = '<span class="shop-pill owned">' + t("shop.owned") + '</span>';
    } else {
      ft.innerHTML = '<span class="shop-pill price"><svg class="ic-svg"><use href="#i-hex"/></svg>' +
        skin.price.toLocaleString() + '</span>';
    }
    card.appendChild(ft);

    const btn = document.createElement("button");
    btn.className = "shop-skin-btn";
    btn.type = "button";
    if(state.shop.activeSkin === skin.id){
      btn.classList.add("equipped");
      btn.textContent = t("shop.equipped");
      btn.disabled = true;
    } else if(ownsSkin(skin.id)){
      btn.textContent = t("shop.equip");
      btn.addEventListener("click", () => equipSkin(skin.id));
    } else {
      btn.classList.add("buy");
      btn.textContent = t("shop.buy");
      btn.addEventListener("click", () => {
        if((state.wallet.hex || 0) < skin.price){
          toast(t("shop.notEnough"), "warn");
          if(typeof sfx !== "undefined") sfx.invalid();
          return;
        }
        buySkin(skin.id);
      });
    }
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function renderDailyPanel(){
  const panel = $("#shop-daily-panel");
  if(!panel) return;
  const available = dailyAvailable();
  const dailyCard = $("#daily-card");
  const claimBtn = $("#daily-claim-btn");
  const cdEl = $("#daily-countdown");
  const lastEl = $("#daily-last");
  const streakEl = $("#daily-streak");

  dailyCard.classList.toggle("available", available);
  cdEl.textContent = available ? t("shop.daily.ready") : t("shop.daily.in", { time: dailyCountdown() });
  streakEl.textContent = state.daily.streak || 0;
  lastEl.textContent = state.daily.lastAmount ? state.daily.lastAmount.toLocaleString() : "—";

  claimBtn.disabled = !available;
  claimBtn.classList.toggle("ready", available);
  /* Refresh once per minute while panel is mounted. */
  if(panel._tick) clearInterval(panel._tick);
  panel._tick = setInterval(() => {
    if(!document.body.contains(panel)){ clearInterval(panel._tick); return; }
    /* if we're on the shop screen + daily tab, update */
    if(currentScreen === "shop" && shopTab === "daily") renderDailyPanel();
    refreshDailyMenuCta();
  }, 30000);
}

function renderShopCoinsPanel(){
  const grid = $("#shop-coins-grid");
  if(!grid) return;
  grid.innerHTML = "";
  COIN_PACKS.forEach((pack, idx) => {
    const card = document.createElement("div");
    card.className = "shop-coin-card";
    card.style.setProperty("--i", idx);
    /* Mark the higher-value packs as "best value" with a soft badge. */
    if(pack.hex >= 10000) card.classList.add("hi");
    if(pack.hex === 20000) card.classList.add("popular");
    if(pack.hex === 100000) card.classList.add("mega");

    card.innerHTML =
      '<div class="shop-coin-icon"><svg class="ic-svg"><use href="#i-hex"/></svg></div>' +
      '<div class="shop-coin-amount">' + pack.hex.toLocaleString() + ' <span>HEX</span></div>' +
      '<div class="shop-coin-price">' + pack.price + '</div>' +
      '<button class="shop-coin-btn" type="button">' +
        '<svg class="ic-svg"><use href="#i-cart"/></svg>' +
        '<span>' + t("shop.buy") + '</span>' +
      '</button>';
    card.querySelector(".shop-coin-btn").addEventListener("click", () => confirmCoinPurchase(pack));
    grid.appendChild(card);
  });
  const adminLine = $("#shop-coins-admin");
  if(adminLine){
    adminLine.textContent = t("shop.coins.admin", { handle: "@" + TG_ADMIN });
  }
}

function refreshHexPill(){
  const v = (state.wallet.hex || 0).toLocaleString();
  document.querySelectorAll("[data-hex-amount]").forEach(el => {
    el.textContent = v;
  });
}

/* CTA badge on the menu's shop tile when a daily reward is available. */
function refreshDailyMenuCta(){
  const dot = $("#menu-daily-dot");
  if(!dot) return;
  dot.classList.toggle("on", dailyAvailable());
}
