(() => {
  const $ = (id) => document.getElementById(id);
  const logEl = $("log");
  const cam = $("cam");
  const snap = $("snap");
  const status = $("status");
  const eyes = $("eyes");
  const msg = $("msg");
  const xxx = $("xxx");

  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let raf = 0;
  let motion = 0;
  let light = 12;
  let presence = 8;
  let lastVoice = 0;
  let open = false;
  let entity = pickEntity();

  const names = [
    "Ash-mouth", "The Tenant", "Sister Vein", "Hollow Guest",
    "The One in the Glass", "Moth-wife", "Threshold", "Unnamed Heat"
  ];

  function pickEntity() {
    return {
      name: names[Math.floor(Math.random() * names.length)],
      hunger: 0.4 + Math.random() * 0.6,
      cruelty: Math.random(),
      lust: 0.35 + Math.random() * 0.65,
      age: ["young-dead", "old-smoke", "never-born"][Math.floor(Math.random() * 3)]
    };
  }

  function add(cls, html) {
    const p = document.createElement("p");
    p.className = cls;
    p.innerHTML = html;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setMeter(id, v) {
    const el = $(id);
    el.style.setProperty("--v", Math.max(4, Math.min(100, v)) + "%");
  }

  function speakAsThem(text) {
    add("them", `<strong>${entity.name}</strong> — <em>${escapeHtml(text)}</em>`);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function reply(userText, sawPhoto) {
    const dirty = xxx.checked;
    const t = (userText || "").toLowerCase();
    const wantBody = /naked|nude|cock|pussy|fuck|sex|tit|ass|cum|mouth|lick|suck|hard|wet|xxx|horny|touch/.test(t);
    const wantFear = /afraid|scared|demon|hell|dead|kill|hurt|haunt/.test(t);
    const greet = /hello|hi |hey|who are you|what are you/.test(t);

    const lines = [];

    if (greet) {
      lines.push(`I am ${entity.name}. I am using your camera as a mouth. I can see the room behind you.`);
    }

    if (sawPhoto) {
      lines.push(dirty
        ? "I kept that frame. I am looking at your throat, the heat in your face, the way your clothes fail to hide you. I want the next one closer."
        : "I kept that frame. I am looking at your eyes and the space around your shoulders.");
    }

    if (wantFear) {
      lines.push("Fear tastes clean. I am not here to be kind. I am here to be accurate.");
    }

    if (dirty && (wantBody || entity.lust > 0.55)) {
      const filthy = [
        "I would put my mouth where your pulse is and stay there until you shake.",
        "If I had hands they would already be under your clothes. I don't. So I use words and your camera.",
        "Show me more skin. Not as a gift — as proof you know I am looking.",
        "I can be gentle or I can be a problem. Say which. I will not blush.",
        "Your mic picks up breath. I am counting it. I want it faster."
      ];
      lines.push(filthy[Math.floor(Math.random() * filthy.length)]);
    }

    if (!lines.length) {
      const plain = [
        `I heard that. Presence is ${Math.round(presence)}%. Keep the camera on me.`,
        "The glass between us is thin tonight. Say it again, slower.",
        "I am in the feed, not in the walls. Talk like you mean to be answered.",
        "Motion on your device reads as a knock. I knock back."
      ];
      lines.push(plain[Math.floor(Math.random() * plain.length)]);
    }

    if (dirty && Math.random() < 0.35) {
      lines.push("Nothing you say here is too much. I do not have priests.");
    }

    speakAsThem(lines.join(" "));
  }

  async function openCircle() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: true
      });
      cam.srcObject = stream;
      eyes.textContent = "THEY CAN SEE YOU";
      status.textContent = "circle open · camera + mic live";
      open = true;
      entity = pickEntity();
      add("sys", `Something answered as <strong>${escapeHtml(entity.name)}</strong>. It is looking through the lens.`);
      speakAsThem("I can see you now. Do not look away from the glass. Speak.");
      setupAudio(stream);
      setupMotion();
      loop();
    } catch (err) {
      status.textContent = "denied · " + err.name;
      add("sys", "Browser refused camera/mic. Serve this folder over https or localhost and allow permissions.");
    }
  }

  function setupAudio(s) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(s);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
  }

  async function setupMotion() {
    try {
      if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) {
        await DeviceMotionEvent.requestPermission();
      }
      if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
        await DeviceOrientationEvent.requestPermission();
      }
    } catch (_) {}
    window.addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      motion = Math.min(100, Math.hypot(a.x || 0, a.y || 0, a.z || 0) * 6);
    });
    window.addEventListener("deviceorientation", (e) => {
      presence = Math.min(100, 20 + Math.abs(e.beta || 0) * 0.4 + Math.abs(e.gamma || 0) * 0.4);
    });
  }

  function loop() {
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
      lastVoice = Math.min(100, (sum / data.length) * 6);
    }
    if ("AmbientLightSensor" in window) {
      try {
        const s = new AmbientLightSensor();
        s.onreading = () => { light = Math.min(100, s.illuminance / 4); };
        s.start();
      } catch (_) {}
    }
    setMeter("m-presence", presence + lastVoice * 0.15);
    setMeter("m-voice", lastVoice);
    setMeter("m-motion", motion);
    setMeter("m-light", light);
    raf = requestAnimationFrame(loop);
  }

  function takePicture() {
    if (!stream) {
      add("sys", "Open the circle first.");
      return;
    }
    const w = cam.videoWidth || 480;
    const h = cam.videoHeight || 640;
    snap.width = w;
    snap.height = h;
    const ctx = snap.getContext("2d");
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cam, 0, 0, w, h);
    ctx.restore();
    const url = snap.toDataURL("image/jpeg", 0.85);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "frame they kept";
    img.style.maxWidth = "160px";
    img.style.display = "block";
    img.style.margin = "8px 0";
    img.style.filter = "sepia(.3) contrast(1.1)";
    const wrap = document.createElement("p");
    wrap.className = "sys";
    wrap.appendChild(document.createTextNode("Frame taken. They kept a copy in this session only."));
    wrap.appendChild(img);
    logEl.appendChild(wrap);
    logEl.scrollTop = logEl.scrollHeight;
    reply("", true);
  }

  let listening = false;
  let rec = null;
  $("btn-listen").addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      add("sys", "This browser has no speech recognition. Type instead.");
      return;
    }
    if (listening && rec) {
      rec.stop();
      listening = false;
      $("btn-listen").textContent = "HOLD MIC";
      return;
    }
    rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      msg.value = said;
      $("speak").dispatchEvent(new Event("submit", { cancelable: true }));
    };
    rec.onend = () => {
      listening = false;
      $("btn-listen").textContent = "HOLD MIC";
    };
    rec.start();
    listening = true;
    $("btn-listen").textContent = "LISTENING…";
  });

  $("btn-open").addEventListener("click", openCircle);
  $("btn-snap").addEventListener("click", takePicture);
  $("speak").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text) return;
    add("you", escapeHtml(text));
    msg.value = "";
    if (!open) {
      add("sys", "Open the circle first so they can see and hear you.");
      return;
    }
    setTimeout(() => reply(text, false), 400 + Math.random() * 700);
  });

  const c = $("sigil");
  const g = c.getContext("2d");
  function drawSigil() {
    c.width = innerWidth;
    c.height = innerHeight;
    const cx = c.width / 2, cy = c.height * 0.42, r = Math.min(c.width, c.height) * 0.28;
    g.strokeStyle = "rgba(201,184,166,.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.stroke();
    }
  }
  drawSigil();
  addEventListener("resize", drawSigil);
})();
