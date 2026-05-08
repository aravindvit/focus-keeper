# Focus Keeper

Focus Keeper is a small focus-session PWA built with React and Vite. It helps you pick a session length, settle your attention with a short gaze drill, run a focus timer, then transition into a guided break.

## Features

- Preset focus durations: Pomodoro, Sustained, and Ultradian.
- Custom session timer from 1 to 180 minutes.
- Focus drill with a bright attention dot and a skip option.
- Focus timer with pause/resume and abandon controls.
- Break flow after each session, with options to end the break or restart the previous session automatically.
- Installable PWA for iPhone and Mac through Safari.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

Open the URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy

The app is ready for Vercel.

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Install as an App

On iPhone:

1. Open the deployed app in Safari.
2. Tap Share.
3. Choose Add to Home Screen.

On Mac:

1. Open the deployed app in Safari.
2. Use File > Add to Dock, or Share > Add to Dock depending on your Safari version.

## Project Notes

- Product spec: `docs/superpowers/specs/2026-05-01-focus-keeper-design.md`
- Spec analysis: `docs/superpowers/analysis/2026-05-01-focus-keeper-spec-analysis.md`
- Review mockup: `docs/mockups/focus-keeper-ui.html`
