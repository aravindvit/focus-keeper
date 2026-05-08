# Focus Keeper — Spec Analysis

**Date:** 2026-05-01  
**Source spec:** `docs/superpowers/specs/2026-05-01-focus-keeper-design.md`  
**Analysis status:** Ready for implementation with wording and UX caveats

---

## Executive Summary

The spec is coherent and implementable as a small React + Vite PWA. The product shape is intentionally narrow: one state-machine driven focus ritual, no persistence, no auth, no routing, and no analytics. That restraint is a strength for v1.

The main implementation risks are not React complexity; they are browser behavior:

- Web Audio must be unlocked from the preset/custom start gesture before the focus drill starts.
- Browser notifications are limited availability and require secure contexts.
- Timers need timestamp-based correction because hidden tabs throttle intervals.
- PWA install/offline behavior requires production-like testing, not only Vite dev.

The neuroscience framing is directionally plausible, but some claims should be phrased carefully. The 30-60 second visual focus drill maps to Huberman's published protocol. The 65% dopamine claim comes from a Yoga Nidra PET study with experienced practitioners, so the app should avoid implying a guaranteed dopamine increase from a 10-20 minute unguided rest timer.

---

## Research Validation

### Supported

**Visual focus drill**

Huberman's "Neuroplasticity Super Protocol" recommends staring at a point/object for 30-60 seconds before starting focused work and connects the effort to top-down attentional engagement involving acetylcholine-related circuits.

Implementation implication: a 60-second gaze-lock drill is defensible. A low-emphasis skip control is acceptable for repeat users and testing, but should not visually compete with the ritual.

Source: Huberman Lab, "Teach & Learn Better With A Neuroplasticity Super Protocol"  
https://www.hubermanlab.com/teach-and-learn-better-with-a-neuroplasticity-super-protocol

**90-minute upper bound**

Huberman material consistently discusses approximately 90-minute ultradian cycles for focused mental or physical work. The spec's 90-minute "Ultradian" default is aligned with that framing.

Implementation implication: keep 90 as the default preset, while allowing shorter and custom sessions.

Sources:

- Ask Huberman Lab, "Ultradian cycles"  
  https://ai.hubermanlab.com/s/R5xWditS
- Ask Huberman Lab, "Ultradian cycle and focus"  
  https://ai.hubermanlab.com/s/_AZQvbT2

**Yoga Nidra / NSDR rest rationale**

The 65% dopamine figure traces to a PET study on Yoga Nidra meditation. The study found decreased raclopride binding corresponding to increased endogenous dopamine release during meditation.

Implementation implication: NSDR can be positioned as a rest/body-scan cue. Avoid strong claims like "restores dopamine baseline by 65%" in the product UI.

Sources:

- Kjaer et al., "Increased dopamine tone during meditation-induced change of consciousness", Cognitive Brain Research, 2002  
  https://www.sciencedirect.com/science/article/pii/S0926641001001069
- Region Hovedstaden research portal summary  
  https://research.regionh.dk/en/publications/increased-dopamine-tone-during-meditation-induced-change-of-consc
- Scientific Reports review/context on Yoga Nidra connectivity  
  https://www.nature.com/articles/s41598-024-63765-7

**PWA manifest requirements**

The manifest requirements in the spec match current installability guidance: `name` or `short_name`, icons including 192 and 512, `start_url`, and `display`. HTTPS, localhost, or loopback are required for installability.

Implementation implication: Vite dev can validate much of the app, but install/offline behavior should be checked in a production build served locally.

Source: MDN, "Making PWAs installable"  
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

### Needs Careful Wording

**"Restores dopamine baseline by up to 65%"**

This is too strong as written. The cited evidence is Yoga Nidra meditation in a controlled PET study, not a general NSDR timer outcome and not necessarily "baseline restoration." Recommended spec wording:

> NSDR-style Yoga Nidra protocols have been associated with increased endogenous dopamine release in small imaging studies; the app uses a short body-scan cue to encourage a comparable rest state without promising a biological outcome.

**"Notifications other than the NSDR rest timer"**

Browser notification delivery is not guaranteed across all browsers/platforms. MDN marks notification permission/request APIs as limited availability and secure-context bound.

Implementation implication: on-screen countdown must be the primary reliable experience. Notification is enhancement only.

Sources:

- MDN, "Notifications API"  
  https://developer.mozilla.org/docs/Web/API/Notifications_API
- MDN, "Notification.requestPermission()"  
  https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static

---

## Product Analysis

### What Works Well

- The phase flow is clear and maps to a real ritual.
- No persistence keeps implementation fast and avoids privacy/account complexity.
- The color palette and typography are specific enough to implement without visual guesswork.
- The NSDR prompt gives enough guidance to make the rest phase meaningful even without audio.
- The "abandon returns to duration selection, no confirmation" behavior is simple and consistent with a low-stakes personal tool.

### UX Risks

- A visible focus-drill skip control may undermine the ritual if overemphasized. Keep it low contrast and secondary.
- If notification permission is denied, the rest screen must still feel complete. The spec already catches this; implementation should not hide all controls and leave users uncertain.
- The minimal rest view says "no other controls," but users may need an escape route. Consider allowing `Escape` to return to duration selection for accessibility and user agency, even if no visible button is shown.
- Custom duration needs clamping and validation. A blank input should not start a `NaN` timer.

---

## Technical Analysis

### Recommended Architecture

Keep all app state in `App.tsx`, with simple screen components and hooks:

- `useCountdown` for timestamp-corrected countdowns.
- `useChime` for a single reusable `AudioContext`.
- `useNotification` for permission and delayed notification scheduling.

This is sufficient. Context, reducers, routing, or global stores would be unnecessary for v1 unless the implementation becomes more complex than the spec suggests.

### Timer Accuracy

Do not decrement `secondsLeft` by one every interval and trust it. Store an absolute deadline:

- On start/resume: `deadlineMs = Date.now() + secondsLeft * 1000`
- On tick/visibility change: `secondsLeft = max(0, ceil((deadlineMs - Date.now()) / 1000))`
- On pause: compute remaining seconds and clear the deadline

This handles hidden-tab drift and normal timer throttling.

### Audio

Create/resume the `AudioContext` inside the preset/custom start handler, because that is the user gesture. Store it in a ref and reuse it. Chimes should fail silently if audio is unavailable.

### Notifications

Treat notifications as progressive enhancement:

- Feature detect `Notification`.
- Request permission only after the user selects an NSDR duration.
- If granted, schedule with `setTimeout` for v1.
- If the app is closed, the scheduled notification will not fire unless implemented through a service worker mechanism. The current spec does not require closed-app notification reliability.

### PWA

Use `vite-plugin-pwa` with generated service worker. Add:

- `manifest` fields from spec
- `icons/icon-192.png`
- `icons/icon-512.png`
- `apple-touch-icon.png`
- update toast wired to the PWA registration update callback

Production verification should include `npm run build` and `npm run preview`, then Lighthouse/Application panel checks.

---

## Acceptance Criteria

### Core Flow

- First screen is duration selection; there is no separate Home/landing screen.
- Duration screen shows compact app identity, tagline, immediately-starting presets, custom input with inline start control, and install hint only outside standalone display mode.
- Duration picker supports presets 25, 52, 90 and custom 1-180.
- Preset tap or custom start unlocks audio and advances to the 60-second focus drill.
- Focus drill auto-advances to timer at zero and includes a low-emphasis skip control.
- Timer can pause/resume and abandon to reset to duration selection.
- Timer auto-advances to NSDR prompt at zero and plays a chime.
- NSDR prompt supports 20-minute recommended rest, 10-minute rest, and skip.
- Rest countdown completes, plays a chime, and returns to duration selection; Restart session from the break starts a new Focus Drill using the previous session duration.

### Technical

- Countdown does not drift meaningfully after tab hide/show.
- `Space` toggles pause/resume during timer.
- `Escape` abandons during timer.
- Timer countdown has `role="timer"` and avoids noisy live announcements.
- Notification denial still shows a visible countdown.
- App builds successfully.
- PWA manifest contains required installability fields and icon sizes.
- App shell works offline after first production load.

### Visual

- No pure white, pure black, or red in the UI.
- Focus drill uses the darkest background and a static centered dot.
- Timer uses an SVG circular progress ring with round line caps.
- Text contrast meets WCAG AA for body text.
- Controls are keyboard reachable in visual order.

---

## Implementation Priority

1. Scaffold React/Vite app and base CSS tokens.
2. Implement phase state machine and screens.
3. Implement timestamp-corrected timer hook.
4. Implement Web Audio chime hook.
5. Implement NSDR permission/countdown behavior.
6. Add keyboard shortcuts and ARIA details.
7. Add PWA manifest, icons, service worker, and update toast.
8. Run build, preview, browser QA, and Lighthouse installability checks.

---

## Recommended Spec Edits

- Change "restores dopamine baseline by up to 65%" to a more cautious Yoga Nidra evidence statement.
- Clarify that NSDR notifications are best-effort while the app remains active in v1.
- Decide whether the minimal rest countdown needs an invisible or keyboard-only escape path.
- Add explicit invalid custom-duration handling: clamp to 1-180 and disable custom start when empty/invalid.
- Add production PWA verification steps to the Definition of Done.
