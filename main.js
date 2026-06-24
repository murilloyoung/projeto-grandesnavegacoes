"use strict";

// ══════════════════════════════════════════════════
//  MÚSICA MEDIEVAL — Web Audio API (D Dórica)
// ══════════════════════════════════════════════════
const MUSIC = (() => {
  let ctx = null,
    master = null;
  let playing = false,
    loopTimer = null,
    initialized = false;

  const BPM = 72;
  const BEAT = 60 / BPM;

  // Frequências — escala D Dórica (D E F G A B C D)
  const N = {
    D3: 146.83,
    A3: 220.0,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
  };

  // Melodia principal: [nota|null, beats]
  const MELODY = [
    ["D4", 1],
    ["E4", 0.5],
    ["F4", 0.5],
    ["G4", 1],
    ["A4", 1],
    ["G4", 0.5],
    ["F4", 0.5],
    ["E4", 1],
    ["D4", 2],
    ["A4", 1],
    ["B4", 0.5],
    ["C5", 0.5],
    ["D5", 1],
    ["C5", 0.5],
    ["B4", 0.5],
    ["A4", 1],
    ["G4", 2],
    ["F4", 1],
    ["G4", 0.5],
    ["A4", 0.5],
    ["B4", 1],
    ["A4", 0.5],
    ["G4", 0.5],
    ["F4", 1],
    ["E4", 1],
    ["D4", 1],
    ["F4", 1],
    ["A4", 1],
    ["G4", 1],
    ["E4", 1],
    ["D4", 3],
    [null, 1],
  ];

  // Contracanto (alaúde, oitava abaixo, mais suave)
  const COUNTER = [
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 0.5],
    ["A3", 0.5],
    ["D3", 1],
    [null, 1],
  ];

  function playNote(freq, t, beats, vol, wave, filterHz = 4000) {
    const dur = beats * BEAT;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterHz;
    o.type = wave;
    o.frequency.value = freq;
    o.connect(f);
    f.connect(g);
    g.connect(master);
    const atk = Math.min(0.06, dur * 0.08);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.65);
    g.gain.linearRampToValueAtTime(0, t + dur * 0.92);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function scheduleLoop() {
    if (!playing) return;
    const t0 = ctx.currentTime + 0.1;
    let tm = t0,
      tc = t0;

    for (const [n, d] of MELODY) {
      if (n) playNote(N[n], tm, d, 0.38, "triangle", 3500);
      tm += d * BEAT;
    }
    for (const [n, d] of COUNTER) {
      if (n) playNote(N[n], tc, d, 0.18, "sawtooth", 600);
      tc += d * BEAT;
    }

    const totalMs = MELODY.reduce((s, [, d]) => s + d, 0) * BEAT * 1000;
    loopTimer = setTimeout(scheduleLoop, totalMs - 300);
  }

  return {
    getCtx() {
      return ctx;
    },
    init() {
      if (initialized) return;
      initialized = true;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.18;
      const rev = ctx.createConvolver ? null : null; // sem reverb por simplicidade
      master.connect(ctx.destination);

      // Bordão contínuo: D1 + A1 (quinta perfeita)
      [36.71, 55.0].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 180;
        o.type = "sawtooth";
        o.frequency.value = freq;
        o.connect(f);
        f.connect(g);
        g.connect(master);
        g.gain.value = i === 0 ? 0.08 : 0.05;
        o.start();
      });

      playing = true;
      scheduleLoop();
    },
    toggle() {
      if (!initialized) {
        this.init();
        return;
      }
      playing = !playing;
      if (playing) {
        master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.5);
        scheduleLoop();
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
        clearTimeout(loopTimer);
      }
    },
    get muted() {
      return !playing;
    },
  };
})();

// ══════════════════════════════════════════════════
//  SFX — SONS DE PASSOS (Web Audio API)
// ══════════════════════════════════════════════════
const SFX = (() => {
  let stepPhase = 0; // alterna entre pé esquerdo e direito

  function footstep() {
    const c = MUSIC.getCtx();
    if (!c || c.state !== "running") return;

    const t = c.currentTime;
    const out = c.destination;

    // Ruído branco curto — simula o impacto do passo
    const bufLen = Math.floor(c.sampleRate * 0.07);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = c.createBufferSource();
    noise.buffer = buf;

    // Filtro bandpass: esquerdo (~220Hz) e direito (~180Hz) — variação sutil
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = stepPhase === 0 ? 220 : 180;
    bp.Q.value = 1.2;

    // Filtro lowpass para tirar os agudos (som abafado de madeira/pedra)
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;

    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(out);
    noise.start(t);
    noise.stop(t + 0.07);

    // Pequeno "bump" de baixa frequência — ressonância do chão
    const thud = c.createOscillator();
    const tGain = c.createGain();
    thud.type = "sine";
    thud.frequency.value = 60;
    tGain.gain.setValueAtTime(0.32, t);
    tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    thud.connect(tGain);
    tGain.connect(out);
    thud.start(t);
    thud.stop(t + 0.05);

    stepPhase ^= 1;
  }

  function dialogueOpen() {
    const c = MUSIC.getCtx();
    if (!c || c.state !== "running") return;
    const t = c.currentTime;

    // Farfalhar de pergaminho — ruído filtrado em agudos
    const bufLen = Math.floor(c.sampleRate * 0.12);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(c.destination);
    noise.start(t);
    noise.stop(t + 0.12);

    // Sininho medieval — pluck estilo harpa
    [659.25, 880].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const delay = i * 0.06;
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.28 : 0.14, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.55);
      o.connect(g);
      g.connect(c.destination);
      o.start(t + delay);
      o.stop(t + delay + 0.6);
    });
  }

  return { footstep, dialogueOpen };
})();

// ══════════════════════════════════════════════════
//  MENU
// ══════════════════════════════════════════════════
function openScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-" + id)?.classList.add("active");
}
function closeScreen() {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
}

// ══════════════════════════════════════════════════
//  IMAGEM DO MAPA
// ══════════════════════════════════════════════════
const mapImg = new Image();
let mapImgLoaded = false;
let collisionData = null;

mapImg.onload = () => {
  mapImgLoaded = true;
  // Lê pixels do mapa uma única vez para colisão
  const c = document.createElement("canvas");
  c.width = MAP_W;
  c.height = MAP_H;
  const cx = c.getContext("2d");
  cx.drawImage(mapImg, 0, 0, MAP_W, MAP_H);
  collisionData = cx.getImageData(0, 0, MAP_W, MAP_H).data;
};
mapImg.src = "game-desing/mapa.png";

function isWalkable(x, y) {
  if (!collisionData) return true;
  const ix = Math.max(0, Math.min(MAP_W - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(MAP_H - 1, Math.floor(y)));
  const i = (iy * MAP_W + ix) * 4;
  const r = collisionData[i],
    g = collisionData[i + 1],
    b = collisionData[i + 2];
  if (b > 85 && r < 20) return false; // água
  if (r < 35 && g < 35 && b < 35) return false; // sombras/interiores escuros
  if (g > r + 10 && g > 70 && b < 30) return false; // grama/vegetação
  return true;
}

// ══════════════════════════════════════════════════
//  SPRITE DO JOGADOR
// ══════════════════════════════════════════════════
const playerSprite = new Image();
let playerSpriteLoaded = false;
playerSprite.onload = () => {
  playerSpriteLoaded = true;
};
playerSprite.src = "game-desing/pedroalvarescabral.png";

// Grade 4 colunas × 2 linhas detectada pixel a pixel (1774×887px)
// Row 0: frente col 0-1 | costas col 2-3
// Row 1: esquerda col 0-1 | direita col 2-3
const SPR = {
  dw: 20,
  dh: 30, // tamanho de exibição (âncora nos pés)
  frames: {
    down: [
      [171, 61, 184, 351],
      [555, 61, 185, 351],
    ],
    up: [
      [1013, 61, 185, 351],
      [1396, 61, 184, 351],
    ],
    left: [
      [171, 470, 184, 339],
      [555, 470, 185, 339],
    ],
    right: [
      [1013, 470, 185, 339],
      [1396, 470, 184, 339],
    ],
  },
};

// ══════════════════════════════════════════════════
//  CONSTANTES DO MAPA
// ══════════════════════════════════════════════════
const MAP_W = 1536;
const MAP_H = 1024;

// ══════════════════════════════════════════════════
//  REGIÕES
// ══════════════════════════════════════════════════
const REGIONS = [
  { y0: 0, y1: MAP_H, color: "#c2ad8a", name: "Lisboa — Portugal" },
];

// ══════════════════════════════════════════════════
//  LOCAIS INTERATIVOS
// ══════════════════════════════════════════════════
const LOCATIONS = [
  {
    id: "rei",
    x: 820,
    y: 295,
    label: "Palácio Real — Lisboa",
    icon: "♜",
    color: "#c9a84c",
    dialogue: {
      npc: "Rei Dom Manuel I",
      lines: [
        '"Sou Dom Manuel I, chamado O Venturoso. Em 1494, Portugal e Espanha assinaram o Tratado de Tordesilhas — dividindo o mundo ao meio pelo meridiano a 370 léguas de Cabo Verde."',
        '"Em 1498, Vasco da Gama chegou à Índia pelo mar, contornando a África. Abriu a Rota das Especiarias e trouxe riquezas imensas para Portugal."',
        '"Agora confio-te uma nova frota. Partes rumo ao sul — mas os ventos do Atlântico podem levar-te a terras ainda não registadas em nenhum mapa."',
        '"Vai, Pedro Álvares. A história de Portugal está nas tuas mãos."',
      ],
      choices: [
        { text: "Zarpar em nome de Vossa Majestade" },
        { text: "Precisamos de mais navios" },
      ],
    },
  },
  {
    id: "padre",
    x: 1095,
    y: 400,
    label: "Catedral de Lisboa",
    icon: "✝",
    color: "#d4d4d4",
    dialogue: {
      npc: "Frei Henrique de Coimbra",
      lines: [
        '"A Ordem de Cristo financiou as grandes navegações portuguesas. A cruz vermelha nas velas das caravelas é o símbolo desta ordem religiosa e militar."',
        '"A missão era dupla: comercial, buscando especiarias e ouro; e espiritual, levando a fé cristã aos povos do além-mar."',
        '"Quando chegares a novas terras, celebrarei a primeira missa. Foi assim na Índia, e assim será em qualquer terra que Deus nos revelar."',
        '"Vai com Deus, Pedro Álvares. A fé será tua bússola quando os mapas terminarem."',
      ],
    },
  },
  {
    id: "infante",
    x: 700,
    y: 470,
    label: "Infante D. Henrique",
    icon: "♔",
    color: "#c9a84c",
    dialogue: {
      npc: "Infante D. Henrique",
      lines: [
        '"Sou Henrique, o Navegador. Fundei em Sagres a Escola de Navegação, reunindo os melhores cartógrafos, astrônomos e marinheiros do mundo."',
        '"Em 1434, Gil Eanes dobrou o Cabo Bojador — onde se dizia que o mar ferveria e monstros devorariam os navios. Quatorze expedições haviam falhado antes dele."',
        '"Com a caravela — navio leve e capaz de navegar contra o vento — Portugal desceu toda a costa africana, abriu rotas e chegou à Índia."',
        '"Cada légua explorada começa com coragem para avançar além do que os mapas mostram. Vai, e traz-me o que ainda não está registado."',
      ],
      choices: [
        { text: "Aceitar o desafio" },
        { text: "Preciso de mais tempo" },
      ],
    },
  },
  {
    id: "porto",
    x: 370,
    y: 760,
    label: "Porto de Lisboa",
    icon: "⚓",
    color: "#4a8fc9",
    dialogue: {
      npc: "Mestre do Porto",
      lines: [
        '"Bem-vindo ao Porto de Lisboa — o maior porto de Portugal! Daqui partiram todas as grandes expedições que mudaram o mundo."',
        '"Esta é a tua caravela. Leve, veloz e capaz de navegar contra o vento — a caravela foi a grande inovação que tornou possíveis os Descobrimentos."',
        '"Em 9 de março de 1500, treze navios e 1 200 homens partem sob o teu comando. O objetivo: seguir a rota de Vasco da Gama até à Índia."',
        '"Fala com o Infante D. Henrique e com o Rei Dom Manuel antes de zarpar. Eles têm muito a te ensinar."',
      ],
      choices: [
        { text: "Estou pronto para zarpar!" },
        { text: "Preciso explorar a cidade primeiro" },
      ],
    },
  },
];

// ══════════════════════════════════════════════════
//  QUEST
// ══════════════════════════════════════════════════
// NPCs que precisam ser visitados antes de zarpar
const QUEST_NPCS = ["infante", "rei", "padre"];

const DIALOGUE_ZARPAR = {
  npc: "Mestre do Porto",
  lines: [
    '"Então já falastes com o Infante, com o Rei e recebastes a bênção do Padre!"',
    '"A frota está pronta: treze navios, mil e duzentos homens e provisões para seis meses."',
    '"Os ventos sopram de Norte. É hora, Pedro Álvares Cabral — Portugal espera por vós!"',
  ],
  choices: [
    { text: "⚓  ZARPAR!  A história nos aguarda!", action: "complete" },
    { text: "Preciso de mais um momento..." },
  ],
};

// ══════════════════════════════════════════════════
//  ESTADO DO JOGO
// ══════════════════════════════════════════════════
const game = {
  running: false,
  keys: {},
  player: { x: 360, y: 810, dir: "up", moving: false, speed: 1.6 },
  camera: { x: 0, y: 0 },
  nearLocation: null,
  dialogue: null, // { data, line, showingChoices }
  visited: new Set(), // ids dos NPCs já visitados
};

// ══════════════════════════════════════════════════
//  CANVAS
// ══════════════════════════════════════════════════
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const wrapper = document.getElementById("game-wrapper");
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
}
window.addEventListener("resize", resizeCanvas);

// ══════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  game.keys[key] = true;

  // Inicia música na primeira tecla (política de autoplay do browser)
  MUSIC.init();

  if (key === "e") handleInteract();
  if (key === "m") {
    MUSIC.toggle();
    updateMusicBtn();
  }
  if (e.key === "Escape" && game.dialogue) {
    closeDialogue();
    e.preventDefault();
  }
});

// ══════════════════════════════════════════════════
// SECTION - INPUT MOUSE
// ══════════════════════════════════════════════════

// 1. Captura o M1 (Botão Esquerdo) para a ação
document.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    // Inicia a música pelo clique (política de autoplay do browser)
    MUSIC.init();

    // Executa a mesma ação que a letra "E" faria (Interagir)
    handleInteract();
  }
});

// 2. Bloqueia o menu do navegador no clique direito (M2)
document.addEventListener("contextmenu", (e) => {
  // Impede que o menu padrão abra e atrapalhe o jogo
  e.preventDefault();
});

function updateMusicBtn() {
  const btn = document.getElementById("music-btn");
  if (btn) btn.textContent = MUSIC.muted ? "🔇" : "🎵";
}
document.addEventListener("keyup", (e) => {
  game.keys[e.key.toLowerCase()] = false;
});

// ══════════════════════════════════════════════════
//  CICLO DE VIDA
// ══════════════════════════════════════════════════
function startGame() {
  resizeCanvas();
  canvas.style.display = "block";
  document.getElementById("hud").style.display = "block";

  game.player.x = 360;
  game.player.y = 810;
  game.player.dir = "up";
  game.camera.x = Math.max(
    0,
    Math.min(MAP_W - canvas.width, game.player.x - canvas.width / 2),
  );
  game.camera.y = Math.max(
    0,
    Math.min(MAP_H - canvas.height, game.player.y - canvas.height / 2),
  );
  game.dialogue = null;
  game.running = true;

  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════
//  LOOP PRINCIPAL
// ══════════════════════════════════════════════════
let lastTs = 0;
function loop(ts) {
  if (!game.running) return;
  lastTs = ts;
  update();
  render(ts);
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════════
function update() {
  if (game.dialogue) return;

  const k = game.keys;
  const p = game.player;
  const spd = k["shift"] ? p.speed * 1.8 : p.speed;

  let dx = 0,
    dy = 0;
  if (k["w"] || k["arrowup"]) {
    dy -= spd;
    p.dir = "up";
  }
  if (k["s"] || k["arrowdown"]) {
    dy += spd;
    p.dir = "down";
  }
  if (k["a"] || k["arrowleft"]) {
    dx -= spd;
    p.dir = "left";
  }
  if (k["d"] || k["arrowright"]) {
    dx += spd;
    p.dir = "right";
  }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  p.moving = dx !== 0 || dy !== 0;

  // Som de passos sincronizado com a animação (frame muda a cada 180ms → passo a cada 360ms)
  if (p.moving) {
    const stepFrame = Math.floor(lastTs / 360);
    if (stepFrame !== p._lastStepFrame) {
      p._lastStepFrame = stepFrame;
      SFX.footstep();
    }
  }

  const nx = Math.max(16, Math.min(MAP_W - 16, p.x + dx));
  const ny = Math.max(16, Math.min(MAP_H - 16, p.y + dy));
  if (isWalkable(nx, ny)) {
    p.x = nx;
    p.y = ny;
  } else if (isWalkable(nx, p.y)) {
    p.x = nx;
  } else if (isWalkable(p.x, ny)) {
    p.y = ny;
  }

  // Câmera suave
  const tx = p.x - canvas.width * 0.5;
  const ty = p.y - canvas.height * 0.5;
  game.camera.x += (tx - game.camera.x) * 0.1;
  game.camera.y += (ty - game.camera.y) * 0.1;
  game.camera.x = Math.max(0, Math.min(MAP_W - canvas.width, game.camera.x));
  game.camera.y = Math.max(0, Math.min(MAP_H - canvas.height, game.camera.y));

  // Local próximo
  game.nearLocation = null;
  for (const loc of LOCATIONS) {
    if (Math.hypot(p.x - loc.x, p.y - loc.y) < 65) {
      game.nearLocation = loc;
      break;
    }
  }

  // HUD prompt
  const prompt = document.getElementById("location-prompt");
  if (game.nearLocation) {
    prompt.textContent = `[E]  ${game.nearLocation.label}`;
    prompt.classList.add("visible");
  } else {
    prompt.classList.remove("visible");
  }

  // Região atual
  const region = REGIONS.find((r) => p.y >= r.y0 && p.y < r.y1) ?? REGIONS[2];
  document.getElementById("region-label").textContent =
    region.name.toUpperCase();
}

// ══════════════════════════════════════════════════
//  DIÁLOGO
// ══════════════════════════════════════════════════
function questDone() {
  return QUEST_NPCS.every((id) => game.visited.has(id));
}

function handleInteract() {
  if (game.dialogue) {
    advanceLine();
    return;
  }
  if (!game.nearLocation) return;
  const loc = game.nearLocation;
  // Porto com missão completa → diálogo de zarpar
  const data =
    loc.id === "porto" && questDone() ? DIALOGUE_ZARPAR : loc.dialogue;
  openDialogue(data, loc.id);
}

function openDialogue(data, npcId = null) {
  SFX.dialogueOpen();
  if (npcId && QUEST_NPCS.includes(npcId)) {
    game.visited.add(npcId);
    updateQuestHUD();
  }
  game.dialogue = { data, line: 0, showingChoices: false };
  document.getElementById("dialogue-npc-name").textContent = data.npc;
  document.getElementById("dialogue-text").textContent = data.lines[0];
  document.getElementById("dialogue-choices").innerHTML = "";
  document.getElementById("dialogue-advance").style.display = "block";
  updateAdvanceHint(data, 0);
  document.getElementById("dialogue-box").classList.add("active");
}

function updateQuestHUD() {
  const items = document.querySelectorAll("#quest-hud .q-item");
  items.forEach((el) => {
    const id = el.dataset.id;
    el.classList.toggle("done", game.visited.has(id));
  });
  // Prompt no Porto muda quando missão completa
  if (questDone() && game.nearLocation?.id === "porto") {
    document.getElementById("location-prompt").textContent = "[E]  Zarpar!";
  }
}

function updateAdvanceHint(data, line) {
  const isLast = line === data.lines.length - 1;
  const adv = document.getElementById("dialogue-advance");
  if (isLast && data.choices) adv.textContent = "▶  E — Ver opções";
  else if (isLast) adv.textContent = "▶  E — Fechar";
  else adv.textContent = "▶  E — Continuar";
}

function advanceLine() {
  const d = game.dialogue;
  if (!d || d.showingChoices) return;

  d.line++;
  if (d.line >= d.data.lines.length) {
    if (d.data.choices) showChoices(d.data.choices);
    else closeDialogue();
    return;
  }
  document.getElementById("dialogue-text").textContent = d.data.lines[d.line];
  updateAdvanceHint(d.data, d.line);
}

function showChoices(choices) {
  game.dialogue.showingChoices = true;
  document.getElementById("dialogue-advance").style.display = "none";
  const container = document.getElementById("dialogue-choices");
  container.innerHTML = "";
  choices.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = c.text;
    if (c.action === "complete") {
      btn.classList.add("choice-btn--primary");
      btn.addEventListener("click", () => {
        closeDialogue();
        showCompletion();
      });
    } else {
      btn.addEventListener("click", closeDialogue);
    }
    container.appendChild(btn);
  });
}

function showCompletion() {
  game.running = false;
  document.getElementById("completion-screen").classList.add("active");
}

function closeDialogue() {
  game.dialogue = null;
  document.getElementById("dialogue-box").classList.remove("active");
}

function restartGame() {
  document.getElementById("completion-screen").classList.remove("active");
  game.visited.clear();
  updateQuestHUD();
  game.player.x = 360;
  game.player.y = 810;
  game.player.dir = "up";
  game.camera.x = 0;
  game.camera.y = 0;
  game.dialogue = null;
  game.running = true;
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════
function render(ts) {
  const cx = game.camera.x | 0;
  const cy = game.camera.y | 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cx, -cy);

  drawRegions();
  drawDecorations();
  drawGrid();
  drawLocations(ts);
  drawPlayer(ts);

  ctx.restore();
  drawMinimap(cx, cy);
}

// ── Mapa ─────────────────────────────────────────
function drawRegions() {
  if (mapImgLoaded) {
    ctx.drawImage(mapImg, 0, 0, MAP_W, MAP_H);
  } else {
    ctx.fillStyle = "#c2ad8a";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

function drawDecorations() {}
function drawGrid() {}

// ── Locais ───────────────────────────────────────
function drawLocations(ts) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const loc of LOCATIONS) {
    const near = game.nearLocation?.id === loc.id;
    const pulse = 0.5 + 0.5 * Math.sin(ts * 0.004);

    if (near) {
      ctx.beginPath();
      ctx.arc(loc.x, loc.y, 32 + pulse * 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(240,208,128,${0.35 * pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(loc.x, loc.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = near ? "rgba(16,36,68,0.96)" : "rgba(6,14,26,0.85)";
    ctx.fill();
    ctx.strokeStyle = near ? "#f0d080" : loc.color;
    ctx.lineWidth = near ? 2.5 : 1.5;
    ctx.stroke();

    ctx.font = "15px serif";
    ctx.fillStyle = near ? "#f0d080" : loc.color;
    ctx.fillText(loc.icon, loc.x, loc.y + 1);

    ctx.textBaseline = "top";
    ctx.font = `${near ? 600 : 400} 10px Cinzel, serif`;
    ctx.fillStyle = near ? "#f0d080" : "rgba(220,200,155,0.7)";
    ctx.fillText(loc.label, loc.x, loc.y + 28);
    ctx.textBaseline = "middle";

    // Checkmark para NPCs já visitados
    if (game.visited.has(loc.id)) {
      ctx.beginPath();
      ctx.arc(loc.x + 16, loc.y - 16, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#2ecc71";
      ctx.fill();
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", loc.x + 16, loc.y - 16);
      ctx.textBaseline = "middle";
    }
  }
}

// ── Jogador (sprite Pedro Álvares Cabral) ────────
function drawPlayer(ts) {
  const p = game.player;
  const bob = p.moving ? Math.sin(ts * 0.009) * 1.5 : 0;

  if (!playerSpriteLoaded) {
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(
      { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir],
    );
    ctx.shadowColor = "rgba(240,208,128,0.65)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(19, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fillStyle = "#f0d080";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#7a2a0a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 2 frames por direção: 0=idle, 1=passo — alterna a ~5fps ao mover
  const frame = p.moving ? Math.floor(ts / 180) % 2 : 0;
  const [sx, sy, sw, sh] = SPR.frames[p.dir][frame];

  ctx.save();
  ctx.translate(p.x, p.y + bob);

  // Sombra no chão
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 4, SPR.dw / 2 - 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Âncora nos pés (bottom-center)
  ctx.drawImage(
    playerSprite,
    sx,
    sy,
    sw,
    sh,
    -SPR.dw / 2,
    -SPR.dh,
    SPR.dw,
    SPR.dh,
  );

  ctx.restore();
}

// ── Minimapa ─────────────────────────────────────
function drawMinimap(cx, cy) {
  const mw = 160,
    mh = 115;
  const mx = canvas.width - mw - 16,
    my = 16;
  const sx = mw / MAP_W,
    sy = mh / MAP_H;

  ctx.fillStyle = "rgba(6,14,26,0.9)";
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "rgba(201,168,76,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);

  ctx.globalAlpha = 0.75;
  for (const r of REGIONS) {
    ctx.fillStyle = r.color;
    ctx.fillRect(mx, my + r.y0 * sy, mw, (r.y1 - r.y0) * sy);
  }
  ctx.globalAlpha = 1;

  // Pontos dos locais
  for (const loc of LOCATIONS) {
    ctx.beginPath();
    ctx.arc(mx + loc.x * sx, my + loc.y * sy, 2, 0, Math.PI * 2);
    ctx.fillStyle = loc.color;
    ctx.fill();
  }

  // Viewport rect
  ctx.strokeStyle = "rgba(240,208,128,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mx + cx * sx,
    my + cy * sy,
    canvas.width * sx,
    canvas.height * sy,
  );

  // Ponto do jogador
  ctx.beginPath();
  ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#f0d080";
  ctx.shadowColor = "#f0d080";
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = "8px Cinzel, serif";
  ctx.fillStyle = "rgba(201,168,76,0.4)";
  ctx.textAlign = "left";
  ctx.fillText("MAPA", mx + 4, my + mh - 4);
}

window.addEventListener("load", startGame);
