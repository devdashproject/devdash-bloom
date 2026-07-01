import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Flower2, Layers, LogOut, Volume2, VolumeX, Wind, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGarden, useMe, useProjects } from '../hooks';
import { skyPhase, timeAgo } from '../lib/helpers';
import type { GardenBead } from '../types';
import { GardenEngine, stageOf } from '../garden/engine';

const BEDS_KEY = 'dd_bloom_beds';
const PLANT_CAP = 140;

// Trim to a lively-but-uncrowded meadow. Keep ALL active work, then guarantee a generous
// share of recent blooms (completed = the whole point), then fill with pending seeds.
const BLOOM_QUOTA = 48;
function selectPlants(beads: GardenBead[]): GardenBead[] {
  const active = beads.filter((b) => ['in_progress', 'blocked', 'failed'].includes(b.status));
  const pending = beads.filter((b) => b.status === 'pending')
    .sort((a, z) => a.priority - z.priority || +new Date(z.updatedAt) - +new Date(a.updatedAt));
  const done = beads.filter((b) => b.status === 'completed')
    .sort((a, z) => +new Date(z.updatedAt) - +new Date(a.updatedAt));
  const out = [...active];
  // reserve space for blooms up front so completions always flower
  const bloomQuota = Math.min(BLOOM_QUOTA, Math.max(0, PLANT_CAP - out.length));
  out.push(...done.slice(0, bloomQuota));
  for (const b of pending) { if (out.length >= PLANT_CAP) break; out.push(b); }
  for (const b of done.slice(bloomQuota)) { if (out.length >= PLANT_CAP) break; out.push(b); }
  return out;
}

export default function Garden() {
  const { user, logout } = useAuth();
  useMe();
  const { data: projects = [] } = useProjects();
  const [selected, setSelected] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<{ bead: GardenBead; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<GardenBead | null>(null);
  const [census, setCensus] = useState({ sprout: 0, growing: 0, bloom: 0, wilted: 0, ash: 0, total: 0 });
  const [blooms, setBlooms] = useState(0);
  const [sound, setSound] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GardenEngine | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // default beds = all projects, persisted
  useEffect(() => {
    if (!projects.length) return;
    const saved = localStorage.getItem(BEDS_KEY);
    if (saved) {
      const ids = JSON.parse(saved).filter((id: string) => projects.some((p) => p.id === id));
      setSelected(ids.length ? ids : projects.map((p) => p.id));
    } else setSelected(projects.map((p) => p.id));
  }, [projects]);

  const { data: beads = [] } = useGarden(projects, selected);

  function chime() {
    if (!soundRef.current) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ac = audioRef.current;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'sine'; o.frequency.value = 520 + Math.random() * 320;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.5);
    } catch { /* ignore */ }
  }

  // engine lifecycle
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new GardenEngine(canvasRef.current, {
      onHover: (bead, sx, sy) => setTooltip(bead ? { bead, x: sx, y: sy } : null),
      onBloom: (n) => { setBlooms(n); chime(); },
    });
    engine.setSky(skyPhase());
    engine.start();
    engineRef.current = engine;

    const onResize = () => engine.resize();
    const onMove = (e: MouseEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      engine.setPointer(e.clientX - r.left, e.clientY - r.top);
    };
    const onLeave = () => { engine.setPointer(-1, -1); setTooltip(null); };
    const onClick = (e: MouseEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      const hit = engine.hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit) setPicked(hit);
    };
    window.addEventListener('resize', onResize);
    const cv = canvasRef.current;
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseleave', onLeave);
    cv.addEventListener('click', onClick);

    const censusTimer = setInterval(() => setCensus(engine.census()), 600);
    const skyTimer = setInterval(() => engine.setSky(skyPhase()), 60_000);

    return () => {
      engine.stop();
      window.removeEventListener('resize', onResize);
      cv.removeEventListener('mousemove', onMove);
      cv.removeEventListener('mouseleave', onLeave);
      cv.removeEventListener('click', onClick);
      clearInterval(censusTimer); clearInterval(skyTimer);
    };
  }, []);

  // push data into the engine
  const planted = useMemo(() => selectPlants(beads), [beads]);
  useEffect(() => { engineRef.current?.setBeads(planted); }, [planted]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-pointer" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <Flower2 className="w-6 h-6 text-petal-pink drop-shadow" />
          <div>
            <h1 className="text-lg font-extrabold text-gradient leading-none">Bloom</h1>
            <p className="text-[11px] text-white/50 mt-0.5">
              {user?.displayName ? `${user.displayName.split(' ')[0]}'s garden` : 'your garden'} · {timeOfDayLabel()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <BedsMenu projects={projects} selected={selected} onChange={(ids) => { setSelected(ids); localStorage.setItem(BEDS_KEY, JSON.stringify(ids)); }} />
          <IconBtn title="A gentle breeze" onClick={() => engineRef.current?.gust()}><Wind className="w-4 h-4" /></IconBtn>
          <IconBtn title={sound ? 'Mute chimes' : 'Bloom chimes'} onClick={() => setSound((s) => !s)}>
            {sound ? <Volume2 className="w-4 h-4 text-petal-gold" /> : <VolumeX className="w-4 h-4" />}
          </IconBtn>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-white/15" />
            : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-petal-pink to-petal-violet" />}
          <IconBtn title="Sign out" onClick={logout}><LogOut className="w-4 h-4" /></IconBtn>
        </div>
      </div>

      {/* HUD census (bottom-left) */}
      <div className="absolute bottom-4 left-4 glass rounded-2xl px-4 py-3 flex items-center gap-4 text-sm animate-fade-up">
        <Stat color="#5cc98f" label="seeds" v={census.sprout} />
        <Stat color="#9be88a" label="growing" v={census.growing} pulse />
        <Stat color="#ff7eb6" label="bloomed" v={census.bloom} />
        <Stat color="#7e9b6e" label="wilted" v={census.wilted} />
        {blooms > 0 && <div className="pl-3 border-l border-white/10 text-petal-gold text-xs font-semibold">✦ {blooms} bloomed this visit</div>}
      </div>

      {/* Legend (bottom-right) */}
      <div className="absolute bottom-4 right-4 glass rounded-2xl px-3.5 py-2.5 text-[11px] text-white/60 space-y-1 animate-fade-up hidden sm:block">
        <Leg c="#5cc98f" t="sprout = pending" />
        <Leg c="#9be88a" t="growing = in progress" />
        <Leg c="#ff7eb6" t="bloom = completed" />
        <Leg c="#7e9b6e" t="wilted = blocked" />
        <Leg c="#ffe9a8" t="firefly = in progress" />
      </div>

      {/* Hover tooltip */}
      {tooltip && !picked && (
        <div
          className="absolute z-20 glass rounded-xl px-3 py-2 max-w-xs pointer-events-none animate-fade-up"
          style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 260), top: Math.max(tooltip.y - 10, 60) }}
        >
          <p className="text-xs font-semibold text-white/90 line-clamp-2">{tooltip.bead.subject}</p>
          <p className="text-[11px] text-white/45 mt-0.5">{tooltip.bead.projectName} · {tooltip.bead.status.replace('_', ' ')} · {timeAgo(tooltip.bead.updatedAt)}</p>
        </div>
      )}

      {/* Picked detail card */}
      {picked && <DetailCard bead={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function timeOfDayLabel() {
  const p = skyPhase();
  return p === 'dawn' ? 'dawn' : p === 'day' ? 'daylight' : p === 'dusk' ? 'golden hour' : 'moonlight';
}

function Stat({ color, label, v, pulse }: { color: string; label: string; v: number; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${pulse ? 'animate-breathe' : ''}`} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="font-bold text-white/90 tabular-nums">{v}</span>
      <span className="text-white/45 text-xs">{label}</span>
    </div>
  );
}

function Leg({ c, t }: { c: string; t: string }) {
  return <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{t}</div>;
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-xl glass hover:bg-white/15 text-white/70 transition-colors">
      {children}
    </button>
  );
}

function DetailCard({ bead, onClose }: { bead: GardenBead; onClose: () => void }) {
  const stage = stageOf(bead.status);
  return (
    <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-24 w-[min(92vw,420px)] glass rounded-2xl p-5 shadow-bloom animate-fade-up">
      <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-white/50"><X className="w-4 h-4" /></button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-petal-violet">{bead.projectName}</span>
        <span className="text-[11px] text-white/40">· {stage} · {bead.status.replace('_', ' ')}</span>
      </div>
      <h2 className="text-base font-bold text-white/95 leading-snug mb-3">{bead.subject}</h2>
      <div className="flex items-center justify-between text-[11px] text-white/45">
        <span>updated {timeAgo(bead.updatedAt)} · planted {timeAgo(bead.createdAt)}</span>
        <a
          href={`https://dev-dash-server-production.up.railway.app/projects/${bead.projectId}`}
          target="_blank" rel="noreferrer"
          className="text-petal-pink hover:text-petal-gold transition-colors font-semibold"
        >Open in DevDash ↗</a>
      </div>
    </div>
  );
}

function BedsMenu({ projects, selected, onChange }: { projects: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const all = selected.length === projects.length && projects.length > 0;
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
  }, []);
  const label = all ? 'All beds' : selected.length === 1 ? projects.find((p) => p.id === selected[0])?.name ?? '1 bed' : `${selected.length} beds`;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/15 text-sm text-white/85 transition-colors">
        <Layers className="w-4 h-4 text-petal-sky" /> {label}
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 glass rounded-2xl p-2 shadow-bloom animate-fade-up">
          <div className="flex gap-1 px-1 pb-2">
            <button onClick={() => onChange(projects.map((p) => p.id))} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-petal-violet/20 text-petal-violet hover:bg-petal-violet/30">All</button>
            <button onClick={() => onChange([])} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10">Clear</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {projects.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)} onDoubleClick={() => onChange([p.id])} title="click to toggle · double-click for only this"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 text-left">
                  <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-petal-violet border-petal-violet' : 'border-white/20'}`}>
                    {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-sm text-white/80 truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
