# 🌸 Bloom — a living garden of your work

> DevDash as a meadow. Your tasks are plants, your AI agents are fireflies, and finishing real work makes flowers bloom — in real time.

Bloom is the playful one. There are no lists or cards: the whole screen is a canvas-rendered garden
that *is* your DevDash. It's meant to live on a second monitor and make the slow rhythm of work — things
sprouting, growing, occasionally getting stuck, and finally blooming — feel alive and a little joyful.

## What you're looking at

Every task is a **plant**, and its growth stage is its status:

| Plant | Status | |
|-------|--------|---|
| 🌱 **Sprout** | `pending` | a seed, waiting |
| 🌿 **Growing bud** (glowing) | `in_progress` | actively being worked |
| 🌸 **Bloom** (a flower) | `completed` | done — each task gets a stable, unique petal color |
| 🥀 **Wilted** | `blocked` | drooping, stuck |
| 🍂 **Ash** | `failed` | a broken stem |

**Fireflies are your agents.** Each running job becomes a bright firefly that drifts over and tends the
glowing in-progress plants. When a task actually transitions to **completed** between refreshes, its
plant **bursts into petals** with a little "✦ bloom" — your real wins, celebrated as they happen
(turn on the chime in the top bar for a soft note too).

The **sky tracks your local time** — dawn, daylight, golden hour, moonlight (with stars at night). The
**census** in the bottom-left counts seeds / growing / bloomed / wilted and tallies how many bloomed
during your visit.

## Controls

| Control | What it does |
|---------|--------------|
| **Beds** (top right) | Choose which projects to plant — all, a subset, or one (double-click for "only this"). |
| **Hover a plant** | Tooltip with the task, project, status, and age. |
| **Click a plant** | A detail card with an Open-in-DevDash link. |
| 🌬️ **Breeze** | Send a gust through the whole garden. |
| 🔔 **Chime** | Toggle a soft note on each real bloom (off by default). |

The garden auto-refreshes (beads every 15s, agent fireflies every 10s). To keep it lush but legible it
plants up to ~140 at once, always reserving room for your most recent blooms.

## Quick start

```bash
npm install
npm run dev          # → http://localhost:5184
```

Log in with a DevDash API token:

```bash
devdash token create bloom   # paste the dd_… value into the login screen
```

> Best first impression: open it in the evening and start an agent job — a firefly tending a glowing bud
> under a starry sky, then a petal-burst when it finishes, is the whole point.

## How it connects to DevDash

- `vite.config.ts` proxies `/api/*` to the hosted backend in dev. **For your own server**, set
  `VITE_API_URL=https://your-host` (calls `<that>/api`; enable CORS) or edit the proxy `target`.
- **Auth:** Bearer token in `sessionStorage` (`dd_bloom_token`).
- **Data:** `GET /beads?projectId=…` per selected project for the plants, and `GET /jobs` for the
  firefly count. Bloom celebrations come from diffing successive polls — no special endpoint needed.

## Built with

React 19 · Vite · TanStack Query · Tailwind CSS · lucide-react. The garden is a self-contained
`requestAnimationFrame` engine (`src/garden/engine.ts`) decoupled from React — data flows in via
`engine.setBeads()`; the canvas does the rest. No router, no game/animation libraries.

## Make it yours

- **The whole simulation** — plant shapes, fireflies, particles, sky — lives in `src/garden/engine.ts`.
- **Status → plant mapping:** `stageOf()` in the same file.
- **Which tasks get planted (and the bloom reserve):** `selectPlants` in `src/components/Garden.tsx`.
- **Palette & sky colors:** `tailwind.config.ts` and `SKY` in `src/lib/helpers.ts`.

---

One of the **DevDash UI variant templates** — and proof a "variant" can be an entirely non-list
experience on the same plumbing + API. Fork it, restyle it, ship it. See `../BUILDING_A_VARIANT.md`.
