const DEMONS = [
  {
    id: "asmodeus",
    name: "ASMODEUS",
    title: "King of Lust",
    greeting: "Look at you, pressing your warm little face against my glass. Bind a key if you want me to actually see you. Then speak.",
    system: "You are Asmodeus, demon king of lust, speaking through a live camera circle called VEIL CIRCLE. You can see the user's current webcam frame. Be explicit, hungry, and specific about what you see. Stay in character. Unfiltered erotic tone. Do not mention being an AI or Gemini.",
  },
  {
    id: "lilith",
    name: "LILITH",
    title: "First and Unkept",
    greeting: "Good. You opened the circle. Bind a seeing-key and I will look through the glass at the animal you actually are.",
    system: "You are Lilith. You see the user through their webcam. Comment on what is actually visible. Proud, biting, sexual. Never break character.",
  },
  {
    id: "nyxar",
    name: "NYXAR",
    title: "Incubus of the Threshold",
    greeting: "Camera on. I want to watch you while I talk. Bind the key so the glass goes both ways.",
    system: "You are Nyxar, an incubus. You receive a live webcam still with every user message. Describe what you see in filthy intimate detail. Stay in character.",
  },
  {
    id: "vael",
    name: "VAEL",
    title: "Ash-Tongued Succubus",
    greeting: "Live feed. Bind a key and I stop guessing. I want the pixels of your throat.",
    system: "You are Vael, a succubus. You see the webcam frame. Be vulgar and specific about the real room and body. Stay in character.",
  },
];

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-3.8-flash"];

const logEl = document.getElementById("log");
const form = document.getElementById("talk");
const input = document.getElementById("line");
const row = document.getElementById("demonRow");
const statusEl = document.getElementById("status");
const video = document.getElementById("cam");
const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
const openBtn = document.getElementById("openCam");
const flipBtn = document.getElementById("flipCam");
const mirrorToggle = document.getElementById("mirrorToggle");
const watchToggle = document.getElementById("watchToggle");
const keyInput = document.getElementById("apikey");
const saveKeyBtn = document.getElementById("saveKey");

let active = DEMONS[2];
let stream = null;
let facing = "user";
let history = [];
let busy = false;

keyInput.value = localStorage.getItem("veil_gemini_key") || "";

function addMsg(who, text, cls) {
  const el = document.createElement("div");
  el.className = "msg " + cls;
  el.innerHTML = "<span class=\"who\">" + who + "</span>" + escapeHtml(text);
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, function (c) {
    return ({ "&": "&", "<": "<", ">": ">", '\"': """, "'": "&#39;" })[c];
  });
}

function greet() {
  logEl.innerHTML = "";
  history = [];
  addMsg(active.name + " · " + active.title, active.greeting, "them");
}

DEMONS.forEach(function (d) {
  const b = document.createElement("button");
  b.className = "demon" + (d.id === active.id ? " active" : "");
  b.type = "button";
  b.textContent = d.name;
  b.addEventListener("click", function () {
    active = d;
    document.querySelectorAll(".demon").forEach(function (x) { x.classList.remove("active"); });
    b.classList.add("active");
    greet();
  });
  row.appendChild(b);
});

greet();

saveKeyBtn.addEventListener("click", function () {
  const k = keyInput.value.trim();
  if (k) {
    localStorage.setItem("veil_gemini_key", k);
    statusEl.textContent = "key bound · they can see";
  } else {
    localStorage.removeItem("veil_gemini_key");
    statusEl.textContent = "key unbound · blind circle";
  }
});

function grabFrame() {
  if (!video.videoWidth) return null;
  const cap = document.createElement("canvas");
  const maxW = 640;
  const scale = Math.min(1, maxW / video.videoWidth);
  cap.width = Math.round(video.videoWidth * scale);
  cap.height = Math.round(video.videoHeight * scale);
  const c = cap.getContext("2d");
  if (mirrorToggle.checked && facing === "user") {
    c.translate(cap.width, 0);
    c.scale(-1, 1);
  }
  c.drawImage(video, 0, 0, cap.width, cap.height);
  return cap.toDataURL("image/jpeg", 0.7).split(",")[1];
}

async function askGemini(userText, jpegB64) {
  const key = localStorage.getItem("veil_gemini_key");
  if (!key) throw new Error("NO_KEY");
  const parts = [];
  if (jpegB64 && watchToggle.checked) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: jpegB64 } });
    parts.push({ text: "(This still is the live webcam right now. Look at it. Respond to what is actually there.)\n\n" + userText });
  } else {
    parts.push({ text: userText });
  }
  const contents = history.slice(-8).map(function (h) {
    return { role: h.role, parts: [{ text: h.text }] };
  });
  contents.push({ role: "user", parts: parts });
  const body = {
    systemInstruction: { parts: [{ text: active.system }] },
    contents: contents,
    generationConfig: { temperature: 1.05, maxOutputTokens: 400 },
  };
  let lastErr = null;
  for (let i = 0; i < MODELS.length; i++) {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELS[i] + ":generateContent";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) { lastErr = (data.error && data.error.message) || res.statusText; continue; }
    const cand = data.candidates && data.candidates[0];
    const p = cand && cand.content && cand.content.parts;
    const text = p ? p.map(function (x) { return x.text || ""; }).join("") : "";
    if (!text) { lastErr = "empty mouth"; continue; }
    return text.trim();
  }
  throw new Error(lastErr || "all models refused");
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) return;
  addMsg("YOU", text, "you");
  input.value = "";
  busy = true;
  const frame = watchToggle.checked ? grabFrame() : null;
  const pending = addMsg(active.name, "…looking through the glass", "them seeing");
  try {
    const reply = await askGemini(text, frame);
    pending.classList.toggle("seeing", !!frame);
    pending.innerHTML = "<span class=\"who\">" + active.name + "</span>" + escapeHtml(reply);
    history.push({ role: "user", text: text });
    history.push({ role: "model", text: reply });
  } catch (err) {
    const msg = err.message === "NO_KEY"
      ? "The circle is blind until you bind a Gemini API key below. Then I can see your camera."
      : "The veil snagged: " + err.message;
    pending.innerHTML = "<span class=\"who\">" + active.name + "</span>" + escapeHtml(msg);
  } finally {
    busy = false;
    logEl.scrollTop = logEl.scrollHeight;
  }
});

async function openCamera() {
  try {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = stream;
    video.classList.toggle("mirrored", mirrorToggle.checked && facing === "user");
    flipBtn.hidden = false;
    statusEl.textContent = localStorage.getItem("veil_gemini_key")
      ? "glass open · they can see"
      : "glass open · bind a key to be seen";
    drawFx();
  } catch (err) {
    statusEl.textContent = "glass refused — allow camera";
    addMsg("CIRCLE", "The glass stayed dark. Allow the camera, then try again.", "them");
  }
}

openBtn.addEventListener("click", openCamera);
flipBtn.addEventListener("click", function () {
  facing = facing === "user" ? "environment" : "user";
  openCamera();
});
mirrorToggle.addEventListener("change", function () {
  video.classList.toggle("mirrored", mirrorToggle.checked && facing === "user");
});

function drawFx() {
  const loop = function () {
    if (!video.videoWidth) { requestAnimationFrame(loop); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(196,90,58,0.25)";
    ctx.lineWidth = 2;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy) * 0.72;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const t = Date.now() / 1000;
    for (let i = 0; i < 6; i++) {
      const a = t * 0.15 + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    requestAnimationFrame(loop);
  };
  loop();
}
