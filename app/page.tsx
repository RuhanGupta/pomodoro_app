"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Mode = "focus" | "short" | "long";

interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  autoStartNext: boolean;
  soundOn: boolean;
}

const INITIAL_SETTINGS: Settings = {
  focusMinutes: 50,
  shortBreakMinutes: 10,
  longBreakMinutes: 25,
  cyclesBeforeLongBreak: 4,
  autoStartNext: true,
  soundOn: true,
};

export default function Page() {
  const [mode, setMode] = useState<Mode>("focus");
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [isRunning, setIsRunning] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [dailyFocusSessions, setDailyFocusSessions] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState("Deep work: EECS revision");

  // seconds remaining for the current mode
  const [remaining, setRemaining] = useState(
    INITIAL_SETTINGS.focusMinutes * 60
  );

  // for subtle focus streak visual
  const maxStreakDots = 8;

  const totalSecondsForMode = useMemo(() => {
    switch (mode) {
      case "focus":
        return settings.focusMinutes * 60;
      case "short":
        return settings.shortBreakMinutes * 60;
      case "long":
        return settings.longBreakMinutes * 60;
    }
  }, [
    mode,
    settings.focusMinutes,
    settings.shortBreakMinutes,
    settings.longBreakMinutes,
  ]);

  // keep remaining in sync when settings or mode change (if not running)
  useEffect(() => {
    if (!isRunning) {
      setRemaining(totalSecondsForMode);
    }
  }, [totalSecondsForMode, isRunning]);

  const minutes = useMemo(
    () => Math.floor(remaining / 60)
      .toString()
      .padStart(2, "0"),
    [remaining]
  );
  const seconds = useMemo(
    () => Math.floor(remaining % 60)
      .toString()
      .padStart(2, "0"),
    [remaining]
  );

  const progress = useMemo(() => {
    if (totalSecondsForMode === 0) return 0;
    return 1 - remaining / totalSecondsForMode;
  }, [remaining, totalSecondsForMode]);

  const modeLabel = useMemo(() => {
    if (mode === "focus") return "Focus";
    if (mode === "short") return "Short break";
    return "Long break";
  }, [mode]);

  const playBeep = useCallback(() => {
    if (!settings.soundOn || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        // @ts-ignore
        window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.05;
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 350);
    } catch {
      // fail silently
    }
  }, [settings.soundOn]);

  const scheduleNextSession = useCallback(
    (completedMode: Mode) => {
      setCyclesCompleted((prev) => {
        let nextMode: Mode = mode;
        let newCycles = prev;

        if (completedMode === "focus") {
          newCycles = prev + 1;
          if (newCycles % settings.cyclesBeforeLongBreak === 0) {
            nextMode = "long";
          } else {
            nextMode = "short";
          }
        } else {
          nextMode = "focus";
        }

        setMode(nextMode);

        const nextDuration =
          nextMode === "focus"
            ? settings.focusMinutes
            : nextMode === "short"
            ? settings.shortBreakMinutes
            : settings.longBreakMinutes;

        setRemaining(nextDuration * 60);

        // auto-start
        setIsRunning(settings.autoStartNext && nextDuration > 0);

        return newCycles;
      });
    },
    [
      mode,
      settings.autoStartNext,
      settings.cyclesBeforeLongBreak,
      settings.focusMinutes,
      settings.longBreakMinutes,
      settings.shortBreakMinutes,
    ]
  );

  const handleSessionComplete = useCallback(() => {
    playBeep();
    if (mode === "focus") {
      setDailyFocusSessions((prev) => prev + 1);
    }
    scheduleNextSession(mode);
  }, [mode, playBeep, scheduleNextSession]);

  // timer effect
  useEffect(() => {
    if (!isRunning) return;

    let prev = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - prev) / 1000;
      prev = now;

      setRemaining((prevRemaining) => {
        const next = prevRemaining - delta;
        if (next <= 0) {
          clearInterval(id);
          handleSessionComplete();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, handleSessionComplete]);

  const handleStartPause = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(totalSecondsForMode);
  };

  const handleChangeMode = (newMode: Mode) => {
    setMode(newMode);
    setIsRunning(false);
    const nextDuration =
      newMode === "focus"
        ? settings.focusMinutes
        : newMode === "short"
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
    setRemaining(nextDuration * 60);
  };

  const handleSettingsChange = (
    field: keyof Settings,
    value: number | boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const streakDots = useMemo(() => {
    const capped = Math.min(dailyFocusSessions, maxStreakDots);
    return Array.from({ length: maxStreakDots }).map((_, i) => i < capped);
  }, [dailyFocusSessions]);

  // Timer circle geometry
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_32px_120px_rgba(0,0,0,0.6)] px-6 py-7 sm:px-8 sm:py-9 md:px-10 md:py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-slate-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Elite Focus Suite
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-slate-50">
              Pomodoro Atelier
            </h1>
            <p className="text-sm sm:text-base text-slate-300/90 max-w-xl">
              A calm, precision-crafted timer to keep your deep work sessions
              effortless and beautifully under control.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs sm:text-sm shadow-sm">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    Today
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold">
                      {dailyFocusSessions}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                      focus blocks
                    </span>
                  </div>
                </div>
                <div className="hidden h-10 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent sm:block" />
                <div className="hidden sm:block">
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    Cycle
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold">
                      {cyclesCompleted % settings.cyclesBeforeLongBreak || 0}/
                      {settings.cyclesBeforeLongBreak}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                      to long break
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs sm:text-sm font-medium text-emerald-200 shadow-[0_18px_40px_rgba(16,185,129,0.35)] transition hover:border-emerald-400/60 hover:bg-emerald-500/15 active:scale-[0.99]"
              onClick={() => setSettingsOpen((x) => !x)}
              type="button"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Session settings
              <span
                className={`transition-transform ${
                  settingsOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                ▼
              </span>
            </button>
          </div>
        </header>

        {/* Main layout */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:items-center">
          {/* Timer column */}
          <div className="flex flex-col items-center justify-center gap-6">
            {/* Mode tabs */}
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/80 px-1 py-1 text-xs shadow-inner shadow-black/40">
              {[
                { id: "focus", label: "Focus" },
                { id: "short", label: "Short break" },
                { id: "long", label: "Long break" },
              ].map((tab) => {
                const isActive = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleChangeMode(tab.id as Mode)}
                    className={`relative flex-1 rounded-full px-3.5 py-1.5 transition text-[0.7rem] sm:text-xs ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-400/90 via-emerald-500/90 to-teal-500/90 text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.55)]"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Circular timer */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.24),transparent_55%)] opacity-70 blur-2xl" />
              <div className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-white/10 via-slate-900/80 to-black/80 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
                <div className="relative flex items-center justify-center rounded-full bg-slate-950/80 px-8 py-8 sm:px-10 sm:py-10 md:px-12 md:py-12">
                  {/* SVG progress ring */}
                  <svg
                    className="h-72 w-72 sm:h-80 sm:w-80 md:h-[21rem] md:w-[21rem]"
                    viewBox="0 0 360 360"
                  >
                    <defs>
                      <linearGradient
                        id="timerGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="50%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    </defs>
                    {/* background circle */}
                    <circle
                      cx="180"
                      cy="180"
                      r={radius}
                      fill="none"
                      stroke="rgba(148,163,184,0.22)"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    {/* progress circle */}
                    <circle
                      cx="180"
                      cy="180"
                      r={radius}
                      fill="none"
                      stroke="url(#timerGradient)"
                      strokeWidth="12"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 180 180)"
                      style={{
                        transition: "stroke-dashoffset 0.6s ease-out",
                      }}
                    />
                  </svg>

                  {/* Time text + status */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="text-[3.2rem] leading-none sm:text-[3.6rem] md:text-[4rem] font-semibold tracking-tight tabular-nums text-slate-50">
                      {minutes}:{seconds}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs uppercase tracking-[0.17em] text-slate-400">
                        {modeLabel}
                        {isRunning ? " in progress" : " paused"}
                      </span>
                      <div className="flex items-center gap-1.5 text-[0.7rem] text-slate-400">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="tracking-[0.14em] uppercase">
                          {currentTask || "No task set"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleStartPause}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 px-8 py-2.5 text-sm font-semibold tracking-wide text-slate-950 shadow-[0_20px_60px_rgba(16,185,129,0.7)] transition hover:brightness-[1.03] active:scale-[0.98]"
              >
                {isRunning ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-[0.35rem] border border-slate-950/40 bg-slate-950/10" />
                    Pause
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full border border-slate-950/40 bg-slate-950/10" />
                    Start
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/80 px-5 py-2 text-xs sm:text-sm font-medium text-slate-200 shadow-sm transition hover:bg-slate-800/80 active:scale-[0.99]"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Right column: task, streak, settings */}
          <div className="space-y-6">
            {/* Current task + streak */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 sm:px-5 sm:py-5 shadow-inner shadow-black/40 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                  Current focus block
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-emerald-200 border border-emerald-400/30">
                  Minimal mode
                </span>
              </div>
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs sm:text-sm text-slate-50 placeholder:text-slate-500 outline-none ring-0 transition focus:border-emerald-400/70 focus:bg-slate-900 focus:ring-1 focus:ring-emerald-400/50"
                  value={currentTask}
                  onChange={(e) => setCurrentTask(e.target.value)}
                  placeholder="What are you focusing on this cycle?"
                />

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Focus streak
                    </div>
                    <div className="flex items-center gap-1.5">
                      {streakDots.map((filled, idx) => (
                        <div
                          key={idx}
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            filled
                              ? "bg-gradient-to-br from-emerald-400 via-cyan-400 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.75)]"
                              : "bg-slate-700/70"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Next up
                    </div>
                    <div className="text-xs text-slate-200">
                      {mode === "focus"
                        ? "Recovery break"
                        : "Back to deep work"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div
              className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-inner shadow-black/40 transition-[max-height,opacity,transform] duration-400 ${
                settingsOpen
                  ? "max-h-[480px] opacity-100"
                  : "pointer-events-none max-h-0 opacity-0 transform-gpu translate-y-1"
              }`}
            >
              <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold tracking-tight text-slate-100">
                    Session tuning
                  </h3>
                  <button
                    type="button"
                    className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400 hover:text-slate-200"
                    onClick={() => setSettings(INITIAL_SETTINGS)}
                  >
                    Reset to classic
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SettingNumberField
                    label="Focus"
                    suffix="min"
                    value={settings.focusMinutes}
                    min={5}
                    max={180}
                    step={5}
                    onChange={(v) =>
                      handleSettingsChange("focusMinutes", v)
                    }
                  />
                  <SettingNumberField
                    label="Short break"
                    suffix="min"
                    value={settings.shortBreakMinutes}
                    min={3}
                    max={60}
                    step={1}
                    onChange={(v) =>
                      handleSettingsChange("shortBreakMinutes", v)
                    }
                  />
                  <SettingNumberField
                    label="Long break"
                    suffix="min"
                    value={settings.longBreakMinutes}
                    min={10}
                    max={60}
                    step={5}
                    onChange={(v) =>
                      handleSettingsChange("longBreakMinutes", v)
                    }
                  />
                  <SettingNumberField
                    label="Focus cycles to long break"
                    suffix="cycles"
                    value={settings.cyclesBeforeLongBreak}
                    min={2}
                    max={8}
                    step={1}
                    onChange={(v) =>
                      handleSettingsChange("cyclesBeforeLongBreak", v)
                    }
                  />
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <ToggleField
                    label="Auto-start next block"
                    description="Flow seamlessly into the next focus or break."
                    checked={settings.autoStartNext}
                    onChange={(checked) =>
                      handleSettingsChange("autoStartNext", checked)
                    }
                  />
                  <ToggleField
                    label="Gentle chime"
                    description="Subtle audio cue at the end of each block."
                    checked={settings.soundOn}
                    onChange={(checked) =>
                      handleSettingsChange("soundOn", checked)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Tiny hint */}
            <p className="text-[0.68rem] text-slate-500">
              Pro tip: pick one non-negotiable task for each focus block.
              The timer handles the rest.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

interface SettingNumberFieldProps {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function SettingNumberField({
  label,
  suffix,
  value,
  min,
  max,
  step = 1,
  onChange,
}: SettingNumberFieldProps) {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isNaN(v)) return;
    const clamped = Math.min(max, Math.max(min, v));
    onChange(clamped);
  };

  const handleStep = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
          {label}
        </span>
        <span className="text-[0.7rem] text-slate-500">{suffix}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-2 py-1.5">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-xs text-slate-300 transition hover:bg-white/10 active:scale-[0.96]"
        >
          −
        </button>
        <input
          type="number"
          className="w-full bg-transparent text-center text-xs sm:text-sm text-slate-50 outline-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleInput}
        />
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-xs text-slate-300 transition hover:bg-white/10 active:scale-[0.96]"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: ToggleFieldProps) {
  return (
    <label className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/80 px-3.5 py-3">
      <div className="space-y-0.5">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-300">
          {label}
        </div>
        <p className="text-[0.68rem] text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked
            ? "bg-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
            : "bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 translate-x-1 rounded-full bg-slate-950 shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
