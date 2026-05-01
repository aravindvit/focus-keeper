# Focus Keeper — Design Spec

**Date:** 2026-05-01  
**Status:** Approved  
**Revision:** 3 (analysis warnings integrated)

---

## Overview

Focus Keeper is a personal PWA focus timer grounded in Andrew Huberman's neuroscience protocols. It guides the user through a structured focus ritual: a pre-session visual attention drill, a flexible countdown timer, and a post-session NSDR (non-sleep deep rest) prompt.

The app is intentionally minimal — no accounts, no data persistence, no dashboards. It runs in the browser, installs as a standalone desktop app on macOS, and is installable on iOS/Android home screens once deployed.

---

## Goals

- Run a focused work session with a science-backed pre/post ritual
- Support flexible session lengths (not locked to 25-min Pomodoro)
- Work offline after first load
- Installable as a desktop app (PWA) without an App Store
- Simple enough to build fast, extendable later (history, stats, Capacitor)

## Non-Goals (for this version)

- Session history, streaks, or stats
- User accounts or cloud sync
- Notifications other than the NSDR rest timer
- Caffeine / morning light / other Huberman protocol reminders
- App Store distribution (deferred — use Capacitor later if needed)

---

## Neuroscience Rationale

The three-phase structure maps directly to Huberman's ultradian focus cycle research:

| Phase | Protocol | Mechanism |
|---|---|---|
| Focus Drill | 60-second visual gaze lock | Triggers acetylcholine release in visual cortex; primes top-down attention circuits before cognitive work begins |
| Focus Session | 25–90 min work block | Epinephrine sustains arousal; acetylcholine narrows attention; dopamine maintains motivation. Sessions past ~90 min deplete all three — hence the presets |
| NSDR | 10–20 min non-sleep deep rest | Shifts autonomic state from sympathetic to parasympathetic; Yoga Nidra-style rest has been associated with increased endogenous dopamine release in small imaging studies; may support memory consolidation after the session |

**Why 60 seconds for the drill:** Huberman's protocols describe 60–90 seconds of sustained overt visual focus as sufficient to prime gaze-related acetylcholine circuits. The previous 30-second spec was too short.

**Why NSDR matters:** A bare countdown provides no benefit — the user needs to be cued into a body-scan/relaxation state. The NSDR screen includes brief text guidance to prompt this, requiring no external audio or internet dependency.

**Evidence caveat:** Do not claim in-product that the app "restores dopamine baseline by 65%." The 65% dopamine figure comes from a Yoga Nidra PET study with experienced practitioners, not from a generic 10–20 minute timer. Product copy should describe NSDR as a guided rest cue, not a guaranteed biological outcome.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite |
| Routing | None — single page, phase state machine |
| PWA | `vite-plugin-pwa` (Workbox generateSW strategy) |
| Notifications | Browser Notifications API (best-effort enhancement; on-screen countdown remains primary) |
| Audio | Web Audio API — OscillatorNode, no audio files |
| Persistence | None — all state is in-memory React |
| Deployment | `localhost` dev now, Vercel later (HTTPS required for service worker in production) |

---

## Visual Design

### Philosophy

Calm and readable. Nothing competes with the work. The accent color signals state, not decoration.

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `surface-deep` | `#0b0b0e` | Focus Drill background |
| `surface-base` | `#131316` | App background |
| `surface-raised` | `#1a1a20` | Cards, inactive presets |
| `surface-accent` | `#17192e` | Active/accent-tinted surfaces |
| `border-default` | `#22222a` | Default borders |
| `border-accent` | `#28306a` | Accent-tinted borders |
| `accent-dim` | `#2e3a70` | Timer ring, subtle indicators |
| `accent-mid` | `#4455aa` | Hover states |
| `accent-text` | `#6878bc` | Button labels, active preset numbers |
| `accent-bright` | `#7888cc` | Primary CTA label |
| `text-primary` | `#c8c8d4` | Headings, key values |
| `text-secondary` | `#66667a` | Body text, labels |
| `text-dim` | `#3a3a50` | Hints, secondary info |

No pure white (`#ffffff`). No pure black. No red anywhere — red signals error/danger and has no place in a calm focus tool.

### Typography

- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`)
- Timer display: `font-weight: 200`, `font-variant-numeric: tabular-nums`
- Headings: `font-weight: 600`, `letter-spacing: -0.02em`
- Labels: `font-weight: 500`, `letter-spacing: 0.08–0.12em`, `text-transform: uppercase`

### Spacing & Radius

- Container padding: `24–28px`
- Gap between elements: `12–14px`
- Border radius: `9px` (small elements), `11–14px` (buttons), `26px` (phone/card frame)

---

## App Structure

Single HTML page. No router. UI is controlled by a top-level `phase` state variable.

### Phase State Machine

```
home → pickDuration → focusDrill → timer → nsdr → home
                                     ↓
                                  (abandon)
                                     ↓
                                   home
```

### Top-Level State Shape

```ts
type Phase = 'home' | 'pickDuration' | 'focusDrill' | 'timer' | 'nsdr';

interface AppState {
  phase: Phase;
  sessionMinutes: number;        // chosen duration
  timerSecondsLeft: number;      // counts down during timer phase
  timerPaused: boolean;
  drillSecondsLeft: number;      // counts down during focusDrill phase (starts at 60)
  nsdrMinutes: number | null;    // null until user picks; 10 or 20
  nsdrSecondsLeft: number;       // counts down during NSDR rest
  audioReady: boolean;           // true after first user gesture (AudioContext unlocked)
  notifPermission: NotificationPermission | null;
}
```

All state lives at the top level (`App.tsx`). No context, no external store — the app is too small to need them.

---

## Component Tree

```
App
├── HomeScreen
├── PickDurationScreen
├── FocusDrillScreen
├── TimerScreen
└── NSDRScreen

hooks/
├── useCountdown(seconds, paused, onComplete) → { secondsLeft, reset }
├── useChime(audioReady) → { playChime }
└── useNotification() → { permission, requestPermission, scheduleNotification }
```

Each screen receives only the props it needs from `App` state. No screen imports another screen.

---

## Screens

### 1. Home

- App icon (styled `div`, emoji `⏱`, no image file)
- App name: "Focus Keeper"
- Tagline: "Science-backed deep work"
- Single "Start Session" button → advances to Pick Duration
- Small hint text: "Add to home screen to install" (visible only when not in standalone mode — use `window.matchMedia('(display-mode: standalone)')`)

---

### 2. Pick Duration

- Heading: "How long?"
- Three preset buttons:

| Label | Minutes | Rationale shown on hover/tap |
|---|---|---|
| Pomodoro | 25 | Classic short sprint |
| Sustained | 52 | Extended focus block |
| Ultradian | 90 | Huberman's full ultradian cycle — default selection |

- Custom input: `<input type="number">`, range 5–180, labeled "min"
- Custom values are clamped to 5–180; empty, non-numeric, or invalid values disable "Begin →"
- "Begin →" button → creates/resumes the `AudioContext`, then advances to Focus Drill
- Selecting a preset sets the custom input value to match; editing custom input deselects presets

---

### 3. Focus Drill

- Full-screen `surface-deep` (`#0b0b0e`) background — darkest screen in the app
- Instruction text at top: "Fix your gaze on this dot" / sub-line: "Do not look away"
- Single centered dot: `7px`, `#b0b0bc`, `opacity: 0.8` — no animation, no pulse
- **60-second countdown** displayed at bottom in large, dim numerals (not meant to be read actively — user's eyes should be on the dot)
- **No skip button** — this is the ritual entry point; skipping undermines the protocol
- Auto-advances to Timer when countdown reaches zero
- On phase enter: play a soft single-tone chime via Web Audio API to mark the transition (AudioContext must be created/resumed during the "Begin" button click handler on screen 2, not here — browser blocks audio without a prior user gesture)

---

### 4. Timer

- Phase label at top: "Deep Focus" (small, dim, uppercase)
- Circular progress ring (SVG): outer track `surface-raised`, fill arc `accent-dim` (`#2e3a70`), `stroke-linecap: round`
- Large countdown inside ring: MM:SS, `font-weight: 200`, `text-primary`
- Sub-label: "of {N} min"
- Status text below ring: "Session in progress" / "Paused"
- Two controls at bottom:
  - **Pause / Resume** — freezes `useCountdown`; label toggles between "⏸ Pause" and "▶ Resume"
  - **Abandon** — returns immediately to Home, resets all state; no confirmation dialog
- Auto-advances to NSDR when countdown reaches zero; plays chime on completion

**Tab-hidden drift:** Use `document.visibilitychange` + `Date.now()` timestamps to correct for drift when the tab is hidden. Do not rely solely on `setInterval` for accuracy.

**Countdown model:** Store an absolute deadline rather than decrementing by one each tick:

- On start/resume: `deadlineMs = Date.now() + secondsLeft * 1000`
- On tick/visibility change: `secondsLeft = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))`
- On pause: recompute remaining seconds and clear the active deadline

**Page refresh mid-session:** No persistence — state is lost. This is acceptable for v1. The user returns to Home.

---

### 5. NSDR Prompt

Post-session non-sleep deep rest cue.

- Small badge: "✦ Session Complete"
- Heading: "Time to rest."
- Body text (body scan cue):
  > "Close your eyes. Scan slowly from your feet to your head — notice each area without trying to change it. Let your breath settle on its own. Stay still."
- Sub-label: "Choose rest duration"
- Two rest options:

| Button | Duration | Note |
|---|---|---|
| Rest 20 min | 20 min | Marked "Recommended" — longer rest is more likely to support a meaningful relaxation state |
| Rest 10 min | 10 min | "Quick reset" |

- **Skip** → returns immediately to Home
- On selecting a rest duration:
  1. Feature-detect `Notification` support
  2. Request notification permission if not yet granted (`Notification.requestPermission()`)
  3. If granted: schedule a best-effort notification for when the timer ends
  4. If denied or unsupported: the NSDR timer still runs; a visible on-screen countdown shows remaining time so the user isn't stranded
  5. Screen transitions to a minimal rest view: dim screen, large countdown, no visible controls
- On rest complete (or notification dismissed): play chime, return to Home

**Notification reliability:** Browser notifications require support and a secure context, and scheduled `setTimeout` notifications only work while the app remains active. Closed-app delivery is out of scope for v1 unless a service-worker notification strategy is added later.

**Notification denial UX:** Show on-screen countdown prominently if notification permission was denied or unsupported — do not just silently count down with nothing visible.

**Rest escape hatch:** Even though the rest view has no visible controls, `Escape` may return to Home so users are never trapped in a no-control screen.

---

## Audio

All sounds generated via Web Audio API — no audio files, no network requests.

```
Chime: OscillatorNode (sine wave, 528 Hz)
  → GainNode (attack 0.01s, decay 0.3s, sustain 0, release 0)
  → AudioContext.destination
```

- `AudioContext` is created once on the first user gesture (the "Begin →" button click on the Pick Duration screen)
- Stored in a ref, reused for all subsequent chimes
- If the context is in `'suspended'` state, call `context.resume()` before playing
- If Web Audio is unavailable or playback fails, fail silently; sound is supportive, not required for flow completion
- Volume: gain peak `0.15` — subtle, not startling

---

## PWA Requirements

| Feature | Implementation |
|---|---|
| Installable on macOS | Web manifest `display: standalone`; Chrome/Edge show install prompt; Safari 17+ shows "Add to Dock" |
| Installable on iOS | Same manifest; user taps Share → "Add to Home Screen" in Safari |
| Browser support note | Firefox does not support PWA install via manifest — not a blocker |
| Offline support | `vite-plugin-pwa` with `generateSW` strategy pre-caches app shell on first load |
| Update UX | On new service worker activation, show a small "Update available — reload to refresh" toast. Auto-update on next page load if user dismisses. |
| Icons | 192×192 PNG + 512×512 PNG required for Lighthouse installability; also provide `apple-touch-icon` 180×180 for iOS |

**Production verification:** PWA install/offline behavior must be checked from a production build (`npm run build` + `npm run preview` or deployed HTTPS). Vite dev disables or alters service-worker behavior by default, so dev-server testing is not enough.

### Manifest Fields

```json
{
  "name": "Focus Keeper",
  "short_name": "Focus",
  "description": "Science-backed focus sessions with NSDR rest.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#131316",
  "theme_color": "#131316",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## Accessibility

- All interactive elements reachable via keyboard (`Tab` order follows visual order)
- Keyboard shortcuts:
  - `Space` → Pause / Resume (during Timer phase)
  - `Escape` → Abandon (during Timer phase, no confirmation)
  - `Escape` → Return Home (during minimal NSDR rest view)
- ARIA roles: timer countdown uses `role="timer"` + `aria-live="off"` (avoid constant announcements)
- Color contrast: all body text meets WCAG AA (4.5:1 against its background surface)
- No motion-only affordances — all state changes include a text change

---

## Deployment Path

1. **Now:** `npm run dev` → `localhost` (service worker disabled in dev by default with `vite-plugin-pwa`)
2. **Before release:** `npm run build` + `npm run preview` → verify manifest, app shell precache, offline reload, update toast, and installability
3. **Later:** Push to GitHub → connect to Vercel → auto-deploy on push (HTTPS provided by Vercel — required for production service worker)
4. **Optional:** Wrap with Capacitor for native iOS/Android App Store submission

---

## Out of Scope (Future Milestones)

- **Milestone 2:** Session history, daily stats, streaks (localStorage)
- **Milestone 3:** Dashboard with weekly chart
- **Milestone 4:** Capacitor packaging for App Store
- **Milestone 5:** Guided NSDR audio (yoga nidra narration, hosted audio file or Huberman YouTube embed)
