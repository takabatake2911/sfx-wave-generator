import { useState, useRef, useCallback, useEffect } from "react";

// ── Aesthetic: dark industrial synth lab ──────────────────────────────────────
const WAVEFORMS = [
  "sine",
  "square",
  "triangle",
  "sawtooth",
  "whistle",
  "white",
  "pink",
  "brown",
];
const PRESETS = {
  Explosion: {
    attack: 0.01,
    decay: 1.8,
    frequency: 80,
    freqSweep: -60,
    waveform: "brown",
    bitCrush: 6,
    tremoloDepth: 0.4,
    tremoloFreq: 4,
    vibratoDepth: 0,
    vibratoFreq: 0,
  },
  Laser: {
    attack: 0,
    decay: 0.3,
    frequency: 1800,
    freqSweep: -1600,
    waveform: "square",
    bitCrush: 16,
    tremoloDepth: 0,
    tremoloFreq: 0,
    vibratoDepth: 0,
    vibratoFreq: 0,
  },
  Coin: {
    attack: 0,
    decay: 0.15,
    frequency: 1200,
    freqSweep: 400,
    waveform: "square",
    bitCrush: 8,
    tremoloDepth: 0,
    tremoloFreq: 0,
    vibratoDepth: 0,
    vibratoFreq: 0,
  },
  "Power Up": {
    attack: 0.05,
    decay: 0.8,
    frequency: 300,
    freqSweep: 800,
    waveform: "sawtooth",
    bitCrush: 12,
    tremoloDepth: 0,
    tremoloFreq: 0,
    vibratoDepth: 10,
    vibratoFreq: 8,
  },
  Thump: {
    attack: 0.01,
    decay: 0.5,
    frequency: 200,
    freqSweep: -180,
    waveform: "sine",
    bitCrush: 16,
    tremoloDepth: 0,
    tremoloFreq: 0,
    vibratoDepth: 0,
    vibratoFreq: 0,
  },
  Zap: {
    attack: 0,
    decay: 0.2,
    frequency: 2000,
    freqSweep: -1500,
    waveform: "white",
    bitCrush: 8,
    tremoloDepth: 0.6,
    tremoloFreq: 18,
    vibratoDepth: 0,
    vibratoFreq: 0,
  },
};

const INIT = {
  attack: 0.01,
  decay: 0.4,
  frequency: 440,
  freqSweep: 0,
  waveform: "square",
  bitCrush: 16,
  tremoloDepth: 0,
  tremoloFreq: 5,
  vibratoDepth: 0,
  vibratoFreq: 5,
};

// ── Audio engine ──────────────────────────────────────────────────────────────
async function renderSound(p) {
  const duration = Math.max(p.attack + p.decay + 0.05, 0.1);
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(sr * duration), sr);

  let source;
  const isNoise = ["white", "pink", "brown", "whistle"].includes(p.waveform);

  if (isNoise) {
    const bufLen = Math.ceil(sr * duration);
    const noiseBuffer = ctx.createBuffer(1, bufLen, sr);
    const data = noiseBuffer.getChannelData(0);
    if (p.waveform === "white") {
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    } else if (p.waveform === "pink") {
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufLen; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (p.waveform === "brown") {
      let last = 0;
      for (let i = 0; i < bufLen; i++) {
        const w = (Math.random() * 2 - 1) * 0.02;
        last = Math.max(-1, Math.min(1, last + w));
        data[i] = last * 3.5;
      }
    } else {
      // whistle
      for (let i = 0; i < bufLen; i++) {
        const t = i / sr;
        data[i] =
          Math.sin(
            2 * Math.PI * (p.frequency + p.freqSweep * (t / duration)) * t,
          ) *
            0.5 +
          Math.sin(
            2 * Math.PI * (p.frequency * 2 + p.freqSweep * (t / duration)) * t,
          ) *
            0.25;
      }
    }
    source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
  } else {
    source = ctx.createOscillator();
    source.type = p.waveform;
    source.frequency.setValueAtTime(p.frequency, 0);
    source.frequency.linearRampToValueAtTime(
      p.frequency + p.freqSweep,
      duration,
    );
  }

  // Vibrato
  let vibratoGain;
  if (p.vibratoDepth > 0 && p.vibratoFreq > 0 && !isNoise) {
    const vibratoOsc = ctx.createOscillator();
    vibratoOsc.frequency.value = p.vibratoFreq;
    vibratoGain = ctx.createGain();
    vibratoGain.gain.value = p.vibratoDepth;
    vibratoOsc.connect(vibratoGain);
    vibratoGain.connect(source.frequency);
    vibratoOsc.start(0);
    vibratoOsc.stop(duration);
  }

  // Envelope
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, 0);
  envGain.gain.linearRampToValueAtTime(0.8, p.attack);
  envGain.gain.linearRampToValueAtTime(0, p.attack + p.decay);

  // Tremolo
  let tremoloOut = envGain;
  if (p.tremoloDepth > 0 && p.tremoloFreq > 0) {
    const tremoloOsc = ctx.createOscillator();
    tremoloOsc.frequency.value = p.tremoloFreq;
    const trGain = ctx.createGain();
    trGain.gain.value = p.tremoloDepth;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 1;
    tremoloOsc.connect(trGain);
    trGain.connect(tremoloGain.gain);
    tremoloOsc.start(0);
    tremoloOsc.stop(duration);
    envGain.connect(tremoloGain);
    tremoloOut = tremoloGain;
  }

  // Bit crush (waveshaper approximation)
  const crusher = ctx.createWaveShaper();
  const steps = Math.pow(2, p.bitCrush);
  const curve = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) {
    const x = i / 32768 - 1;
    curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
  }
  crusher.curve = curve;

  source.connect(envGain);
  tremoloOut.connect(crusher);
  crusher.connect(ctx.destination);
  source.start(0);
  if (source.stop) source.stop(duration);

  const rendered = await ctx.startRendering();
  return rendered;
}

function audioBufferToWav(buffer) {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const len = data.length;
  const ab = new ArrayBuffer(44 + len * 2);
  const view = new DataView(ab);
  const writeStr = (o, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + len * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return ab;
}

// ── UI Components ─────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;600;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0a0a0c;color:#e0e0e0;font-family:'Barlow Condensed',sans-serif;}
  :root{
    --bg:#0a0a0c;--panel:#111116;--border:#2a2a35;--accent:#00ff88;
    --accent2:#ff4466;--accent3:#4499ff;--muted:#555566;--text:#dde0e8;
  }
  .app{min-height:100vh;padding:16px;max-width:820px;margin:0 auto;}
  .header{display:flex;align-items:baseline;gap:12px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:14px;flex-wrap:wrap;}
  .logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;letter-spacing:0.08em;color:var(--accent);text-transform:uppercase;}
  .logo span{color:var(--accent2);}
  .sub{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.12em;text-transform:uppercase;}
  .tabs{display:flex;gap:2px;margin-bottom:16px;}
  .tab{flex:1;padding:10px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;text-align:center;}
  .tab.active{background:var(--accent);color:#000;border-color:var(--accent);}
  .tab:hover:not(.active){color:var(--text);border-color:#444;}
  .panel{background:var(--panel);border:1px solid var(--border);padding:14px;margin-bottom:12px;}
  .panel-title{font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;}
  .param{display:flex;flex-direction:column;gap:6px;}
  .param-label{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:0.12em;text-transform:uppercase;}
  .param-label span{color:var(--accent);margin-left:6px;}
  .param-row{display:flex;align-items:center;gap:8px;}
  .slider-wrap{flex:1;position:relative;height:18px;display:flex;align-items:center;min-width:0;}
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:var(--border);outline:none;cursor:pointer;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;background:var(--accent);border-radius:0;cursor:pointer;transition:background .15s;}
  input[type=range]::-webkit-slider-thumb:hover{background:#fff;}
  input[type=number]{width:58px;flex-shrink:0;background:#0d0d12;border:1px solid var(--border);color:var(--text);padding:4px 6px;font-family:'Share Tech Mono',monospace;font-size:11px;text-align:right;}
  input[type=number]:focus{outline:none;border-color:var(--accent);}
  select{width:100%;background:#0d0d12;border:1px solid var(--border);color:var(--text);padding:8px 10px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase;}
  select:focus{outline:none;border-color:var(--accent);}
  .waveform-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
  .wf-btn{padding:10px 4px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:0.08em;text-align:center;cursor:pointer;text-transform:uppercase;transition:all .15s;}
  .wf-btn.active{background:var(--accent);color:#000;border-color:var(--accent);}
  .wf-btn:hover:not(.active){border-color:var(--accent);color:var(--accent);}
  .preset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;}
  .preset-btn{padding:10px 6px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;}
  .preset-btn:hover{border-color:var(--accent3);color:var(--accent3);}
  .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
  .btn-play{padding:16px;background:var(--accent);border:none;color:#000;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;transition:all .15s;touch-action:manipulation;}
  .btn-play:hover{background:#00ffaa;}
  .btn-play:active{background:#00cc66;transform:scale(0.98);}
  .btn-play.loading{background:var(--muted);cursor:default;animation:pulse 0.6s ease-in-out infinite alternate;}
  @keyframes pulse{from{opacity:0.5;}to{opacity:1;}}
  .btn-random{padding:16px;background:transparent;border:1px solid var(--accent2);color:var(--accent2);font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;transition:all .15s;touch-action:manipulation;}
  .btn-random:hover{background:var(--accent2);color:#000;}
  .viz{width:100%;height:56px;background:#0d0d12;border:1px solid var(--border);display:block;margin-bottom:12px;}
  /* History */
  .history-empty{font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--muted);text-align:center;padding:40px;letter-spacing:0.1em;}
  .hist-item{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:8px 10px;align-items:center;padding:10px 12px;border:1px solid var(--border);margin-bottom:8px;background:#0d0d12;transition:border-color .15s;}
  .hist-item:hover{border-color:#333;}
  .hist-left{display:flex;align-items:center;gap:8px;}
  .hist-num{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);min-width:22px;}
  .hist-info{min-width:0;}
  .hist-wf{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text);}
  .hist-params{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .hist-actions{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;}
  .hist-btn{flex:1;min-width:52px;padding:8px 10px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:0.06em;cursor:pointer;text-transform:uppercase;transition:all .15s;text-align:center;touch-action:manipulation;}
  .hist-btn:hover{border-color:var(--accent3);color:var(--accent3);}
  .hist-btn.dl:hover{border-color:var(--accent);color:var(--accent);}
  .hist-canvas{width:64px;height:28px;flex-shrink:0;}
  .divider{border:none;border-top:1px solid var(--border);margin:16px 0;}


  /* Confirm Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;}
  .modal{background:var(--panel);border:1px solid var(--accent2);padding:28px 24px;max-width:340px;width:100%;}
  .modal-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent2);margin-bottom:10px;}
  .modal-body{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:24px;letter-spacing:0.04em;}
  .modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .modal-cancel{padding:12px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;}
  .modal-cancel:hover{border-color:var(--text);color:var(--text);}
  .modal-confirm{padding:12px;background:var(--accent2);border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;}
  .modal-confirm:hover{background:#ff2244;}
  @media(max-width:480px){
    .app{padding:10px;}
    .grid2{grid-template-columns:1fr;}
    .waveform-grid{grid-template-columns:repeat(4,1fr);}
    .preset-grid{grid-template-columns:repeat(2,1fr);}
    .hist-params{font-size:8px;}
    input[type=number]{width:52px;font-size:10px;}
  }
`;

function MiniWaveform({ audioBuffer, params, width = 64, height = 28 }) {
  const canvasRef = useRef(null);
  const [buf, setBuf] = useState(audioBuffer);

  useEffect(() => {
    if (audioBuffer) {
      const id = setTimeout(() => setBuf(audioBuffer), 0);
      return () => clearTimeout(id);
    }
    if (!params) return;
    let cancelled = false;
    renderSound(params).then((b) => {
      if (!cancelled) setBuf(b);
    });
    return () => {
      cancelled = true;
    };
  }, [audioBuffer, params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    if (!buf) {
      ctx.strokeStyle = "#2a2a35";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }
    const data = buf.getChannelData(0);
    const step = Math.ceil(data.length / width);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < width; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const v = Math.abs(data[i * step + j] || 0);
        if (v > max) max = v;
      }
      const y = height / 2 - max * (height / 2) * 0.9;
      const y2 = height / 2 + max * (height / 2) * 0.9;
      if (i === 0) ctx.moveTo(i, height / 2);
      else {
        ctx.moveTo(i, y);
        ctx.lineTo(i, y2);
      }
    }
    ctx.stroke();
  }, [buf, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="hist-canvas"
    />
  );
}

function LiveViz({ audioBuffer }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!audioBuffer) {
      ctx.strokeStyle = "#2a2a35";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      return;
    }
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / W);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#00ff88";
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      const avg = sum / step;
      const y = H / 2 - avg * (H / 2) * 0.9;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
  }, [audioBuffer]);
  return <canvas ref={canvasRef} className="viz" width={760} height={60} />;
}

function ParamRow({ label, value, min, max, step, onChange }) {
  return (
    <div className="param">
      <div className="param-label">
        {label}
        <span>{typeof value === "number" ? value : ""}</span>
      </div>
      <div className="param-row">
        <div className="slider-wrap">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
        </div>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [p, setP] = useState({ ...INIT });
  const [loading, setLoading] = useState(false);
  const [lastBuffer, setLastBuffer] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("sfxlab_history");
      if (!saved) return [];
      // Stored entries have no buffer yet — regenerated on demand
      return JSON.parse(saved).map((item) => ({
        id: item.id,
        params: item.params,
        buffer: null,
      }));
    } catch {
      return [];
    }
  });
  const playingRef = useRef(null);

  useEffect(() => {
    try {
      const serializable = history.map((item) => ({
        id: item.id,
        params: item.params,
      }));
      localStorage.setItem("sfxlab_history", JSON.stringify(serializable));
    } catch {
      /* quota exceeded — fail silently */
    }
  }, [history]);

  const set = useCallback(
    (key) => (val) => setP((prev) => ({ ...prev, [key]: val })),
    [],
  );

  const playBuffer = useCallback(async (buf) => {
    if (playingRef.current) {
      playingRef.current.stop();
    }
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    playingRef.current = src;
  }, []);

  const playHistoryItem = useCallback(
    async (item) => {
      let buf = item.buffer;
      if (!buf) {
        buf = await renderSound(item.params);
        setHistory((prev) =>
          prev.map((h) => (h.id === item.id ? { ...h, buffer: buf } : h)),
        );
      }
      await playBuffer(buf);
    },
    [playBuffer],
  );

  const handlePlay = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const buf = await renderSound(p);
      setLastBuffer(buf);
      await playBuffer(buf);
      const entry = { id: Date.now(), params: { ...p }, buffer: buf };
      setHistory((prev) => [entry, ...prev].slice(0, 30));
    } finally {
      setLoading(false);
    }
  }, [p, loading, playBuffer]);

  const handleRandom = useCallback(() => {
    setP({
      attack: parseFloat((Math.random() * 0.3).toFixed(3)),
      decay: parseFloat((0.1 + Math.random() * 2).toFixed(2)),
      frequency: Math.round(50 + Math.random() * 2000),
      freqSweep: Math.round((Math.random() * 2 - 1) * 1500),
      waveform: WAVEFORMS[Math.floor(Math.random() * WAVEFORMS.length)],
      bitCrush: Math.floor(4 + Math.random() * 13),
      tremoloDepth: parseFloat((Math.random() * 0.8).toFixed(2)),
      tremoloFreq: parseFloat((Math.random() * 18).toFixed(1)),
      vibratoDepth: parseFloat((Math.random() * 30).toFixed(1)),
      vibratoFreq: parseFloat((Math.random() * 15).toFixed(1)),
    });
  }, []);

  const downloadWav = useCallback(async (item) => {
    let buf = item.buffer;
    if (!buf) {
      buf = await renderSound(item.params);
      setHistory((prev) =>
        prev.map((h) => (h.id === item.id ? { ...h, buffer: buf } : h)),
      );
    }
    const wav = audioBufferToWav(buf);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sfx_${item.id}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const [showConfirm, setShowConfirm] = useState(false);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem("sfxlab_history");
    setShowConfirm(false);
  }, []);

  const applyPreset = useCallback((name) => {
    setP({ ...INIT, ...PRESETS[name] });
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="logo">
            Sound<span>FX</span> Lab
          </div>
          <div className="sub">Retro Sound Effect Generator</div>
        </div>

        <div className="tabs">
          {["Generator", "History"].map((t, i) => (
            <button
              key={t}
              className={`tab${tab === i ? " active" : ""}`}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <>
            <div className="panel">
              <div className="panel-title">// Presets</div>
              <div className="preset-grid">
                {Object.keys(PRESETS).map((name) => (
                  <button
                    key={name}
                    className="preset-btn"
                    onClick={() => applyPreset(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">// Waveform</div>
              <div className="waveform-grid">
                {WAVEFORMS.map((wf) => (
                  <button
                    key={wf}
                    className={`wf-btn${p.waveform === wf ? " active" : ""}`}
                    onClick={() => set("waveform")(wf)}
                  >
                    {wf}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">// Envelope</div>
              <div className="grid2">
                <ParamRow
                  label="Attack (s)"
                  value={p.attack}
                  min={0}
                  max={2}
                  step={0.001}
                  onChange={set("attack")}
                />
                <ParamRow
                  label="Decay (s)"
                  value={p.decay}
                  min={0.01}
                  max={4}
                  step={0.01}
                  onChange={set("decay")}
                />
                <ParamRow
                  label="Frequency (Hz)"
                  value={p.frequency}
                  min={20}
                  max={5000}
                  step={1}
                  onChange={set("frequency")}
                />
                <ParamRow
                  label="Freq Sweep (Hz)"
                  value={p.freqSweep}
                  min={-3000}
                  max={3000}
                  step={1}
                  onChange={set("freqSweep")}
                />
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">// Effects</div>
              <div className="grid2">
                <ParamRow
                  label="Bit Crush (bits)"
                  value={p.bitCrush}
                  min={2}
                  max={16}
                  step={1}
                  onChange={set("bitCrush")}
                />
                <ParamRow
                  label="Tremolo Depth"
                  value={p.tremoloDepth}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={set("tremoloDepth")}
                />
                <ParamRow
                  label="Tremolo Freq (Hz)"
                  value={p.tremoloFreq}
                  min={0}
                  max={30}
                  step={0.1}
                  onChange={set("tremoloFreq")}
                />
                <ParamRow
                  label="Vibrato Depth (Hz)"
                  value={p.vibratoDepth}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={set("vibratoDepth")}
                />
                <ParamRow
                  label="Vibrato Freq (Hz)"
                  value={p.vibratoFreq}
                  min={0}
                  max={30}
                  step={0.1}
                  onChange={set("vibratoFreq")}
                />
              </div>
            </div>

            <LiveViz audioBuffer={lastBuffer} />

            <div className="actions">
              <button
                className={`btn-play${loading ? " loading" : ""}`}
                onClick={handlePlay}
              >
                {loading ? "Rendering..." : "▶ Play & Save"}
              </button>
              <button className="btn-random" onClick={handleRandom}>
                ⟳ Random
              </button>
            </div>
          </>
        )}

        {tab === 1 && (
          <div className="panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
              }}
            >
              <div className="panel-title" style={{ margin: 0 }}>
                // History — up to 30 sounds
              </div>
              {history.length > 0 && (
                <button
                  className="hist-btn"
                  style={{
                    color: "var(--accent2)",
                    borderColor: "var(--accent2)",
                    padding: "4px 12px",
                    flexShrink: 0,
                  }}
                  onClick={() => setShowConfirm(true)}
                >
                  Clear All
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="history-empty">
                NO SOUNDS YET — GO GENERATE SOME
              </div>
            ) : (
              history.map((item, idx) => (
                <div key={item.id} className="hist-item">
                  <div className="hist-left">
                    <div className="hist-num">#{history.length - idx}</div>
                    <MiniWaveform
                      audioBuffer={item.buffer}
                      params={item.params}
                    />
                  </div>
                  <div className="hist-info">
                    <div className="hist-wf">{item.params.waveform}</div>
                    <div className="hist-params">
                      {item.params.frequency}Hz · sw{item.params.freqSweep} · A
                      {item.params.attack}s D{item.params.decay}s ·{" "}
                      {item.params.bitCrush}bit
                    </div>
                  </div>
                  <div className="hist-actions">
                    <button
                      className="hist-btn"
                      onClick={() => playHistoryItem(item)}
                    >
                      ▶ Play
                    </button>
                    <button
                      className="hist-btn"
                      onClick={() => {
                        setP({ ...item.params });
                        setTab(0);
                      }}
                    >
                      Load
                    </button>
                    <button
                      className="hist-btn dl"
                      onClick={() => downloadWav(item)}
                    >
                      WAV ↓
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Clear History?</div>
            <div className="modal-body">
              All 30 slots of saved history will be permanently deleted. This
              cannot be undone.
            </div>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button className="modal-confirm" onClick={clearHistory}>
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
