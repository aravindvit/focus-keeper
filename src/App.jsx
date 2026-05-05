import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PRESETS = [
  { label: "Pomodoro", minutes: 25, note: "Classic short sprint" },
  { label: "Sustained", minutes: 52, note: "Extended focus block" },
  { label: "Ultradian", minutes: 90, note: "Full focus cycle" }
];

const DRILL_SECONDS = 60;

function clampMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(180, Math.max(1, Math.round(parsed)));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function useStandaloneMode() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    const update = () => setIsStandalone(query.matches || window.navigator.standalone === true);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return isStandalone;
}

function useChime() {
  const audioContextRef = useRef(null);

  const unlockAudio = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const playChime = useCallback(async () => {
    try {
      const ready = await unlockAudio();
      if (!ready || !audioContextRef.current) return;

      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(528, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.31);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.33);
    } catch {
      // Sound is supportive; the session flow must continue without it.
    }
  }, [unlockAudio]);

  return { unlockAudio, playChime };
}

function useCountdown({ durationSeconds, active, paused = false, resetKey, onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const deadlineRef = useRef(null);
  const completedRef = useRef(false);
  const secondsLeftRef = useRef(durationSeconds);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const updateFromDeadline = useCallback(() => {
    if (!deadlineRef.current) return;
    const nextSeconds = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    secondsLeftRef.current = nextSeconds;
    setSecondsLeft(nextSeconds);
    if (nextSeconds === 0 && !completedRef.current) {
      completedRef.current = true;
      deadlineRef.current = null;
      onCompleteRef.current?.();
    }
  }, []);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    secondsLeftRef.current = durationSeconds;
    deadlineRef.current = null;
    completedRef.current = false;
  }, [durationSeconds, resetKey]);

  useEffect(() => {
    if (!active || completedRef.current) return undefined;

    if (paused) {
      if (deadlineRef.current) updateFromDeadline();
      deadlineRef.current = null;
      return undefined;
    }

    if (!deadlineRef.current) {
      deadlineRef.current = Date.now() + secondsLeftRef.current * 1000;
    }

    updateFromDeadline();
    const intervalId = window.setInterval(updateFromDeadline, 250);
    const onVisibilityChange = () => updateFromDeadline();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, paused, resetKey, updateFromDeadline]);

  return secondsLeft;
}

function requestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}

export default function App() {
  const [phase, setPhase] = useState("pickDuration");
  const [selectedPreset, setSelectedPreset] = useState(90);
  const [customMinutes, setCustomMinutes] = useState("90");
  const [sessionMinutes, setSessionMinutes] = useState(90);
  const [timerPaused, setTimerPaused] = useState(false);
  const [drillRunId, setDrillRunId] = useState(0);
  const [timerRunId, setTimerRunId] = useState(0);
  const [nsdrMinutes, setNsdrMinutes] = useState(null);
  const [restRunId, setRestRunId] = useState(0);
  const [notifPermission, setNotifPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [updateReady, setUpdateReady] = useState(false);
  const notificationTimerRef = useRef(null);
  const isStandalone = useStandaloneMode();
  const { unlockAudio, playChime } = useChime();

  const validCustomMinutes = useMemo(() => clampMinutes(customMinutes), [customMinutes]);
  const canStartCustom = validCustomMinutes !== null && customMinutes !== "";

  const resetSession = useCallback(() => {
    window.clearTimeout(notificationTimerRef.current);
    notificationTimerRef.current = null;
    setPhase("pickDuration");
    setTimerPaused(false);
    setNsdrMinutes(null);
  }, []);

  const restartSessionSetup = useCallback(() => {
    window.clearTimeout(notificationTimerRef.current);
    notificationTimerRef.current = null;
    setCustomMinutes(String(sessionMinutes));
    setSelectedPreset(PRESETS.some((preset) => preset.minutes === sessionMinutes) ? sessionMinutes : null);
    setPhase("pickDuration");
    setTimerPaused(false);
    setNsdrMinutes(null);
  }, [sessionMinutes]);

  const beginSession = async (requestedMinutes = validCustomMinutes) => {
    const minutes = clampMinutes(requestedMinutes);
    if (minutes === null) return;
    setCustomMinutes(String(minutes));
    setSessionMinutes(minutes);
    setTimerPaused(false);
    setNsdrMinutes(null);
    await unlockAudio();
    setPhase("focusDrill");
    setDrillRunId((id) => id + 1);
    playChime();
  };

  const startTimer = useCallback(() => {
    setPhase("timer");
    setTimerRunId((id) => id + 1);
  }, []);

  const startRest = async (minutes) => {
    const permission = await requestNotificationPermission();
    setNotifPermission(permission);
    setNsdrMinutes(minutes);
    setRestRunId((id) => id + 1);

    if (permission === "granted") {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = window.setTimeout(() => {
        try {
          new Notification("NSDR complete", {
            body: "Your rest period is complete.",
            icon: "/icons/icon-192.png"
          });
        } catch {
          // The visible countdown remains the reliable path.
        }
      }, minutes * 60 * 1000);
    }
  };

  const drillSecondsLeft = useCountdown({
    durationSeconds: DRILL_SECONDS,
    active: phase === "focusDrill",
    resetKey: drillRunId,
    onComplete: startTimer
  });

  const timerSecondsLeft = useCountdown({
    durationSeconds: sessionMinutes * 60,
    active: phase === "timer",
    paused: timerPaused,
    resetKey: timerRunId,
    onComplete: () => {
      playChime();
      setPhase("nsdr");
      setNsdrMinutes(null);
    }
  });

  const nsdrSecondsLeft = useCountdown({
    durationSeconds: (nsdrMinutes ?? 0) * 60,
    active: phase === "nsdr" && nsdrMinutes !== null,
    resetKey: restRunId,
    onComplete: () => {
      playChime();
      resetSession();
    }
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (phase === "timer" && event.code === "Space") {
        event.preventDefault();
        setTimerPaused((paused) => !paused);
      }
      if (phase === "timer" && event.key === "Escape") {
        resetSession();
      }
      if (phase === "nsdr" && nsdrMinutes !== null && event.key === "Escape") {
        resetSession();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, nsdrMinutes, resetSession]);

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener("focus-keeper:update-ready", onUpdateReady);
    return () => window.removeEventListener("focus-keeper:update-ready", onUpdateReady);
  }, []);

  const progress = sessionMinutes > 0 ? 1 - timerSecondsLeft / (sessionMinutes * 60) : 0;

  return (
    <main className={`app phase-${phase}${phase === "nsdr" && nsdrMinutes !== null ? " phase-rest" : ""}`}>
      {phase === "pickDuration" && (
        <section className="screen duration-screen" aria-labelledby="duration-title">
          <div>
            <div className="app-masthead">
              <div className="mini-brand">
                <span className="mini-icon" aria-hidden="true">
                  ⏱
                </span>
                <span>
                  <span className="mini-title">Focus Keeper</span>
                  <span className="mini-subtitle">Science-backed deep work</span>
                </span>
              </div>
            </div>

            <div className="screen-header">
              <span className="eyebrow">Session setup</span>
              <h1 id="duration-title">How long?</h1>
            </div>

            <div className="duration-options" aria-label="Session duration presets">
              {PRESETS.map((preset) => (
                <button
                  className={`preset-button${selectedPreset === preset.minutes ? " is-active" : ""}`}
                  key={preset.minutes}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset.minutes);
                    beginSession(preset.minutes);
                  }}
                >
                  <span className="preset-main">
                    <span className="preset-title">{preset.label}</span>
                    <span className="preset-note">{preset.note}</span>
                  </span>
                  <span className="preset-minutes">{preset.minutes}</span>
                </button>
              ))}
            </div>

            <div className="custom-row">
              <input
                aria-label="Custom session minutes"
                inputMode="numeric"
                max="180"
                min="1"
                type="number"
                value={customMinutes}
                onChange={(event) => {
                  setSelectedPreset(null);
                  setCustomMinutes(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canStartCustom) {
                    beginSession(validCustomMinutes);
                  }
                }}
                onBlur={() => {
                  if (validCustomMinutes !== null) setCustomMinutes(String(validCustomMinutes));
                }}
              />
              <span>min</span>
              <button
                className="inline-start"
                type="button"
                aria-label="Start custom duration"
                disabled={!canStartCustom}
                onClick={() => beginSession(validCustomMinutes)}
              >
                →
              </button>
            </div>
          </div>

          <div>
            {!isStandalone && <p className="hint">Add to home screen to install</p>}
          </div>
        </section>
      )}

      {phase === "focusDrill" && (
        <section className="screen drill-screen" aria-labelledby="drill-title">
          <div className="drill-instruction">
            <h1 id="drill-title">Fix your gaze on this dot</h1>
            <p>Do not look away</p>
          </div>
          <div className="gaze-dot" aria-hidden="true" />
          <div className="drill-footer">
            <button className="ghost-button" type="button" onClick={startTimer}>
              Skip drill
            </button>
            <div className="drill-count" role="timer" aria-live="off">
              {drillSecondsLeft}
            </div>
          </div>
        </section>
      )}

      {phase === "timer" && (
        <section className="screen timer-screen" aria-labelledby="timer-title">
          <div className="screen-header">
            <span className="eyebrow" id="timer-title">
              Deep Focus
            </span>
          </div>

          <div className="timer-content">
            <ProgressRing progress={progress} />
            <div className="timer-readout">
              <div className="timer-time" role="timer" aria-live="off">
                {formatTime(timerSecondsLeft)}
              </div>
              <div className="timer-sub">of {sessionMinutes} min</div>
            </div>
            <p className="status">{timerPaused ? "Paused" : "Session in progress"}</p>
          </div>

          <div className="timer-actions">
            <button className="primary-button" type="button" onClick={() => setTimerPaused((paused) => !paused)}>
              {timerPaused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button className="secondary-button" type="button" onClick={resetSession}>
              Abandon
            </button>
          </div>
        </section>
      )}

      {phase === "nsdr" && nsdrMinutes === null && (
        <section className="screen nsdr-screen" aria-labelledby="nsdr-title">
          <div>
            <div className="screen-header">
              <span className="nsdr-badge">✦ Session Complete</span>
              <h1 id="nsdr-title">Time to rest.</h1>
            </div>
            <p className="body-cue">
              Close your eyes. Scan slowly from your feet to your head — notice each area without trying to change it.
              Let your breath settle on its own. Stay still.
            </p>
            <div className="rest-options" aria-label="Choose rest duration">
              <button className="rest-button recommended" type="button" onClick={() => startRest(20)}>
                <span className="rest-title">
                  <span>Rest 20 min</span>
                  <span>Recommended</span>
                </span>
                <span className="rest-note">Longer rest for a meaningful relaxation state</span>
              </button>
              <button className="rest-button" type="button" onClick={() => startRest(10)}>
                <span className="rest-title">
                  <span>Rest 10 min</span>
                  <span>Quick reset</span>
                </span>
                <span className="rest-note">Shorter transition back to the day</span>
              </button>
            </div>
            {notifPermission === "denied" && (
              <p className="permission-note">Notifications are off. The on-screen rest timer will stay visible.</p>
            )}
          </div>
          <button className="secondary-button" type="button" onClick={resetSession}>
            Skip
          </button>
        </section>
      )}

      {phase === "nsdr" && nsdrMinutes !== null && (
        <section className="screen rest-screen" aria-labelledby="rest-title">
          <span className="eyebrow" id="rest-title">
            Rest
          </span>
          <div className="rest-time" role="timer" aria-live="off">
            {formatTime(nsdrSecondsLeft)}
          </div>
          <p>Stay still.</p>
          <div className="break-actions">
            <button className="secondary-button" type="button" onClick={resetSession}>
              End break
            </button>
            <button className="primary-button" type="button" onClick={restartSessionSetup}>
              Restart session
            </button>
          </div>
        </section>
      )}

      {updateReady && (
        <div className="update-toast" role="status">
          <span>Update available</span>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" aria-label="Dismiss update" onClick={() => setUpdateReady(false)}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}

function ProgressRing({ progress }) {
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <svg className="progress-ring" viewBox="0 0 260 260" aria-hidden="true">
      <circle className="progress-track" cx="130" cy="130" r={radius} />
      <circle
        className="progress-fill"
        cx="130"
        cy="130"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
