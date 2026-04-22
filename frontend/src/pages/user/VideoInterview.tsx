

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Vapi from "@vapi-ai/web";
import { Base_Url } from "../../utils/constants";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  LayoutGrid,
  MonitorUp,
  User,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Volume2,
  X,
  Maximize,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/context";
import { userService } from "../../services/service/userService";
import * as faceapi from "@vladmandic/face-api";
import { userPath } from "../../routes/EncryptRoute";

// ─── FACE-API MODEL LOADING ────────────────────────────────────────────────
const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
let faceModelsLoaded = false;
async function loadFaceModels() {
  if (faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
  ]);
  faceModelsLoaded = true;
}

// ─── VOICE CONFIG ─────────────────────────────────────────────────────────────
// ElevenLabs voice IDs — Indian accent, natural cadence
const VOICE_CONFIG = {
  female: {
    // voiceId: "pFZP5JQG7iQjIQuC4Bku", 
    // voiceId: "21m00Tcm4TlvDq8ikWAM",
    voiceId:"Neha",// "Lily" — warm, natural Indian-English female
    // stability: 0.6,
    // similarityBoost: 0.78,
    // style: 0.62,
    speed: 1,
    // emotion: {
    //   happy: 0.3,
    //   sad: 0.2,
    //   angry: 0.1,
    // },
  },
  male: {
    // voiceId: "nPczCjzI2devNBz1zQrb",
    // voiceId: "pNInz6obpgDQGcFmaJgB",
     voiceId:"Rohan",// "Brian" — replace with Indian male voice ID
    // stability: 0.6,
    // similarityBoost: 0.75,
    // style: 0.6,
    speed: 1,
    //   emotion: {
    //   happy: 0.3,
    //   sad: 0.2,
    //   angry: 0.1,
    // },
  },
} as const;

// ─── AVATAR CONFIG ─────────────────────────────────────────────────────────
const AVATAR_CONFIG = {
  heygen: {
    apiKey: "sk_V2_hgu_kBz4ii8AzWD_oRmNinOC4JiXq8Q8KcOXuKm84nrjnquG",
    avatarId: "a02648040d8140ffbff8157743559a98",
    voiceId: "",
    quality: "high" as const,
  },
  ganai: {
    apiKey: "",
    avatarId: "",
    voiceId: "",
    baseUrl: "https://api.gan.ai",
  },
};
const USE_HEYGEN =
  !!AVATAR_CONFIG.heygen.apiKey && !!AVATAR_CONFIG.heygen.avatarId;
const USE_GANAI =
  !USE_HEYGEN && !!AVATAR_CONFIG.ganai.apiKey && !!AVATAR_CONFIG.ganai.avatarId;

const ganAi = {
  async generate(script: string): Promise<string | null> {
    try {
      const body: any = {
        avatar_id: AVATAR_CONFIG.ganai.avatarId,
        script,
        background: { type: "color", value: "#0d1535" },
      };
      if (AVATAR_CONFIG.ganai.voiceId)
        body.voice_id = AVATAR_CONFIG.ganai.voiceId;
      const r = await fetch(
        `${AVATAR_CONFIG.ganai.baseUrl}/v2/avatar/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": AVATAR_CONFIG.ganai.apiKey,
          },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) return null;
      const d = await r.json();
      return d?.render_id ?? d?.id ?? null;
    } catch {
      return null;
    }
  },
  async poll(renderId: string): Promise<string | null> {
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const r = await fetch(
          `${AVATAR_CONFIG.ganai.baseUrl}/v2/renders/${renderId}`,
          { headers: { "x-api-key": AVATAR_CONFIG.ganai.apiKey } },
        );
        if (!r.ok) continue;
        const d = await r.json();
        if (d?.status === "completed" && d?.video_url) return d.video_url;
        if (d?.status === "failed") return null;
      } catch {}
    }
    return null;
  },
};

class HeyGenService {
  private avatar: any = null;
  private sessionData: any = null;
  private videoRef: React.RefObject<HTMLVideoElement | null>;
  onStateChange?: (speaking: boolean) => void;
  onStreamReady?: () => void;
  constructor(v: React.RefObject<HTMLVideoElement | null>) {
    this.videoRef = v;
  }
  async init(): Promise<boolean> {
    try {
      const mod = await import("@heygen/streaming-avatar" as any);
      const SA =
        mod.StreamingAvatar ??
        (mod as any).default?.StreamingAvatar ??
        (mod as any).default;
      const SE = mod.StreamingEvents ?? (mod as any).default?.StreamingEvents;
      if (typeof SA !== "function") throw new Error("not a constructor");
      this.avatar = new SA({ token: await this.getToken() });
      this.avatar.on(SE.AVATAR_START_TALKING, () => this.onStateChange?.(true));
      this.avatar.on(SE.AVATAR_STOP_TALKING, () => this.onStateChange?.(false));
      this.avatar.on(SE.STREAM_READY, (ev: any) => {
        if (this.videoRef.current && ev.detail) {
          this.videoRef.current.srcObject = ev.detail;
          this.videoRef.current
            .play()
            .catch(() => {})
            .then(() => this.onStreamReady?.());
        }
      });
      this.sessionData = await this.avatar.createStartAvatar({
        avatarName: AVATAR_CONFIG.heygen.avatarId,
        quality: AVATAR_CONFIG.heygen.quality,
        voice: AVATAR_CONFIG.heygen.voiceId
          ? { voiceId: AVATAR_CONFIG.heygen.voiceId }
          : undefined,
      });
      return true;
    } catch (e) {
      console.error("HeyGen:", e);
      return false;
    }
  }
  private async getToken(): Promise<string> {
    const r = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: { "x-api-key": AVATAR_CONFIG.heygen.apiKey },
    });
    return (await r.json())?.data?.token ?? "";
  }
  async speak(text: string) {
    if (!this.avatar || !this.sessionData) return;
    try {
      const mod = await import("@heygen/streaming-avatar" as any);
      const TT = mod.TaskType ?? (mod as any).default?.TaskType;
      await this.avatar.speak({
        sessionId: this.sessionData.session_id,
        text,
        task_type: TT?.REPEAT ?? "repeat",
      });
    } catch {}
  }
  async destroy() {
    try {
      await this.avatar?.stopAvatar();
    } catch {}
    this.avatar = null;
    this.sessionData = null;
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
type Screen = "lobby" | "spotlight" | "grid";
type AvatarMode = "heygen" | "ganai" | "animated";
type AvatarState = "idle" | "thinking" | "speaking";
// Turn state for natural conversation flow
type TurnState =
  | "ai-speaking"
  | "user-turn"
  | "user-speaking"
  | "processing"
  | "idle";

interface AlertState {
  type: string;
  count: number;
  title: string;
  body: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MAX_VIOLATIONS = 3;
// After 3 violations, interview continues but is flagged — only submits on end conditions
const SILENCE_THRESHOLD_SEC = 30;
const MAX_SILENCE_WARNINGS = 5;
const TICK_MS = 1000;
const HARD_TICKS = 3;
const MULTI_TICKS = 2;
const EAR_HARD = 0.22;
const GAZE_HARD = 0.22;
const MULTI_CONFIDENCE = 0.28;
const VIOLATION_COOLDOWN_MS = 12000;
const POST_CLOSE_LOCK_MS = 6000;

// Natural conversation: wait 5s after user goes silent before AI responds
const USER_PAUSE_GRACE_MS = 5000;
// If user pauses for 2s+ during speech, it's a mid-answer pause — don't interrupt
// const MID_ANSWER_PAUSE_MS = 2000;

const MIN_ANSWER_LENGTH = 15;

const VIOLATION_MSGS: Record<
  string,
  { title: string; body: (r: number) => string; spoken: string }
> = {
  "tab-switch": {
    title: "Tab Switch Detected",
    body: (r) =>
      r > 0
        ? `You navigated away. ${r} warning(s) remaining before automatic submission.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken: "I noticed you switched tabs. Please stay on the interview window.",
  },
  "camera-off": {
    title: "Camera Turned Off",
    body: (r) =>
      r > 0
        ? `Keep camera on. ${r} warning(s) remaining before automatic submission.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken:
      "Please turn your camera back on. Camera must remain on throughout the interview.",
  },
  "no-face": {
    title: "Face Not Detected",
    body: (r) =>
      r > 0
        ? `Sit in front of the camera. ${r} warning(s) remaining before automatic submission.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken:
      "I can't see your face. Please sit directly in front of the camera.",
  },
  "multiple-faces": {
    title: "Multiple People Detected",
    body: (r) =>
      r > 0
        ? `Only the candidate should be visible. ${r} warning(s) remaining.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken: "Multiple people detected. Only the candidate should be visible.",
  },
  "looking-away": {
    title: "Looking Away Detected",
    body: (r) =>
      r > 0
        ? `Please look at the screen. ${r} warning(s) remaining.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken: "Please look at the screen and face the camera.",
  },
  "eyes-closed": {
    title: "Eyes Closed / Drowsy",
    body: (r) =>
      r > 0
        ? `Please stay attentive. ${r} warning(s) remaining.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken: "Your eyes appear closed. Please stay attentive.",
  },
  "fullscreen-exit": {
    title: "Fullscreen Exited",
    body: (r) =>
      r > 0
        ? `Stay in fullscreen. ${r} warning(s) remaining.`
        : `Maximum warnings reached. Interview will be submitted on completion.`,
    spoken: "Please keep the interview in fullscreen mode.",
  },
};

// ─── FULLSCREEN ──────────────────────────────────────────────────────────────
const isInFS = () =>
  !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement
  );
const tryEnterFS = () => {
  try {
    if (!isInFS()) {
      const e = document.documentElement as any;
      (
        e.requestFullscreen ||
        e.webkitRequestFullscreen ||
        e.mozRequestFullScreen
      )?.call(e, { navigationUI: "hide" });
    }
  } catch {}
};
const tryExitFS = async () => {
  try {
    if (isInFS()) {
      const d = document as any;
      await (
        d.exitFullscreen ||
        d.webkitExitFullscreen ||
        d.mozCancelFullScreen
      )?.call(document);
    }
  } catch {}
};

// ─── BEHAVIOR TRACKER ────────────────────────────────────────────────────────
class BehaviorTracker {
  events: Array<{ type: string; timestamp: number }> = [];
  addEvent(t: string) {
    this.events.push({ type: t, timestamp: Date.now() });
  }
  getReport() {
    return {
      totalEvents: this.events.length,
      noFaceCount: this.events.filter((e) => e.type === "no_face").length,
      multipleFacesCount: this.events.filter((e) => e.type === "multiple_faces")
        .length,
      lookingAwayCount: this.events.filter((e) => e.type === "looking_away")
        .length,
      eyesClosedCount: this.events.filter((e) => e.type === "eyes_closed")
        .length,
      events: this.events,
    };
  }
}

// ─── EAR ─────────────────────────────────────────────────────────────────────
const edPt = (a: faceapi.Point, b: faceapi.Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const earVal = (pts: faceapi.Point[]) =>
  pts.length < 6
    ? 1
    : (edPt(pts[1], pts[5]) + edPt(pts[2], pts[4])) /
      (2 * edPt(pts[0], pts[3]));

// ─── ANIMATED AVATAR ─────────────────────────────────────────────────────────
const AnimatedAvatar = React.memo(({ state }: { state: AvatarState }) => {
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [breathe, setBreathe] = useState(false);
  useEffect(() => {
    let t: any;
    const l = () => {
      t = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 130);
          l();
        },
        2500 + Math.random() * 2500,
      );
    };
    l();
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setBreathe((p) => !p), 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (state !== "speaking") {
      setMouth(0);
      return;
    }
    const t = setInterval(() => setMouth((p) => (p % 4) + 1), 90);
    return () => clearInterval(t);
  }, [state]);
  const mD = [
    "M 116 218 Q 140 222 164 218",
    "M 116 216 Q 140 228 164 216",
    "M 114 215 Q 140 234 166 215",
    "M 112 213 Q 140 238 168 213",
    "M 114 215 Q 140 232 166 215",
  ][mouth];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0b1230] via-[#0d1535] to-[#060c22]">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-64 h-80 rounded-full opacity-15"
          style={{
            background: "radial-gradient(ellipse,#2D55FB 0%,transparent 70%)",
            filter: "blur(50px)",
          }}
        />
      </div>
      <motion.div
        animate={{ y: breathe && state === "idle" ? -4 : 0 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      >
        <svg
          width="210"
          height="252"
          viewBox="0 0 280 340"
          style={{ filter: "drop-shadow(0 12px 40px rgba(45,85,251,0.25))" }}
        >
          <defs>
            <linearGradient id="av_skin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8d5b5" />
              <stop offset="45%" stopColor="#f0c4a0" />
              <stop offset="100%" stopColor="#e0a87a" />
            </linearGradient>
            <linearGradient id="av_hair" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3a2c1e" />
              <stop offset="100%" stopColor="#1a140d" />
            </linearGradient>
            <linearGradient id="av_suit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#162050" />
              <stop offset="100%" stopColor="#0b1234" />
            </linearGradient>
            <radialGradient id="av_iris" cx="38%" cy="32%" r="62%">
              <stop offset="0%" stopColor="#5b7bbf" />
              <stop offset="100%" stopColor="#2d4a7a" />
            </radialGradient>
            <filter id="av_shadow">
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="8"
                floodColor="#000"
                floodOpacity="0.28"
              />
            </filter>
          </defs>
          <rect
            x="122"
            y="232"
            width="36"
            height="45"
            rx="6"
            fill="url(#av_skin)"
          />
          <path
            d="M 48 330 Q 50 268 90 256 L 140 266 L 190 256 Q 230 268 232 330 Z"
            fill="url(#av_suit)"
          />
          <path
            d="M 118 258 L 140 278 L 162 258 L 155 250 L 140 268 L 125 250 Z"
            fill="#f0f4ff"
          />
          <path
            d="M 134 263 L 140 308 L 146 263 L 140 258 Z"
            fill="#2D55FB"
            opacity="0.9"
          />
          <path
            d="M 90 256 Q 112 245 130 250 L 118 258 Q 78 272 68 292 Z"
            fill="#101840"
            opacity="0.65"
          />
          <path
            d="M 190 256 Q 168 245 150 250 L 162 258 Q 202 272 212 292 Z"
            fill="#101840"
            opacity="0.65"
          />
          <ellipse
            cx="140"
            cy="146"
            rx="88"
            ry="100"
            fill="url(#av_skin)"
            filter="url(#av_shadow)"
          />
          <path
            d="M 56 108 Q 50 48 140 36 Q 230 48 224 108 L 220 128 Q 212 73 140 66 Q 68 73 60 128 Z"
            fill="url(#av_hair)"
          />
          <path
            d="M 56 108 Q 52 142 58 165 Q 54 132 60 128 Z"
            fill="url(#av_hair)"
          />
          <path
            d="M 224 108 Q 228 142 222 165 Q 226 132 220 128 Z"
            fill="url(#av_hair)"
          />
          <ellipse cx="52" cy="153" rx="10" ry="14" fill="url(#av_skin)" />
          <ellipse cx="228" cy="153" rx="10" ry="14" fill="url(#av_skin)" />
          <path
            d="M 86 106 Q 104 100 120 105"
            stroke="#3a2c1e"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx="103"
            cy="126"
            rx="16"
            ry={blink ? 0.8 : 12}
            fill="white"
          />
          {!blink && (
            <>
              <ellipse cx="105" cy="127" rx="9" ry="9" fill="url(#av_iris)" />
              <ellipse cx="105" cy="127" rx="5" ry="5" fill="#0a0a0a" />
              <circle cx="102" cy="124" r="2.5" fill="white" opacity="0.9" />
            </>
          )}
          <path
            d={
              blink
                ? "M 87 126 Q 103 126 119 126"
                : "M 87 118 Q 103 113 119 118"
            }
            stroke="#3a2c1e"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 160 105 Q 176 100 194 106"
            stroke="#3a2c1e"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx="177"
            cy="126"
            rx="16"
            ry={blink ? 0.8 : 12}
            fill="white"
          />
          {!blink && (
            <>
              <ellipse cx="175" cy="127" rx="9" ry="9" fill="url(#av_iris)" />
              <ellipse cx="175" cy="127" rx="5" ry="5" fill="#0a0a0a" />
              <circle cx="172" cy="124" r="2.5" fill="white" opacity="0.9" />
            </>
          )}
          <path
            d={
              blink
                ? "M 161 126 Q 177 126 193 126"
                : "M 161 118 Q 177 113 193 118"
            }
            stroke="#3a2c1e"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 140 133 L 135 168 Q 140 175 145 168 Z"
            fill="#d4956a"
            opacity="0.28"
          />
          <path
            d="M 130 171 Q 140 177 150 171"
            stroke="#c4856a"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 116 213 Q 128 208 140 210 Q 152 208 164 213"
            stroke="#c0766a"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={mD}
            stroke="#a85a5a"
            strokeWidth="2.5"
            fill={mouth > 1 ? "#7a3030" : "none"}
            strokeLinecap="round"
          />
          {mouth > 1 && (
            <path
              d="M 120 216 Q 140 228 160 216 L 158 220 Q 140 232 122 220 Z"
              fill="white"
              opacity="0.88"
            />
          )}
        </svg>
      </motion.div>
      <div className="mt-2 h-5 flex items-center justify-center">
        {state === "thinking" && (
          <div className="flex gap-1.5 items-center">
            {[0, 0.15, 0.3].map((d, i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#2D55FB]"
                animate={{ y: ["0px", "-6px", "0px"], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: d }}
              />
            ))}
            <span className="text-white/35 text-[10px] ml-1 font-medium">
              Thinking…
            </span>
          </div>
        )}
        {state === "speaking" && (
          <div className="flex items-center gap-1">
            {[0, 0.08, 0.16, 0.24, 0.16, 0.08].map((d, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-[#2D55FB]"
                animate={{ height: ["3px", `${6 + (i % 3) * 4}px`, "3px"] }}
                transition={{
                  duration: 0.45,
                  repeat: Infinity,
                  delay: d,
                  ease: "easeInOut",
                }}
              />
            ))}
            <span className="text-[#2D55FB] text-[10px] ml-1.5 font-semibold">
              Speaking
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── AVATAR TILE ─────────────────────────────────────────────────────────────
interface AvatarTileProps {
  mode: AvatarMode;
  state: AvatarState;
  heygenVideoRef: React.RefObject<HTMLVideoElement | null>;
  ganAiVideoUrl: string | null;
  ganAiLoading: boolean;
  heygenReady: boolean;
}
const AvatarTile = React.memo(
  ({
    mode,
    state,
    heygenVideoRef,
    ganAiVideoUrl,
    ganAiLoading,
    heygenReady,
  }: AvatarTileProps) => {
    const ganRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (ganAiVideoUrl && ganRef.current) {
        ganRef.current.src = ganAiVideoUrl;
        ganRef.current.play().catch(() => {});
      }
    }, [ganAiVideoUrl]);
    return (
      <div className="absolute inset-0">
        <AnimatedAvatar
          state={mode === "heygen" && heygenReady ? "idle" : state}
        />
        {mode === "heygen" && (
          <video
            ref={heygenVideoRef}
            playsInline
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${heygenReady ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {mode === "ganai" && ganAiVideoUrl && (
          <video
            ref={ganRef}
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onEnded={() => {
              if (ganRef.current) ganRef.current.src = "";
            }}
          />
        )}
        <div className="absolute top-3 left-3 z-20">
          {mode === "heygen" && (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-sm text-[9px] font-semibold ${heygenReady ? "bg-green-500/15 border-green-500/30 text-green-300" : "bg-amber-500/15 border-amber-500/30 text-amber-300"}`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${heygenReady ? "bg-green-400" : "bg-amber-400"} animate-pulse`}
              />
              {heygenReady ? "Live Avatar" : "Connecting…"}
            </div>
          )}
          {mode === "ganai" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-sm bg-purple-500/15 border-purple-500/30 text-purple-300 text-[9px] font-semibold">
              <div
                className={`w-1.5 h-1.5 rounded-full ${ganAiLoading ? "bg-amber-400 animate-pulse" : "bg-purple-400"}`}
              />
              {ganAiLoading ? "Rendering…" : "Gan.AI"}
            </div>
          )}
        </div>
      </div>
    );
  },
);

const WaveBar = ({ delay, active }: { delay: number; active: boolean }) => (
  <motion.span
    className="inline-block w-0.75 rounded-full bg-white/80 mx-[1.5px]"
    style={{ minHeight: 3 }}
    animate={
      active
        ? { height: ["3px", "14px", "5px", "18px", "3px"] }
        : { height: "3px" }
    }
    transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut", delay }}
  />
);
const AudioWave = ({ active = true }: { active?: boolean }) => (
  <div
    className={`flex items-center px-2.5 py-1.5 rounded-full shadow-lg transition-all ${active ? "bg-[#2D55FB] shadow-[#2D55FB]/40" : "bg-white/10"}`}
  >
    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mr-1.5 shrink-0">
      <span className="flex gap-0.5">
        <span className="w-0.75 h-2.25 bg-white rounded-sm block" />
        <span className="w-0.75 h-2.25 bg-white rounded-sm block" />
      </span>
    </div>
    {[
      0, 0.07, 0.14, 0.21, 0.1, 0.28, 0.05, 0.18, 0.12, 0.24, 0.08, 0.2, 0.16,
    ].map((d, i) => (
      <WaveBar key={i} delay={d} active={active} />
    ))}
  </div>
);
const MicCircle = ({ muted }: { muted: boolean }) => (
  <div
    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${muted ? "bg-red-500 shadow-red-500/40" : "bg-[#2D55FB] shadow-[#2D55FB]/40"}`}
  >
    {muted ? (
      <MicOff className="h-4 w-4 text-white" />
    ) : (
      <Mic className="h-4 w-4 text-white" />
    )}
  </div>
);
const CtrlBtn = ({
  onClick,
  active = true,
  danger = false,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.88 }}
    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-colors ${danger ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/40" : active ? "bg-white hover:bg-gray-100 text-gray-800" : "bg-white text-red-500"}`}
  >
    {children}
  </motion.button>
);
const UserVideo = React.memo(
  ({
    camOn,
    streamReady,
    username,
    onVideoMount,
  }: {
    camOn: boolean;
    streamReady: boolean;
    username: string;
    onVideoMount: (el: HTMLVideoElement | null) => void;
  }) => (
    <>
      <video
        ref={onVideoMount}
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn && streamReady ? "opacity-100" : "opacity-0"}`}
        style={{ transform: "scaleX(-1)" }}
      />
      {(!camOn || !streamReady) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e] to-[#060c25]">
          <div className="w-16 h-16 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center mb-2">
            {streamReady ? (
              <VideoOff className="h-8 w-8 text-[#2D55FB]/60" />
            ) : (
              <User className="h-8 w-8 text-[#2D55FB]/50" />
            )}
          </div>
          <span className="text-white/30 text-xs">
            {streamReady ? "Camera Off" : username}
          </span>
        </div>
      )}
    </>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION MODAL — updated: after MAX_VIOLATIONS, interview continues with flag
// ─────────────────────────────────────────────────────────────────────────────
const ViolationModal = React.memo(
  ({ alert, onClose }: { alert: AlertState; onClose: () => void }) => {
    const atMax = alert.count >= MAX_VIOLATIONS;
    const firedRef = useRef(false);
    const safeClose = useCallback(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onClose();
    }, [onClose]);

    // Auto-close after 6s — interview continues even at max violations
    useEffect(() => {
      const t = setTimeout(safeClose, atMax ? 5000 : 8000);
      return () => clearTimeout(t);
    }, [safeClose, atMax]);

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
          onClick={safeClose}
        />
        <div
          className={`relative z-10 w-full max-w-sm mx-4 rounded-2xl border p-6 shadow-2xl ${atMax ? "bg-red-950/95 border-red-500/60" : "bg-[#0d1836] border-amber-500/50"}`}
          style={{
            animation: "violPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <style>{`@keyframes violPop{from{opacity:0;transform:scale(0.88) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${atMax ? "bg-red-500/25" : "bg-amber-500/25"}`}
          >
            {atMax ? (
              <ShieldAlert className="h-6 w-6 text-red-400" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            )}
          </div>
          <h3 className="text-white font-bold text-lg mb-1">
            {atMax ? "Maximum Warnings Reached" : alert.title}
          </h3>
          <p
            className={`text-sm mb-2 ${atMax ? "text-red-400" : "text-amber-400"}`}
          >
            {atMax
              ? "Interview flagged — will auto-submit when complete"
              : `Warning ${alert.count} of ${MAX_VIOLATIONS}`}
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-5">
            {alert.body}
          </p>
          {!atMax && (
            <div className="flex gap-1.5 mb-5">
              {[...Array(MAX_VIOLATIONS)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${i < alert.count ? "bg-amber-400" : "bg-white/10"}`}
                />
              ))}
            </div>
          )}
          {atMax && (
            <div className="flex gap-1.5 mb-5">
              {[...Array(MAX_VIOLATIONS)].map((_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full bg-red-500" />
              ))}
            </div>
          )}
          <button
            onClick={safeClose}
            className={`w-full py-2.5 rounded-xl font-semibold text-white text-sm transition-colors ${atMax ? "bg-red-600 hover:bg-red-500" : "bg-[#2D55FB] hover:bg-[#1e3fd4]"}`}
          >
            {atMax ? "Continue Interview" : "I Understand — Continue"}
          </button>
          <p className="text-center text-white/30 text-[10px] mt-2">
            Auto-closing in {atMax ? 5 : 8}s
          </p>
        </div>
      </div>
    );
  },
);

// ─── TURN INDICATOR ─────────────────────────────────────────────────────────
const TurnIndicator = ({
  turnState,
  pauseCountdown,
}: {
  turnState: TurnState;
  pauseCountdown: number;
}) => {
  if (turnState === "ai-speaking") {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-600/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
        <div className="flex gap-0.5 items-center">
          {[0, 0.08, 0.16].map((d, i) => (
            <motion.div
              key={i}
              className="w-0.5 h-3 bg-white rounded-full"
              animate={{ scaleY: [0.4, 1, 0.4] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
        AI Speaking
      </div>
    );
  }
  if (turnState === "user-speaking") {
    return (
      <div className="flex items-center gap-1.5 bg-blue-600/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
        <div className="flex gap-0.5 items-center">
          {[0, 0.08, 0.16].map((d, i) => (
            <motion.div
              key={i}
              className="w-0.5 h-3 bg-white rounded-full"
              animate={{ scaleY: [0.4, 1, 0.4] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
        You're Speaking
      </div>
    );
  }
  if (turnState === "user-turn") {
    return (
      <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/40 backdrop-blur-sm text-blue-300 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        Your Turn to Respond
        {pauseCountdown > 0 && (
          <span className="text-blue-400/70 text-[10px]">
            ({pauseCountdown}s)
          </span>
        )}
      </div>
    );
  }
  if (turnState === "processing") {
    return (
      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/50 px-3 py-1.5 rounded-full text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Processing…
      </div>
    );
  }
  return null;
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const VideoInterview: React.FC = () => {
  const { interviewInfo, userData } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const interview_id = id || "";
  const candidateId: any = sessionStorage.getItem("candidateDetails");
  const cand_id = JSON.parse(candidateId);

  const [screen, setScreen] = useState<Screen>("lobby");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [vapi, setVapi] = useState<any>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isGenFeedback, setIsGenFeedback] = useState(false);
  const [avatarSub, setAvatarSub] = useState("Waiting for AI to speak...");
  const [userSub, setUserSub] = useState("Your transcript will appear here...");
  const [resumeData, setResumeData] = useState<any>(null);
  const [isResumeInterview, setIsResumeInterview] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
  const [noiseWarning, setNoiseWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFSBanner, setShowFSBanner] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"ok" | "warn" | "unknown">(
    "unknown",
  );
  const [noFaceVisible, setNoFaceVisible] = useState(false);
  const [, setHeygenStreamLive] = useState(false);
  const [, setVapiReady] = useState(false);

  // Natural conversation turn state
  const [turnState, setTurnState] = useState<TurnState>("idle");
  const [pauseCountdown, setPauseCountdown] = useState(0);

  const [avatarMode] = useState<AvatarMode>(
    USE_HEYGEN ? "heygen" : USE_GANAI ? "ganai" : "animated",
  );
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [heygenReady, setHeygenReady] = useState(false);
  const [ganAiVideoUrl, setGanAiVideoUrl] = useState<string | null>(null);
  const [ganAiLoading, setGanAiLoading] = useState(false);

  const [questionProgress, setQuestionProgress] = useState(0);

  const heygenVideoRef = useRef<HTMLVideoElement>(null);
  const heygenSvcRef = useRef<HeyGenService | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lobbyVidRef = useRef<HTMLVideoElement>(null);
  const spotlightVidRef = useRef<HTMLVideoElement | null>(null);
  const gridUserVidRef = useRef<HTMLVideoElement | null>(null);
  const behaviorVidRef = useRef<HTMLVideoElement>(null);

  const conversationRef = useRef<any[]>([]);
  const aiTranscriptBuf = useRef("");
  const userTranscriptBuf = useRef("");
  const detectionRef = useRef<any>(null);
  const behaviorTracker = useRef(new BehaviorTracker());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCheckRef = useRef<any>(null);
  const noiseEpisodeRef = useRef(false);
  const noiseSilentRef = useRef(0);

  const alertCountRef = useRef(0);
  const vapiRef = useRef<any>(null);
  const isCallActiveRef = useRef(false);
  const micOnRef = useRef(true);
  const camAlertRef = useRef(false);
  const interviewEndedRef = useRef(false);
  const trigViolRef = useRef<(t: string) => void>(() => {});

  const violLockedRef = useRef(false);
  const lastViolAt = useRef(0);

  const ticks = useRef({ noface: 0, multi: 0, gaze: 0, eyes: 0 });

  const lastSpeechRef = useRef(Date.now());
  const silenceRef = useRef<any>(null);
  const silenceWarnedRef = useRef(false);
  const silenceWarnCount = useRef(0);
  const questionCount = useRef(0);
  const maxQuestions = useRef(0);
  const questionLimitReached = useRef(false);
  const preCheckDone = useRef(false);
  const closingInProgress = useRef(false);

  const aiIsSpeakingRef = useRef(false);
  const candidateRespondedRef = useRef(false);

  // Natural conversation refs
  const userSpeechEndedAtRef = useRef<number>(0);
  const pauseGraceTimerRef = useRef<any>(null);
  const pauseCountdownTimerRef = useRef<any>(null);
  const userIsActivelyTalkingRef = useRef(false);
  const lastUserSpeechActivityRef = useRef(Date.now());
  // Track if we're in a mid-answer pause (user paused but hasn't finished)
  const midAnswerPauseTimerRef = useRef<any>(null);
  const location = useLocation();
  const selectedVoice =
    (location.state?.voice as "female" | "male") ?? "female";
  useEffect(() => {
    vapiRef.current = vapi;
  }, [vapi]);
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);
  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  // ── Keyboard lock ──────────────────────────────────────────────────────
  useEffect(() => {
    const blk = (e: KeyboardEvent) => {
      if (isCallActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    const bCtx = (e: MouseEvent) => {
      if (isCallActiveRef.current) e.preventDefault();
    };
    const bClp = (e: ClipboardEvent) => {
      if (isCallActiveRef.current) e.preventDefault();
    };
    const opts = { capture: true, passive: false };
    document.addEventListener("keydown", blk, opts);
    document.addEventListener("keyup", blk, opts);
    document.addEventListener("keypress", blk, opts);
    document.addEventListener("contextmenu", bCtx, {
      capture: true,
      passive: false,
    });
    document.addEventListener("copy", bClp, { capture: true });
    document.addEventListener("cut", bClp, { capture: true });
    document.addEventListener("paste", bClp, { capture: true });
    return () => {
      document.removeEventListener("keydown", blk, { capture: true } as any);
      document.removeEventListener("keyup", blk, { capture: true } as any);
      document.removeEventListener("keypress", blk, { capture: true } as any);
      document.removeEventListener("contextmenu", bCtx, {
        capture: true,
      } as any);
      document.removeEventListener("copy", bClp, { capture: true } as any);
      document.removeEventListener("cut", bClp, { capture: true } as any);
      document.removeEventListener("paste", bClp, { capture: true } as any);
    };
  }, []);

  // ── Fullscreen ─────────────────────────────────────────────────────────
  useEffect(() => {
    setIsFullscreen(isInFS());
    const onChange = () => {
      const f = isInFS();
      setIsFullscreen(f);
      if (!f && isCallActiveRef.current) {
        tryEnterFS();
        setShowFSBanner(true);
        trigViolRef.current("fullscreen-exit");
      }
    };
    [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
    ].forEach((e) => document.addEventListener(e, onChange));
    const poll = setInterval(() => setIsFullscreen(isInFS()), 2000);
    return () => {
      [
        "fullscreenchange",
        "webkitfullscreenchange",
        "mozfullscreenchange",
      ].forEach((e) => document.removeEventListener(e, onChange));
      clearInterval(poll);
    };
  }, []);

  // ── Stream attach helpers ──────────────────────────────────────────────
  const attachStream = useCallback((el: HTMLVideoElement | null) => {
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);
  const onSpotlightMount = useCallback(
    (el: HTMLVideoElement | null) => {
      spotlightVidRef.current = el;
      attachStream(el);
    },
    [attachStream],
  );
  const onGridUserMount = useCallback(
    (el: HTMLVideoElement | null) => {
      gridUserVidRef.current = el;
      attachStream(el);
    },
    [attachStream],
  );
  useEffect(() => {
    if (!streamRef.current) return;
    [spotlightVidRef.current, gridUserVidRef.current].forEach(attachStream);
  }, [streamReady, attachStream]);

  // ── Camera + Audio init ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: true,
        });
        streamRef.current = stream;
        setStreamReady(true);
        if (lobbyVidRef.current) {
          lobbyVidRef.current.srcObject = stream;
          lobbyVidRef.current.play().catch(() => {});
        }
        if (behaviorVidRef.current) {
          behaviorVidRef.current.srcObject = stream;
          behaviorVidRef.current.play().catch(() => {});
        }
        try {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          ctx.createMediaStreamSource(stream).connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
          audioCheckRef.current = setInterval(() => {
            if (!isCallActiveRef.current || !analyserRef.current) return;
            const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(arr);
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            if (avg > 38) {
              noiseSilentRef.current = 0;
              if (!noiseEpisodeRef.current) {
                noiseEpisodeRef.current = true;
                setNoiseWarning(true);
              }
            } else {
              noiseSilentRef.current++;
              if (noiseSilentRef.current >= 3) {
                noiseEpisodeRef.current = false;
                noiseSilentRef.current = 0;
              }
            }
          }, 2000);
        } catch {}
      } catch (e) {
        console.warn("Camera unavailable:", e);
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      if (audioCheckRef.current) clearInterval(audioCheckRef.current);
    };
  }, []);

  useEffect(() => {
    if (screen === "lobby") attachStream(lobbyVidRef.current);
  }, [screen, attachStream]);

  const stopAllProctoring = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    if (silenceRef.current) clearInterval(silenceRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── endInterview — only called when a real end condition is met ────────
  const endInterview = useCallback(async () => {
    if (interviewEndedRef.current) return;
    interviewEndedRef.current = true;
    stopAllProctoring();
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setIsSpeaking(false);
    setAvatarState("idle");
    setTurnState("idle");
    // Clear pause timers
    if (pauseGraceTimerRef.current) clearTimeout(pauseGraceTimerRef.current);
    if (pauseCountdownTimerRef.current)
      clearInterval(pauseCountdownTimerRef.current);
    if (midAnswerPauseTimerRef.current)
      clearTimeout(midAnswerPauseTimerRef.current);
    try {
      vapiRef.current?.stop();
    } catch {}
    if (heygenSvcRef.current) {
      await heygenSvcRef.current.destroy();
      heygenSvcRef.current = null;
    }
    await tryExitFS();
  }, [stopAllProctoring]);

  const speakWarning = useCallback((type: string) => {
    const v = vapiRef.current;
    if (!v) return;
    const spoken =
      VIOLATION_MSGS[type]?.spoken ?? "You have received a warning.";
    try {
      v.send({
        type: "add-message",
        message: {
          role: "system",
          content: `[PROCTOR — briefly acknowledge in 1 short sentence]: "${spoken}"`,
        },
      });
    } catch {}
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // triggerViolation — warnings accumulate but DON'T terminate interview
  // ─────────────────────────────────────────────────────────────────────────
  const triggerViolation = useCallback(
    (type: string) => {
      if (!isCallActiveRef.current) return;
      if (violLockedRef.current) return;
      if (Date.now() - lastViolAt.current < VIOLATION_COOLDOWN_MS) return;

      violLockedRef.current = true;
      lastViolAt.current = Date.now();
      ticks.current = { noface: 0, multi: 0, gaze: 0, eyes: 0 };

      alertCountRef.current++;
      const count = alertCountRef.current;
      const cfg = VIOLATION_MSGS[type] ?? {
        title: "Violation",
        body: (r: number) => `${r} warning(s) remaining.`,
      };
      const remaining = Math.max(0, MAX_VIOLATIONS - count);

      console.warn(
        `[Proctor] WARNING #${count} type=${type} remaining=${remaining}`,
      );
      behaviorTracker.current.addEvent(type.replace(/-/g, "_"));

      setActiveAlert({
        type,
        count,
        title: cfg.title,
        body: cfg.body(remaining),
      });

      // Speak warning — only a brief note, not disruptive
      speakWarning(type);
    },
    [speakWarning],
  );

  useEffect(() => {
    trigViolRef.current = triggerViolation;
  }, [triggerViolation]);

  const handleAlertClose = useCallback(() => {
    const type = activeAlert?.type;
    setActiveAlert(null);
    setTimeout(() => {
      violLockedRef.current = false;
      ticks.current = { noface: 0, multi: 0, gaze: 0, eyes: 0 };
    }, POST_CLOSE_LOCK_MS);
    // Interview NEVER terminates on warning close — only on real end conditions
    if (type === "fullscreen-exit") {
      tryEnterFS();
      setShowFSBanner(false);
    }
  }, [activeAlert]);

  // ── Tab-switch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCallActive) return;
    const h = () => {
      if (document.hidden) triggerViolation("tab-switch");
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [isCallActive, triggerViolation]);

  // ── Camera-off ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCallActive) return;
    if (!camOn) {
      if (!camAlertRef.current) {
        camAlertRef.current = true;
        triggerViolation("camera-off");
      }
    } else camAlertRef.current = false;
  }, [camOn, isCallActive, triggerViolation]);

  // ─────────────────────────────────────────────────────────────────────────
  // FACE DETECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCallActive) {
      clearInterval(detectionRef.current);
      return;
    }

    let mlReady = false;
    loadFaceModels()
      .then(() => {
        mlReady = true;
      })
      .catch((e) => console.warn("[Proctor] face-api failed:", e));

    const canvasAnalyse = (vid: HTMLVideoElement) => {
      const W = 160,
        H = 120;
      const cnv = document.createElement("canvas");
      cnv.width = W;
      cnv.height = H;
      const ctx = cnv.getContext("2d", { willReadFrequently: true });
      if (!ctx)
        return { dark: false, skinRatio: 0, gazeDrift: 0, skinBlobs: 0 };
      ctx.drawImage(vid, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      let bright = 0,
        skinCount = 0,
        skinSumX = 0;
      const skinMap = new Uint8Array(W * H);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        bright += (r + g + b) / 3;
        const isSkin =
          r > 50 &&
          g > 25 &&
          b > 10 &&
          r > b &&
          r > g &&
          r - Math.min(g, b) > 8 &&
          Math.abs(r - g) < 90 &&
          r < 250;
        const px = i / 4;
        if (isSkin) {
          skinMap[px] = 1;
          skinCount++;
          skinSumX += px % W;
        }
      }
      const total = W * H,
        skinRatio = skinCount / total;
      let gazeDrift = 0;
      if (skinCount > 50) {
        const cx = skinSumX / skinCount / W;
        gazeDrift = Math.abs(cx - 0.5) * 2;
      }
      const third = Math.floor(W / 3),
        thirds = [0, 0, 0];
      for (let px = 0; px < total; px++) {
        if (skinMap[px]) thirds[Math.min(2, Math.floor((px % W) / third))]++;
      }
      const skinBlobs = thirds.filter((t) => t > total * 0.02).length;
      return { dark: bright / total < 18, skinRatio, gazeDrift, skinBlobs };
    };

    const mlAnalyse = async (vid: HTMLVideoElement) => {
      if (!mlReady) return null;
      try {
        const dets = await faceapi
          .detectAllFaces(
            vid,
            new faceapi.SsdMobilenetv1Options({
              minConfidence: MULTI_CONFIDENCE,
            }),
          )
          .withFaceLandmarks();
        if (dets.length > 1)
          return { faceCount: dets.length, gazeHard: false, eyesHard: false };
        if (dets.length === 0)
          return { faceCount: 0, gazeHard: false, eyesHard: false };
        const { detection, landmarks } = dets[0];
        if (detection.score < 0.35)
          return { faceCount: 1, gazeHard: false, eyesHard: false };
        const nose = landmarks.getNose(),
          jaw = landmarks.getJawOutline(),
          lEye = landmarks.getLeftEye(),
          rEye = landmarks.getRightEye();
        let gazeHard = false;
        if (nose?.length && jaw?.length) {
          const jL = jaw[0].x,
            jR = jaw[jaw.length - 1].x,
            jawW = jR - jL,
            jawM = (jL + jR) / 2;
          if (jawW > 15) {
            const tip = nose[nose.length - 1],
              hOff = Math.abs(tip.x - jawM) / jawW;
            let eyeOff = 0;
            if (lEye?.length && rEye?.length) {
              const em =
                (lEye.reduce((s, p) => s + p.x, 0) / lEye.length +
                  rEye.reduce((s, p) => s + p.x, 0) / rEye.length) /
                2;
              eyeOff = Math.abs(em - jawM) / jawW;
            }
            gazeHard = hOff > GAZE_HARD || eyeOff > GAZE_HARD;
          }
        }
        let eyesHard = false;
        if (lEye?.length >= 6 && rEye?.length >= 6)
          eyesHard = (earVal(lEye) + earVal(rEye)) / 2 < EAR_HARD;
        return { faceCount: 1, gazeHard, eyesHard };
      } catch (e) {
        console.warn("[Proctor] mlAnalyse:", e);
        return null;
      }
    };

    detectionRef.current = setInterval(async () => {
      if (!isCallActiveRef.current) return;
      if (violLockedRef.current) return;
      const vid = behaviorVidRef.current;
      if (!vid) return;
      if (!vid.srcObject && streamRef.current) {
        vid.srcObject = streamRef.current;
        vid.play().catch(() => {});
        return;
      }
      if (vid.readyState < 2 || vid.videoWidth === 0 || vid.videoHeight === 0)
        return;
      const T = ticks.current;
      const cv = canvasAnalyse(vid);
      if (cv.dark) {
        setNoFaceVisible(true);
        setFaceStatus("warn");
        T.noface++;
        T.gaze = 0;
        T.multi = 0;
        T.eyes = 0;
        if (T.noface >= 2) {
          T.noface = 0;
          trigViolRef.current("no-face");
        }
        return;
      }
      if (cv.skinRatio < 0.018) {
        setNoFaceVisible(true);
        setFaceStatus("warn");
        T.noface++;
        T.gaze = 0;
        T.multi = 0;
        T.eyes = 0;
        if (T.noface >= HARD_TICKS) {
          T.noface = 0;
          trigViolRef.current("no-face");
        }
        return;
      }
      const ml = await mlAnalyse(vid);
      if (ml !== null) {
        if (ml.faceCount === 0) {
          setNoFaceVisible(true);
          setFaceStatus("warn");
          T.noface++;
          T.gaze = 0;
          T.eyes = 0;
          if (T.noface >= HARD_TICKS) {
            T.noface = 0;
            trigViolRef.current("no-face");
          }
          return;
        }
        if (ml.faceCount > 1) {
          setFaceStatus("warn");
          T.multi++;
          T.noface = 0;
          T.gaze = 0;
          T.eyes = 0;
          if (T.multi >= MULTI_TICKS) {
            T.multi = 0;
            trigViolRef.current("multiple-faces");
          }
          return;
        }
        T.noface = 0;
        T.multi = 0;
        setNoFaceVisible(false);
        if (ml.gazeHard) {
          setFaceStatus("warn");
          T.gaze++;
          if (T.gaze >= HARD_TICKS) {
            T.gaze = 0;
            trigViolRef.current("looking-away");
          }
        } else T.gaze = 0;
        if (ml.eyesHard) {
          T.eyes++;
          if (T.eyes >= HARD_TICKS + 1) {
            T.eyes = 0;
            trigViolRef.current("eyes-closed");
          }
        } else T.eyes = 0;
        if (!ml.gazeHard && !ml.eyesHard) setFaceStatus("ok");
      } else {
        T.noface = 0;
        setNoFaceVisible(false);
        if (cv.skinBlobs >= 3 && cv.skinRatio > 0.08) {
          setFaceStatus("warn");
          T.multi++;
          if (T.multi >= HARD_TICKS) {
            T.multi = 0;
            trigViolRef.current("multiple-faces");
          }
        } else T.multi = 0;
        if (cv.gazeDrift > 0.28 && cv.skinRatio > 0.03) {
          setFaceStatus("warn");
          T.gaze++;
          if (T.gaze >= HARD_TICKS) {
            T.gaze = 0;
            trigViolRef.current("looking-away");
          }
        } else {
          T.gaze = 0;
          setFaceStatus("ok");
        }
      }
    }, TICK_MS);

    return () => clearInterval(detectionRef.current);
  }, [isCallActive]);

  // ── Interview info ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!interviewInfo) {
      navigate(userPath("instructions", interview_id));
      return;
    }
    const dur =
      (parseInt(String(interviewInfo?.duration || "5"), 10) || 5) * 60;
    setTimeLeft(dur);
    setIsResumeInterview(
      (interviewInfo?.type || interviewInfo?.examType || "") === "resume-based",
    );
    maxQuestions.current =
      parseInt(String(interviewInfo?.numberOfQuestions || "5"), 10) || 5;
    setLoading(false);
  }, [interviewInfo, interview_id, navigate]);

  useEffect(() => {
    if (isResumeInterview)
      fetch(`/api/resumes/${interview_id}`)
        .then((r) => r.json())
        .then(({ data }) => setResumeData(data))
        .catch(() => {});
  }, [isResumeInterview, interview_id]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (screen === "lobby") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [screen]);

  // Time exhausted → submit
  useEffect(() => {
    if (!isCallActive || timeLeft <= 0) return;
    const t = setInterval(
      () =>
        setTimeLeft((s) => {
          if (s <= 1) {
            clearInterval(t);
            endInterview(); // TIME EXHAUSTED → submit
            return 0;
          }
          return s - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [isCallActive, endInterview]);

  const initHeyGen = useCallback(async () => {
    if (avatarMode !== "heygen") return;
    const svc = new HeyGenService(heygenVideoRef);
    svc.onStateChange = (s) => setAvatarState(s ? "speaking" : "idle");
    svc.onStreamReady = () => {
      setHeygenReady(true);
      setHeygenStreamLive(true);
    };
    heygenSvcRef.current = svc;
    const ok = await svc.init();
    if (!ok) setHeygenStreamLive(true);
  }, [avatarMode]);

  const generateGanGreeting = useCallback(
    async (text: string) => {
      if (avatarMode !== "ganai") return;
      setGanAiLoading(true);
      try {
        const rid = await ganAi.generate(text);
        if (!rid) return;
        const url = await ganAi.poll(rid);
        if (url) setGanAiVideoUrl(url);
      } catch {
      } finally {
        setGanAiLoading(false);
      }
    },
    [avatarMode],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // NATURAL PAUSE HANDLING
  // Clear any grace timer — user started talking again
  // ─────────────────────────────────────────────────────────────────────────
  const clearPauseTimers = useCallback(() => {
    if (pauseGraceTimerRef.current) {
      clearTimeout(pauseGraceTimerRef.current);
      pauseGraceTimerRef.current = null;
    }
    if (pauseCountdownTimerRef.current) {
      clearInterval(pauseCountdownTimerRef.current);
      pauseCountdownTimerRef.current = null;
    }
    if (midAnswerPauseTimerRef.current) {
      clearTimeout(midAnswerPauseTimerRef.current);
      midAnswerPauseTimerRef.current = null;
    }
    setPauseCountdown(0);
  }, []);

  // Called when user speech ends — start grace period before AI responds
  const startPauseGrace = useCallback(() => {
    clearPauseTimers();
    userSpeechEndedAtRef.current = Date.now();

    // Show a countdown in UI
    let countdown = Math.ceil(USER_PAUSE_GRACE_MS / 1000);
    setPauseCountdown(countdown);
    pauseCountdownTimerRef.current = setInterval(() => {
      countdown--;
      setPauseCountdown(Math.max(0, countdown));
      if (countdown <= 0) {
        clearInterval(pauseCountdownTimerRef.current);
        pauseCountdownTimerRef.current = null;
      }
    }, 1000);

    // After grace period, signal to Vapi that user is done
    pauseGraceTimerRef.current = setTimeout(() => {
      setPauseCountdown(0);
      userIsActivelyTalkingRef.current = false;
      setTurnState("processing");
    }, USER_PAUSE_GRACE_MS);
  }, [clearPauseTimers]);

  // ── Vapi ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // const inst = new Vapi("6736f532-acfb-41f4-a5ac-0fe67cbc7be7");
    const inst = new Vapi("aa7ce731-2288-4878-870d-68f9d0335519");
    setVapi(inst);

    inst.on("speech-start", () => {
      aiIsSpeakingRef.current = true;
      candidateRespondedRef.current = false;
      setIsSpeaking(true);
      setTurnState("ai-speaking");
      setAvatarState("speaking");
      // Clear any user pause timers — AI took over
      clearPauseTimers();
    });

    inst.on("speech-end", () => {
      aiIsSpeakingRef.current = false;
      setIsSpeaking(false);
      if (avatarMode !== "heygen") setAvatarState("idle");

      const text = aiTranscriptBuf.current.trim();
      if (text) {
        setAvatarSub(text);
        if (avatarMode === "heygen" && heygenSvcRef.current && heygenReady)
          heygenSvcRef.current.speak(text).catch(() => {});
        aiTranscriptBuf.current = "";
      }

      // Switch to user's turn after AI finishes
      setTurnState("user-turn");

      if (closingInProgress.current && isCallActiveRef.current) {
        closingInProgress.current = false;
        setTimeout(() => {
          try {
            vapiRef.current?.stop();
          } catch {}
        }, 3500);
      }
    });

    inst.on("call-start", () => {
      setIsCallActive(true);
      isCallActiveRef.current = true;
      setAvatarState("thinking");
      setVapiReady(true);
      setTurnState("ai-speaking");
    });

    inst.on("error", (e: any) => console.error("Vapi:", e));

    inst.on("message", (msg: any) => {
      if (msg?.type === "transcript") {
        const text = msg.transcript || msg.text || "";
        const isFinal = msg.transcriptType === "final"; // ← ADD THIS CHECK

        if (msg.role === "assistant") {
          aiTranscriptBuf.current = text;
          setAvatarSub(text);
          if (!aiIsSpeakingRef.current) setAvatarState("thinking");

          // Only persist when Vapi signals the utterance is complete
          if (isFinal && text.trim()) {
            conversationRef.current.push({
              type: "transcript",
              role: "assistant",
              transcript: text.trim(),
              timestamp: Date.now(),
            });
            aiTranscriptBuf.current = "";
          }

          if (text.includes("?")) {
            const lt = text.toLowerCase();
            const isAudioCheck =
              lt.includes("can you hear") ||
              lt.includes("audio") ||
              lt.includes("video working") ||
              lt.includes("hear me");
            if (!isAudioCheck && !preCheckDone.current)
              preCheckDone.current = true;
          }
        } else if (msg.role === "user") {
          if (!micOnRef.current) return;

          userTranscriptBuf.current = text;
          setUserSub(text);
          setIsListening(true);
          setTurnState("user-speaking");
          lastSpeechRef.current = Date.now();
          lastUserSpeechActivityRef.current = Date.now();
          silenceWarnedRef.current = false;
          silenceWarnCount.current = 0;

          // Only persist + count questions when utterance is complete
          if (isFinal && text.trim()) {
            conversationRef.current.push({
              type: "transcript",
              role: "user",
              transcript: text.trim(),
              timestamp: Date.now(),
            });

            if (
              preCheckDone.current &&
              !aiIsSpeakingRef.current &&
              !questionLimitReached.current &&
              !candidateRespondedRef.current &&
              text.trim().length >= MIN_ANSWER_LENGTH
            ) {
              candidateRespondedRef.current = true;
              questionCount.current++;
              setQuestionProgress(questionCount.current);

              if (questionCount.current >= maxQuestions.current) {
                questionLimitReached.current = true;
                setTimeout(() => {
                  try {
                    closingInProgress.current = true;
                    vapiRef.current?.send({
                      type: "add-message",
                      message: {
                        role: "system",
                        content: `[SYSTEM]: The candidate has now answered all ${maxQuestions.current} questions. Do NOT ask any more questions. Give a warm farewell then end the call.`,
                      },
                    });
                  } catch {}
                }, 1000);
              }
            }

            userTranscriptBuf.current = "";
          }
        }
      } else {
        // Non-transcript messages (tool calls, etc.) — store as-is
        conversationRef.current.push(msg);
      }
    });

    // User starts speaking → cancel any grace timer
    (inst as any).on("user-speech-start", () => {
      if (!micOnRef.current) return;
      setIsListening(true);
      setTurnState("user-speaking");
      userIsActivelyTalkingRef.current = true;
      lastSpeechRef.current = Date.now();
      lastUserSpeechActivityRef.current = Date.now();
      silenceWarnedRef.current = false;
      silenceWarnCount.current = 0;
      // Cancel any pending grace/pause timers — user is talking
      clearPauseTimers();
    });

    // User stops speaking → start grace period (5s before AI responds)
    (inst as any).on("user-speech-end", () => {
      setIsListening(false);
      if (!micOnRef.current) return;
      if (userTranscriptBuf.current.trim()) {
        setUserSub(userTranscriptBuf.current.trim());
        userTranscriptBuf.current = "";
      }
      // Start natural pause grace period
      startPauseGrace();
      setTurnState("user-turn"); // Show "your turn" with countdown
    });

    return () => {
      inst.stop();
    };
  }, [avatarMode, heygenReady, clearPauseTimers, startPauseGrace]);

  // ── Start call ─────────────────────────────────────────────────────────
  const startCall = useCallback(() => {
    if (!vapi || !interviewInfo) return;

    alertCountRef.current = 0;
    questionCount.current = 0;
    questionLimitReached.current = false;
    closingInProgress.current = false;
    preCheckDone.current = false;
    interviewEndedRef.current = false;
    ticks.current = { noface: 0, multi: 0, gaze: 0, eyes: 0 };
    violLockedRef.current = false;
    lastViolAt.current = 0;
    aiIsSpeakingRef.current = false;
    candidateRespondedRef.current = false;
    setQuestionProgress(0);

    const pos =
      interviewInfo?.position || interviewInfo?.jobPosition || "the role";
    const diff = interviewInfo?.difficulty || "Medium";
    const skills = Array.isArray(interviewInfo?.skills)
      ? interviewInfo.skills.join(", ")
      : interviewInfo?.skills || "";
    const numQs = maxQuestions.current;
    const cName =
      interviewInfo?.username || interviewInfo?.candidateName || "Candidate";
    const durationMins =
      parseInt(String(interviewInfo?.duration || "5"), 10) || 5;

    // Natural conversation system prompt — key improvements:
    // 1. Explicitly wait for user to finish (5s pause = done)
    // 2. Natural acknowledgements before next question
    // 3. Don't interrupt mid-sentence pauses
    const NATURAL_CONV = `
NATURAL CONVERSATION RULES (follow these strictly):
1. ALWAYS wait for the candidate to completely finish speaking before responding.
2. If the candidate pauses mid-answer for up to 5 seconds, DO NOT interrupt — they may be thinking.
3. Only respond after a clear, definitive end to their turn.
4. Give brief, natural acknowledgements like "That makes sense", "Good point", "I appreciate that" before moving to the next question — never jump immediately.
5. Speak at a conversational pace — not robotic. Use natural filler phrases like "So...", "Right, so...", "Let me ask you..." when transitioning.
6. Keep your questions concise — one question at a time, never compound questions.
7. If the candidate seems to be mid-thought, stay silent and let them finish.
8. NEVER treat silence alone as a completed answer. Only move on after you hear an actual response.`;

    const PRECHECK = `
PHASE 1 — AUDIO CHECK:
- Warmly greet the candidate by name.
- Ask only: "Can you hear me clearly? Is your audio and video working well?"
- Then STOP completely and wait for their confirmation.
- Once they confirm, say "Perfect! Let's get started then." and begin Phase 2.`;

    const RULES = `
PHASE 2 — INTERVIEW:
- You are a ${diff}-level interviewer. Be professional, warm, and genuinely conversational.
- Start with: "So, could you tell me a little about yourself?" then wait for the full response.
- Ask exactly ${numQs} questions, one at a time.
- After each answer, give a brief natural acknowledgement, then ask the next question.
- After all ${numQs} questions, wrap up warmly and naturally — like a real interviewer.`;

    let sys = "",
      first = "";

    if (isResumeInterview) {
      sys = `You are a senior AI interviewer having a real, natural conversation.
CANDIDATE RESUME:\n${resumeData?.resumeText || "Not provided"}
ROLE: ${pos}
${PRECHECK}
${NATURAL_CONV}
${RULES}`;
      first = `Hello ${cName}! It's great to meet you. I'm your interviewer for the ${pos} position today. Before we get started, I just want to make sure everything is working — can you hear me clearly?`;
    } else {
      let qList: string[] = [];
      try {
        const raw = interviewInfo?.questions ?? interviewInfo?.questionList;
        if (Array.isArray(raw) && raw.length)
          qList = raw
            .map((x: any) => (typeof x === "string" ? x : x?.question))
            .filter(Boolean);
        if (!qList.length && typeof raw === "string")
          qList = (JSON.parse(raw) || [])
            .map((x: any) => (typeof x === "string" ? x : x?.question))
            .filter(Boolean);
      } catch {}
      const filt = qList
        .filter((q) => !q.toLowerCase().includes("tell me about yourself"))
        .slice(0, numQs);
      const qBlock = filt.length
        ? `QUESTIONS (ask one at a time, wait for complete answer before next):\n${filt.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : `Generate exactly ${numQs} natural interview questions for this role.\nROLE: ${pos}\nSKILLS: ${skills}\nDIFFICULTY: ${diff}`;

      sys = `You are a senior AI interviewer having a real, natural conversation.
ROLE: ${pos}
${qBlock}
${PRECHECK}
${NATURAL_CONV}
${RULES}`;
      first = `Hi ${userData?.name || userData?.firstName || userData?.username || cName}! Welcome, it's great to have you here for the ${pos} interview. I'm just going to make sure our connection is working — can you hear me okay?`;
    }

    if (avatarMode === "heygen") initHeyGen();
    if (avatarMode === "ganai") generateGanGreeting(first);

    vapi.start({
      name: "AI Recruiter",
      firstMessage: first,
      transcriber: {
        // Better transcription settings for natural conversation
        provider: "deepgram",
        model: "nova-2",
        language: "en",
        smartFormat: true,
        // Longer endpointing so user pauses don't cut off mid-sentence
        endpointing: 500, // 500ms — longer than default to respect mid-sentence pauses
      },
      // voice: {
      //   provider: "11labs",
      //   voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — natural, warm voice
      //   stability: 0.5,
      //   similarityBoost: 0.75,
      //   style: 0.35,
      //   useSpeakerBoost: true,
      //   speed: 0.95,
      //   fillerInjectionEnabled: false,
      // },
      voice: {
        provider: "vapi",
        voiceId: VOICE_CONFIG[selectedVoice].voiceId,
        // stability: VOICE_CONFIG[selectedVoice].stability,
        // similarityBoost: VOICE_CONFIG[selectedVoice].similarityBoost,
        // style: VOICE_CONFIG[selectedVoice].style,
        // useSpeakerBoost: true,
        speed: VOICE_CONFIG[selectedVoice].speed,
        fillerInjectionEnabled: false,
      },
      model: {
        provider: "openai",
        model: "gpt-4-turbo",
        messages: [{ role: "system", content: sys }],
        temperature: 0.6,
        maxTokens: 250, // Keep responses concise and natural
      },
      // Natural VAD settings — more patient with pauses
      silenceTimeoutSeconds: 35,
      maxDurationSeconds: durationMins * 60,
      endCallMessage:
        "Thank you so much for your time today. It was really great speaking with you — best of luck, and we'll be in touch soon!",
      endCallPhrases: [
        "goodbye",
        "best of luck",
        "we'll be in touch",
        "thank you for your time",
        "great speaking with you",
      ],
      // Background denoising
      backgroundDenoisingEnabled: true,
    });
  }, [
    vapi,
    interviewInfo,
    isResumeInterview,
    resumeData,
    userData,
    avatarMode,
    initHeyGen,
    generateGanGreeting,
  ]);

  // ── Silence monitor ────────────────────────────────────────────────────
  const startSilenceMonitor = useCallback(() => {
    lastSpeechRef.current = Date.now();
    silenceWarnedRef.current = false;
    silenceWarnCount.current = 0;
    if (silenceRef.current) clearInterval(silenceRef.current);
    silenceRef.current = setInterval(() => {
      if (!isCallActiveRef.current) return;
      if (aiIsSpeakingRef.current) return;
      const silent = (Date.now() - lastSpeechRef.current) / 1000;
      if (silent >= SILENCE_THRESHOLD_SEC && !silenceWarnedRef.current) {
        silenceWarnedRef.current = true;
        lastSpeechRef.current = Date.now();
        silenceWarnCount.current++;
        const n = silenceWarnCount.current;
        if (n >= MAX_SILENCE_WARNINGS) {
          try {
            vapiRef.current?.send({
              type: "add-message",
              message: {
                role: "system",
                content:
                  "[SYSTEM]: Candidate is unresponsive for too long. Thank them warmly and conclude the interview naturally.",
              },
            });
          } catch {}
        } else {
         const prompts = [
  "The candidate hasn't responded yet. Gently check in — say something like 'Just checking — can you still hear me okay? No rush, take your time.' Then wait for their answer before moving on.",
  "Still quiet. Ask warmly 'Are you still there? Feel free to take a moment to think.' Do NOT move to the next question yet.",
  "Ask if they are having technical issues. Say something like 'I want to make sure we're connected — are you experiencing any audio issues?' Wait for their reply.",
  "Check in one more time. Ask 'Would you like me to repeat the question?' and then repeat it clearly. Wait.",
  "Final check — say 'I just want to give you one more moment in case you're having trouble. We can move on whenever you're ready.' Then wait.",
];
          try {
            vapiRef.current?.send({
              type: "add-message",
              message: {
                role: "system",
                content: `[CHECK-IN #${n}]: ${prompts[n - 1]}`,
              },
            });
          } catch {}
        }
        silenceWarnedRef.current = false;
      }
    }, 5000);
  }, []);

  // ── Feedback ───────────────────────────────────────────────────────────
  const generateFeedback = useCallback(async () => {
    setIsGenFeedback(true);
    try {
      const conv = conversationRef.current;
      if (!conv.length) {
        navigate(userPath("complete", interview_id));
        return;
      }
      const transcript = conv
        .filter(
          (m) =>
            m?.type === "transcript" &&
            (m.role === "assistant" || m.role === "user"),
        )
        .map((m) => ({
          role: m.role === "assistant" ? "Interviewer" : "Candidate",
          text: m.transcript || m.text || "",
        }))
        .filter((m) => m.text.trim());

      const pos =
        interviewInfo?.position || interviewInfo?.jobPosition || "the role";
      const cName =
        interviewInfo?.username ||
        interviewInfo?.candidateName ||
        userData?.name ||
        "Candidate";

      const violationSummary =
        alertCountRef.current > 0
          ? `\n\nPROCTORING NOTES: ${alertCountRef.current} violation warning(s) were issued during this interview.`
          : "";

      const prompt = `You are a senior recruitment analyst with 15+ years of hiring experience. Produce a rigorous, accurate, evidence-based assessment of the following interview. This assessment will directly determine whether the candidate is hired — be thorough and honest.\n\nCANDIDATE: ${cName}\nROLE: ${pos}${violationSummary}\n\nINTERVIEW TRANSCRIPT:\n${transcript.map((m) => `${m.role === "Interviewer" ? "Interviewer" : "Candidate"}: ${m.text}`).join("\n")}\n\nReturn a JSON object ONLY — no markdown, no extra text, no code fences:\n{\n  \"candidateName\": \"${cName}\",\n  \"role\": \"${pos}\",\n  \"confidenceScore\": <integer 0-100>,\n  \"confidenceLabel\": <\"High Confidence\" | \"Moderate Confidence\" | \"Low Confidence\">,\n  \"behavioralInsights\": [\n    { \"title\": \"Communication Style\",       \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> },\n    { \"title\": \"Problem-Solving Approach\",  \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> },\n    { \"title\": \"Professionalism & Poise\",   \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> }\n  ],\n  \"technicalCompetency\": [\n    { \"title\": \"Core Knowledge\",       \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> },\n    { \"title\": \"Practical Experience\", \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> },\n    { \"title\": \"Advanced Topics\",      \"description\": \"<precise one-sentence observation>\", \"status\": <\"good\"|\"warning\"|\"bad\"> }\n  ],\n  \"speechPatterns\": {\n    \"clarityScore\": <integer 0-100>,\n    \"avgResponseTime\": \"<estimate e.g. '1.4s' or '5.2s'>\",\n    \"confidenceLevel\": <integer 0-100>,\n    \"complexityScore\": <float 1.0-5.0>\n  },\n  \"proctoringFlags\": ${alertCountRef.current},\n  \"recommendations\": [\n    \"<specific, actionable recommendation 1>\",\n    \"<specific, actionable recommendation 2>\"\n  ],\n  \"overallVerdict\": <\"hire\" | \"consider\" | \"reject\">,\n  \"verdictReason\": \"<one evidence-based sentence with specific transcript references>\"\n}`;

      const r = await fetch(`${Base_Url}/ai-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: conv, transcript, prompt }),
      });
      const data = await r.json();
      const raw = (data?.content || data?.feedback || "")
        .replace(/```json|```/g, "")
        .trim();
      if (raw) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {}
        await userService.generateFeedback({
          interview_id,
          candidateId: cand_id.candidateId._id,
          userName: userData?.name,
          userEmail: userData?.email,
          feedback: parsed,
          transcript,
          behaviorReport: behaviorTracker.current.getReport(),
          violationCount: alertCountRef.current,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Feedback:", e);
    } finally {
      setIsGenFeedback(false);
      navigate(userPath("complete", interview_id));
    }
  }, [interview_id, navigate, userData, interviewInfo]);

  useEffect(() => {
    if (!vapi) return;
    const h = () => {
      const has =
        conversationRef.current.filter(
          (m) =>
            m?.type === "transcript" &&
            (m.role === "assistant" || m.role === "user"),
        ).length >= 2;
      setIsCallActive(false);
      isCallActiveRef.current = false;
      setIsSpeaking(false);
      setAvatarState("idle");
      setTurnState("idle");
      clearPauseTimers();
      if (!has) {
        setScreen("lobby");
        setVapiReady(false);
        setHeygenStreamLive(false);
        setHeygenReady(false);
        setElapsed(0);
        return;
      }
      generateFeedback();
    };
    vapi.on("call-end", h);
    return () => vapi.off("call-end", h);
  }, [vapi, generateFeedback, clearPauseTimers]);

  // ── Controls ────────────────────────────────────────────────────────────
  const handleJoin = () => {
    tryEnterFS();
    startCall();
    startSilenceMonitor();
    setScreen("spotlight");
  };

  // Manual end — still submits (user chose to end)
  const handleEnd = () => {
    setIsCallActive(false);
    if (silenceRef.current) clearInterval(silenceRef.current);
    clearPauseTimers();
    try {
      vapi?.stop();
    } catch {}
    tryExitFS();
    setScreen("lobby");
    setElapsed(0);
    setVapiReady(false);
    setHeygenStreamLive(false);
    setHeygenReady(false);
  };

  const toggleMic = () => {
    const n = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = n;
    });
    micOnRef.current = n;
    setMicOn(n);
    if (!n) userTranscriptBuf.current = "";
  };
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !camOn;
    });
    setCamOn((v) => !v);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtL = (s: number) =>
    isNaN(s) || s < 0
      ? "00:00"
      : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtC = (d: Date) => {
    let h = d.getHours(),
      m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  };
  const fmtD = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const username = userData?.name || "You";
  const avatarProps: AvatarTileProps = {
    mode: avatarMode,
    state: avatarState,
    heygenVideoRef,
    ganAiVideoUrl,
    ganAiLoading,
    heygenReady,
  };

  if (loading || !interviewInfo)
    return (
      <div className="h-screen bg-[#050A24] flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#2D55FB]" />
        <span className="ml-3 text-white text-lg">Preparing Interview...</span>
      </div>
    );
  if (isGenFeedback)
    return (
      <div className="h-screen bg-[#050A24] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin h-12 w-12 text-[#2D55FB]" />
        <h2 className="text-white text-xl font-bold">
          Generating Your Feedback...
        </h2>
        <p className="text-white/40 text-sm">Analyzing your performance</p>
      </div>
    );

  // ── Bottom bar ──────────────────────────────────────────────────────────
  const bottomBar = (
    <div className="shrink-0 bg-[#070e2b] border-t border-white/5 px-5 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <span className="text-white/40 text-sm font-medium whitespace-nowrap">
          {interviewInfo?.position || interviewInfo?.jobPosition || "Interview"}
        </span>
        <div className="w-px h-5 bg-white/15" />
        <span
          className={`font-bold text-sm whitespace-nowrap ${timeLeft < 60 ? "text-red-400 animate-pulse" : "text-[#2D55FB]"}`}
        >
          ⏱ {fmtL(timeLeft)}
        </span>
        {isCallActive && preCheckDone.current && (
          <>
            <div className="w-px h-5 bg-white/15" />
            <span className="text-white/50 text-xs font-medium whitespace-nowrap">
              Q {Math.min(questionProgress, maxQuestions.current)}/
              {maxQuestions.current}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <CtrlBtn onClick={toggleMic} active={micOn}>
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </CtrlBtn>
        <CtrlBtn onClick={toggleCam} active={camOn}>
          {camOn ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </CtrlBtn>
        <CtrlBtn>
          <MonitorUp className="h-4 w-4 text-gray-800" />
        </CtrlBtn>
        <CtrlBtn onClick={handleEnd} danger>
          <PhoneOff className="h-4 w-4" />
        </CtrlBtn>
      </div>
      <div className="min-w-[80px] sm:min-w-[110px] flex flex-col items-end gap-1">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${isFullscreen ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/15 border-red-500/30 text-red-400 animate-pulse"}`}
        >
          <Maximize className="w-2.5 h-2.5" />
          {isFullscreen ? "Fullscreen" : "Not FS!"}
        </div>
        {noFaceVisible && (
          <span className="text-red-400 text-[10px] font-bold animate-pulse">
            ⚠ No face
          </span>
        )}
        {!noFaceVisible && alertCountRef.current > 0 && (
          <span className="text-orange-400 text-[10px] font-bold">
            {alertCountRef.current}/{MAX_VIOLATIONS} warns
          </span>
        )}
        <div className="flex items-center gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${faceStatus === "ok" ? "bg-green-400" : faceStatus === "warn" ? "bg-red-400 animate-pulse" : "bg-gray-500"}`}
          />
          <span className="text-white/30 text-[9px]">
            {faceStatus === "ok"
              ? "Face OK"
              : faceStatus === "warn"
                ? "Alert"
                : "Scanning"}
          </span>
        </div>
      </div>
    </div>
  );

  // ── Overlays ────────────────────────────────────────────────────────────
  const overlays = (
    <>
      {activeAlert && (
        <ViolationModal
          key={`${activeAlert.type}__${activeAlert.count}`}
          alert={activeAlert}
          onClose={handleAlertClose}
        />
      )}
      <AnimatePresence>
        {noiseWarning && screen !== "lobby" && !activeAlert && (
          <motion.div
            key="noise"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-amber-500/90 backdrop-blur-sm border border-amber-400/50 rounded-xl px-4 py-2.5 shadow-lg max-w-sm w-full"
          >
            <Volume2 className="h-4 w-4 text-amber-900 shrink-0" />
            <span className="text-amber-950 text-xs font-semibold flex-1">
              Background noise detected — please reduce noise.
            </span>
            <button
              onClick={() => setNoiseWarning(false)}
              className="text-amber-900/60 hover:text-amber-900"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFSBanner && screen !== "lobby" && !activeAlert && (
          <motion.div
            key="fs"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-red-500/90 backdrop-blur-sm border border-red-400/50 rounded-xl px-4 py-2.5 shadow-lg max-w-sm w-full"
          >
            <Maximize className="h-4 w-4 text-white shrink-0" />
            <span className="text-white text-xs font-semibold flex-1">
              Fullscreen exited — re-entering.
            </span>
            <button
              onClick={() => {
                tryEnterFS();
                setShowFSBanner(false);
              }}
              className="text-white/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {isCallActive && alertCountRef.current > 0 && !activeAlert && (
        <div className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/40 rounded-full">
          <ShieldAlert className="w-3 h-3 text-red-400" />
          <span className="text-red-400 text-xs font-semibold">
            {alertCountRef.current}/{MAX_VIOLATIONS} warns
          </span>
        </div>
      )}
      {isCallActive && (
        <div className="fixed bottom-24 left-4 z-40 flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-white/10 rounded-full backdrop-blur-sm">
          <Eye className="w-3 h-3 text-white/40" />
          <div
            className={`w-1.5 h-1.5 rounded-full ${faceStatus === "ok" ? "bg-green-400" : faceStatus === "warn" ? "bg-red-400 animate-pulse" : "bg-gray-500"}`}
          />
          <span className="text-white/40 text-[9px]">
            {faceStatus === "ok" ? "OK" : faceStatus === "warn" ? "⚠" : "…"}
          </span>
        </div>
      )}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="contents">
      {/* Always-mounted behavior video for face detection proctoring */}
      <video
        ref={behaviorVidRef}
        muted
        playsInline
        style={{
          position: "fixed",
          top: "-2px",
          left: "-2px",
          width: "2px",
          height: "2px",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* ═══════════════════ LOBBY ════════════════════════════════════ */}
      {screen === "lobby" && (
        <div className="h-screen bg-[#050A24] bg-[radial-gradient(ellipse_at_65%_0%,rgba(45,85,251,0.4),transparent_60%),radial-gradient(ellipse_at_0%_100%,rgba(20,40,120,0.4),transparent_60%)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 sm:px-10 py-5 shrink-0">
            <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">
              Vitric IQ
            </h1>
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
              <span>{fmtC(now)}</span>
              <span className="text-white/20 mx-1">|</span>
              <span>{fmtD(now)}</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 pb-10">
            <motion.div
              className="relative w-full max-w-sm sm:max-w-md lg:max-w-xl xl:max-w-2xl bg-[#0a1035] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
              style={{ aspectRatio: "16/9" }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55 }}
            >
              <video
                ref={lobbyVidRef}
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn && streamReady ? "opacity-100" : "opacity-0"}`}
                style={{ transform: "scaleX(-1)" }}
              />
              {(!camOn || !streamReady) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e] to-[#050A24] gap-3">
                  <div className="w-20 h-20 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center">
                    {streamReady ? (
                      <VideoOff className="h-10 w-10 text-[#2D55FB]/60" />
                    ) : (
                      <User className="h-10 w-10 text-[#2D55FB]/50" />
                    )}
                  </div>
                  <span className="text-white/30 text-sm">
                    {streamReady ? "Camera off" : "Waiting for camera…"}
                  </span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 flex items-center gap-3">
                <motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.9 }}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur transition-all ${micOn ? "bg-white/15 border-white/25 text-white hover:bg-white/25" : "bg-red-500 border-red-400 text-white"}`}
                >
                  {micOn ? (
                    <Mic className="h-4 w-4" />
                  ) : (
                    <MicOff className="h-4 w-4" />
                  )}
                </motion.button>
                <motion.button
                  onClick={toggleCam}
                  whileTap={{ scale: 0.9 }}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur transition-all ${camOn ? "bg-white/15 border-white/25 text-white hover:bg-white/25" : "bg-red-500 border-red-400 text-white"}`}
                >
                  {camOn ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <VideoOff className="h-4 w-4" />
                  )}
                </motion.button>
              </div>
            </motion.div>
            <motion.div
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
            >
              <h2 className="text-white text-2xl sm:text-3xl font-semibold">
                Ready to Join?
              </h2>
              <p className="text-white/40 text-sm text-center max-w-xs">
                {interviewInfo?.position ||
                  interviewInfo?.jobPosition ||
                  "Interview"}{" "}
                • {interviewInfo?.duration || "N/A"}
              </p>
              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl max-w-xs border ${USE_HEYGEN ? "bg-green-500/10 border-green-500/25" : USE_GANAI ? "bg-purple-500/10 border-purple-500/25" : "bg-[#2D55FB]/10 border-[#2D55FB]/25"}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${USE_HEYGEN ? "bg-green-400" : USE_GANAI ? "bg-purple-400" : "bg-[#2D55FB]/60"}`}
                />
                <span className="text-white/50 text-xs">
                  {USE_HEYGEN
                    ? "Photorealistic via HeyGen"
                    : USE_GANAI
                      ? "Via Gan.AI"
                      : "Animated AI avatar"}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 bg-[#2D55FB]/10 border border-[#2D55FB]/25 rounded-xl max-w-xs">
                <Maximize className="h-3.5 w-3.5 text-[#2D55FB]/70 shrink-0" />
                <span className="text-white/50 text-xs">
                  Fullscreen + proctored interview
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 border-2 border-[#2D55FB] flex items-center justify-center shadow-lg">
                  <User className="h-6 w-6 text-white/80" />
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-orange-400 flex items-center justify-center -ml-3 shadow-lg">
                  <User className="h-6 w-6 text-white/80" />
                </div>
              </div>
              <p className="text-white/50 text-sm -mt-2">
                {username} and AI Recruiter
              </p>
              <motion.button
                onClick={handleJoin}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-3 bg-[#2D55FB] hover:bg-[#1e3fd4] text-white font-semibold rounded-xl transition-colors shadow-lg shadow-[#2D55FB]/30"
              >
                Join Interview
              </motion.button>
            </motion.div>
          </div>
        </div>
      )}

      {/* ═══════════════════ SPOTLIGHT ═══════════════════════════════ */}
      {screen === "spotlight" && (
        <div className="h-screen bg-[#070e2b] flex flex-col overflow-hidden relative">
          {overlays}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#070e2b] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">Time :</span>
              <span className="text-[#2D55FB] font-mono font-bold text-sm tracking-widest">
                {fmt(elapsed)}
              </span>
              {isCallActive && (
                <div className="flex items-center gap-1.5 ml-3 text-green-400 text-xs font-bold">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
            </div>
            <motion.button
              onClick={() => setScreen("grid")}
              whileTap={{ scale: 0.94 }}
              className="flex items-center gap-2 text-white/60 hover:text-white text-xs font-medium transition-colors"
            >
              Grid View
              <div className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <LayoutGrid className="h-4 w-4 text-white" />
              </div>
            </motion.button>
          </div>
          <div className="flex flex-1 min-h-0 gap-2.5 px-2.5 pb-2 pt-1">
            <div className="w-44 sm:w-52 shrink-0 flex flex-col gap-2">
              <div
                className="relative rounded-xl overflow-hidden bg-[#0d1535] border border-white/5 shrink-0"
                style={{ aspectRatio: "4/3" }}
              >
                <UserVideo
                  camOn={camOn}
                  streamReady={streamReady}
                  username={username}
                  onVideoMount={onSpotlightMount}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2.5 z-10">
                  <span className="text-white text-xs font-semibold drop-shadow">
                    {username}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2.5 z-10">
                  <MicCircle muted={!micOn} />
                </div>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
                <div className="bg-[#0e1640]/90 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#7a9cff] text-[11px] font-semibold">
                      AI Recruiter:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSpeaking && (
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      )}
                      {isSpeaking && (
                        <span className="text-green-400 text-[9px] font-bold">
                          Speaking
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {avatarSub}
                  </p>
                </div>
                <div className="bg-[#0e1640]/90 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#7a9cff] text-[11px] font-semibold">
                      You:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isListening && micOn && (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      )}
                      {isListening && micOn && (
                        <span className="text-blue-400 text-[9px] font-bold">
                          Listening
                        </span>
                      )}
                      {!micOn && (
                        <span className="text-red-400/70 text-[9px] font-bold">
                          MIC OFF
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {micOn ? userSub : "Microphone is muted."}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0d1535] to-[#060c25]">
                <motion.div 
                  className="w-20 h-20 rounded-full bg-[#2D55FB]/30 border-2 border-[#2D55FB]/50 flex items-center justify-center"
                  animate={isSpeaking ? { boxShadow: ["0 0 0 0 rgba(45,85,251,0.4)", "0 0 0 15px rgba(45,85,251,0)"] } : {}}
                  transition={isSpeaking ? { duration: 1.5, repeat: Infinity } : {}}
                >
                  <div className="flex items-center justify-center gap-2">
                    <motion.div 
                      className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                      animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                      transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0 } : { duration: 0.3 }}
                    />
                    <motion.div 
                      className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                      animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                      transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0.15 } : { duration: 0.3 }}
                    />
                    <motion.div 
                      className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                      animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                      transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0.3 } : { duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
                <AudioWave active={isSpeaking} />
              </div>
              <div className="absolute bottom-4 left-5 z-10">
                <span className="text-white font-medium text-sm">
                  AI Recruiter
                </span>
              </div>
              {isCallActive && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-bold z-10">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  REC
                </div>
              )}
              {/* Turn indicator — replaces the old "AI Speaking / Your Turn" logic */}
              {isCallActive && (
                <div className="absolute top-4 left-4 z-10">
                  <TurnIndicator
                    turnState={turnState}
                    pauseCountdown={pauseCountdown}
                  />
                </div>
              )}
            </div>
          </div>
          {bottomBar}
        </div>
      )}

      {/* ═══════════════════ GRID ════════════════════════════════════ */}
      {screen === "grid" && (
        <div className="h-screen bg-[#070e2b] flex flex-col overflow-hidden relative">
          {overlays}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#070e2b] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">Time :</span>
              <span className="text-[#2D55FB] font-mono font-bold text-sm tracking-widest">
                {fmt(elapsed)}
              </span>
              {isCallActive && (
                <div className="flex items-center gap-1.5 ml-3 text-green-400 text-xs font-bold">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
            </div>
            <motion.button
              onClick={() => setScreen("spotlight")}
              whileTap={{ scale: 0.94 }}
              className="flex items-center gap-2 text-white/80 hover:text-white text-xs font-medium transition-colors"
            >
              Spotlight
              <div className="w-7 h-7 rounded-lg bg-[#2D55FB] flex items-center justify-center shadow-md shadow-[#2D55FB]/30">
                <LayoutGrid className="h-4 w-4 text-white" />
              </div>
            </motion.button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-2 pb-1 gap-0">
            <div
              className="flex gap-4 sm:gap-5"
              style={{ flex: "0 0 auto", height: "clamp(200px,58vh,420px)" }}
            >
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
                <video
                  ref={onGridUserMount}
                  muted
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn && streamReady ? "opacity-100" : "opacity-0"}`}
                  style={{ transform: "scaleX(-1)" }}
                />
                {(!camOn || !streamReady) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e]/80 to-[#060c25]/80">
                    <div className="w-14 h-14 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center">
                      {streamReady ? (
                        <VideoOff className="h-7 w-7 text-[#2D55FB]/60" />
                      ) : (
                        <User className="h-7 w-7 text-[#2D55FB]/50" />
                      )}
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-12 right-3 z-10">
                  <MicCircle muted={!micOn} />
                </div>
                <div className="absolute bottom-4 left-4 z-10">
                  <span className="text-white font-semibold text-base drop-shadow">
                    {username}
                  </span>
                </div>
                {turnState === "user-speaking" && micOn && (
                  <div className="absolute top-4 left-4 z-10">
                    <TurnIndicator
                      turnState={turnState}
                      pauseCountdown={pauseCountdown}
                    />
                  </div>
                )}
                {turnState === "user-turn" && micOn && (
                  <div className="absolute top-4 left-4 z-10">
                    <TurnIndicator
                      turnState={turnState}
                      pauseCountdown={pauseCountdown}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0d1535] to-[#060c25]">
                  <motion.div 
                    className="w-20 h-20 rounded-full bg-[#2D55FB]/30 border-2 border-[#2D55FB]/50 flex items-center justify-center"
                    animate={isSpeaking ? { boxShadow: ["0 0 0 0 rgba(45,85,251,0.4)", "0 0 0 15px rgba(45,85,251,0)"] } : {}}
                    transition={isSpeaking ? { duration: 1.5, repeat: Infinity } : {}}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <motion.div 
                        className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                        animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                        transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0 } : { duration: 0.3 }}
                      />
                      <motion.div 
                        className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                        animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                        transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0.15 } : { duration: 0.3 }}
                      />
                      <motion.div 
                        className="w-3 h-3 bg-[#2D55FB] rounded-full" 
                        animate={isSpeaking ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: 0.8, opacity: 0.5 }}
                        transition={isSpeaking ? { duration: 0.7, repeat: Infinity, delay: 0.3 } : { duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-12 right-3 z-10">
                  <AudioWave active={isSpeaking} />
                </div>
                <div className="absolute bottom-4 left-4 z-10">
                  <span className="text-white font-semibold text-base drop-shadow">
                    AI Recruiter
                  </span>
                </div>
                {(turnState === "ai-speaking" ||
                  turnState === "processing") && (
                  <div className="absolute top-4 left-4 z-10">
                    <TurnIndicator turnState={turnState} pauseCountdown={0} />
                  </div>
                )}
              </div>
            </div>
            <div
              className="flex gap-4 sm:gap-5 mt-3"
              style={{ flex: "0 0 auto" }}
            >
              <div className="flex-1 flex items-start justify-center">
                <p className="text-white/65 text-sm text-center leading-snug max-w-xs">
                  {micOn ? userSub : "🎤 Mic is muted"}
                </p>
              </div>
              <div className="flex-1 flex items-start justify-center">
                <p className="text-white/65 text-sm text-center leading-snug max-w-xs">
                  {avatarSub}
                </p>
              </div>
            </div>
            <div className="flex-1" />
          </div>
          {bottomBar}
        </div>
      )}
    </div>
  );
};

export default VideoInterview;
