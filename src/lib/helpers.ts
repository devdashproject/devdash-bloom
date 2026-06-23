// Deterministic hash from a string — lets each bead get a stable color/position/seed.
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// A seeded 0..1 pseudo-random generator (mulberry32) — stable per seed.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Local hour -> a phase of day, driving the sky gradient.
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';
export function skyPhase(hour = new Date().getHours()): SkyPhase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

// Top/bottom sky colors per phase (canvas gradient stops).
export const SKY: Record<SkyPhase, [string, string, string]> = {
  // [zenith, horizon, ground]
  dawn: ['#2a2350', '#7e5a86', '#caa36b'],
  day: ['#1f3b73', '#3f74b8', '#7fb98a'],
  dusk: ['#241844', '#7a3b6b', '#c4673f'],
  night: ['#070a1c', '#141a3a', '#1d2a3a'],
};

export const PETALS = ['#ff7eb6', '#ffd166', '#ff8c6b', '#c08bff', '#7fd1ff', '#9be88a'];

export function petalColor(id: string): string {
  return PETALS[hash(id) % PETALS.length];
}
