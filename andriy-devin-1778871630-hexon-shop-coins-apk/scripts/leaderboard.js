/* ---------- Leaderboards (simulated) ---------- */
const FAKE_NAMES = ["Nova","Kairo","Akira","Sora","Lumen","Vega","Orion","Zephyr","Mira","Iris","Kai","Rune","Sage","Echo","Lyra","Pax","Onyx","Atlas","Lux","Nyx","Cyra","Polaris","Hex","Tao","Juno","Astrid","Selene","Cassio","Calix","Helios","Aether","Vesper","Ronin","Saoirse","Aurel","Sable","Thal","Nikko","Reza","Mika","Ezra","Ines","Lior","Maya","Niko","Yuna","Zara","Liyo","Aria","Bex"];

/* Reserved nicknames the player can't pick (admin triggers, system
   words, etc.). Compared case-insensitively. */
const RESERVED_NICKS = [
  "admin","administrator","root","system","hexon","hexon beta","beta",
  "moderator","mod","gm","support","staff","player","developer","dev",
  "owner","null","undefined","none","bot","official","cheater","hacker",
];

/* Return true when `nick` matches an existing player on the
   leaderboard (real or simulated) or a reserved system word. The
   current user's own nickname is allowed (so reopening the login
   screen with their saved name keeps Confirm enabled). Comparison
   is case-insensitive and ignores surrounding whitespace. */
function isNicknameTaken(nick){
  const n = (nick || "").trim().toLowerCase();
  if(!n) return false;
  /* Allow the user to keep their own current nickname. */
  const me = (state && state.profile && state.profile.nickname || "").toLowerCase();
  if(n === me) return false;

  if(RESERVED_NICKS.indexOf(n) !== -1) return true;
  if(n.indexOf("@admin") === 0) return true; // covers @admin* variants

  /* Match against the seeded leaderboard pool. We have to bake the
     same trailing-number scheme buildLeaderboard() uses, because
     entries like "Nova42" are different players than "Nova". */
  if(FAKE_NAMES.some(fn => fn.toLowerCase() === n)) return true;

  /* And against any leaderboard that's already been generated for
     this session (covers names with the optional trailing digits). */
  const pool = (state && state.leaderboards) || [];
  for(let i=0;i<pool.length;i++){
    const row = pool[i];
    if(row && !row.me && (row.name||"").toLowerCase() === n) return true;
  }
  return false;
}
function buildLeaderboard(){
  const seed = hashStr("hexon-leaderboards-v1");
  const rnd = mulberry32(seed);
  /* Build a 5-character chunk from the SEEDED rng so the leaderboard
     stays stable across renders. Using Math.random() here (as the
     original code did) produced different IDs every time the table
     was rebuilt and yielded malformed values like `HX-XXXXX-9999`
     instead of the required `HX-XXXXX-XXXXX`. */
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  function chunk(){
    let s = "";
    for(let k=0;k<5;k++) s += chars[Math.floor(rnd()*chars.length)];
    return s;
  }
  const list = [];
  for(let i=0;i<60;i++){
    const name = FAKE_NAMES[Math.floor(rnd()*FAKE_NAMES.length)] + (rnd()<0.6 ? Math.floor(rnd()*99) : "");
    const id = "HX-" + chunk() + "-" + chunk();
    // Score distribution: highest ~50k, decay
    const base = Math.floor(40000 * Math.exp(-i*0.045));
    const jitter = Math.floor(rnd()*5000);
    list.push({ name, id, score: base + jitter, fake:true });
  }
  list.sort((a,b)=>b.score-a.score);
  return list;
}
function updateLeaderboardsForMe(){
  // remove existing "me" entries
  state.leaderboards = state.leaderboards.filter(e => !e.me);
  state.leaderboards.push({ name: state.profile.nickname, id: state.profile.id, score: state.stats.best||0, me:true });
  state.leaderboards.sort((a,b)=>b.score-a.score);
}
function ensureLeaderboards(){
  if(!state.leaderboards || state.leaderboards.length === 0){
    state.leaderboards = buildLeaderboard();
  }
  updateLeaderboardsForMe();
}
function renderLeaderboards(){
  ensureLeaderboards();
  const tbl = $("#lb-table");
  tbl.innerHTML = "";
  const headers = [
    {k:"lb.rank", cls:""},
    {k:"lb.name", cls:""},
    {k:"lb.id", cls:"col-id"},
    {k:"lb.score", cls:""},
  ];
  headers.forEach(h=>{
    const hd = document.createElement("div"); hd.className = "hd " + h.cls; hd.textContent = t(h.k); tbl.appendChild(hd);
  });
  state.leaderboards.slice(0, 50).forEach((row, i)=>{
    const me = row.me;
    const rk = document.createElement("div"); rk.className = "rk" + (me ? " me":""); rk.textContent = "#"+(i+1);
    const nm = document.createElement("div"); nm.className = (me?"me":""); nm.textContent = (me ? "[" + t("common.you") + "] " : "") + (row.name || "—");
    const id = document.createElement("div"); id.className = "col-id " + (me?"me":""); id.style.fontFamily="'JetBrains Mono',monospace"; id.style.fontSize="12px"; id.style.color="var(--fg-dim)"; id.textContent = row.id || "—";
    const sc = document.createElement("div"); sc.className = "sc" + (me?" me":""); sc.textContent = (row.score||0).toLocaleString();
    tbl.appendChild(rk); tbl.appendChild(nm); tbl.appendChild(id); tbl.appendChild(sc);
  });
}

