import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Flag, Clock, X, CheckCircle,
  BarChart2, Loader2, VideoOff, AlertTriangle, ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { userService } from "../../services/service/userService";
import * as faceapi from "@vladmandic/face-api";
import { userPath } from "../../routes/EncryptRoute";

// ─── face-api model source ────────────────────────────────────────────────────
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
let faceModelsLoaded = false;
const loadFaceModels = async () => {
  if (faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  faceModelsLoaded = true;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  _id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
}

interface AnswerState {
  questionId: string;
  selectedOption: string;
  submitted: boolean;
}

type ViolationType =
  | "tab-switch"
  | "no-face"
  | "multiple-faces"
  | "looking-away"
  | "copy-attempt";

interface ViolationAlert {
  type: ViolationType;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Violations are warnings ONLY — the test NEVER auto-submits due to violations.
// Only timer expiry or the candidate's own Submit button ends the test.

const VIOLATION_MESSAGES: Record<ViolationType, { title: string; body: string }> = {
  "tab-switch": {
    title: "Tab Switch Detected",
    body: "You navigated away from the assessment window. Please stay on this page at all times.",
  },
  "no-face": {
    title: "Face Not Detected",
    body: "Your face has not been visible for several seconds. Please ensure you are seated in front of the camera.",
  },
  "multiple-faces": {
    title: "Multiple People Detected",
    body: "More than one person is visible. Only the candidate is allowed in the frame.",
  },
  "looking-away": {
    title: "Looking Away Detected",
    body: "You appeared to be looking away from the screen for an extended period. Please keep your eyes on the assessment.",
  },
  "copy-attempt": {
    title: "Copy Attempt Detected",
    body: "You attempted to copy assessment content. Sharing or reproducing questions is strictly prohibited.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const parseDuration = (t: string) => {
  const match = t?.match(/(\d+)/);
  return match ? parseInt(match[1]) * 60 : 15 * 60;
};

// ─── Component ────────────────────────────────────────────────────────────────
const MCQAssessment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { title, time } = (location.state as { title: string; time: string }) ?? {};

  // ── Quiz state ──
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(() => parseDuration(time));
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [phase, setPhase] = useState<"quiz" | "result">("quiz");
  const [_, setTotalScore] = useState(0);

  // ── Proctoring state ──
  const [violationCount, setViolationCount] = useState(0);
  const [activeAlert, setActiveAlert] = useState<ViolationAlert | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"ok" | "warning" | "unknown">("unknown");
  const [noiseWarning, setNoiseWarning] = useState(false);

  // ── Refs ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const procVideoRef = useRef<HTMLVideoElement>(null);
  const procStreamRef = useRef<MediaStream | null>(null);
  const faceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const violationCountRef = useRef(0);
  const phaseRef = useRef<"quiz" | "result">("quiz");
  const noiseEpisodeRef = useRef(false);
  const noiseSilentCountRef = useRef(0);
  const copyProtectedRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  useEffect(() => { violationCountRef.current = violationCount; }, [violationCount]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Violation handler — logs warning only, NEVER ends the test ───────────
  const triggerViolation = useCallback((type: ViolationType) => {
    if (phaseRef.current === "result") return;
    setViolationCount((prev) => {
      const next = prev + 1;
      violationCountRef.current = next;
      setActiveAlert({ type, count: next });
      return next;
    });
  }, []);

  // Dismissing the alert just closes it — test continues uninterrupted
  const handleAlertClose = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // ── Fetch questions ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await userService.getMCQAssessment(id!);
        const qs: Question[] = res?.questions ?? res?.data ?? [];
        setQuestions(qs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [id]);

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleFinalSubmit = useCallback(async () => {
    if (finalSubmitting || phase === "result") return;
    setFinalSubmitting(true);
    setShowSubmitModal(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    if (audioCheckIntervalRef.current) clearInterval(audioCheckIntervalRef.current);
    if (procStreamRef.current) procStreamRef.current.getTracks().forEach((t) => t.stop());

    try {
      const answersArray = Object.values(answers).map((a) => ({
        questionId: a.questionId,
        answerText: a.selectedOption,
      }));
      const res = await userService.finalSubmitMCQAssessment(id!, { answers: answersArray });
      if (res) {
        navigate(userPath("complete", id));
        setTotalScore(res?.totalScore ?? 0);
      }
    } catch (e) {
      console.error(e);
      setTotalScore(0);
    } finally {
      setFinalSubmitting(false);
      setPhase("result");
    }
  }, [answers, finalSubmitting, id, phase]);

  // ── Timer — ONLY trigger for auto-submit on expiry ────────────────────────
  useEffect(() => {
    if (loading || phase === "result") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleFinalSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [loading, phase, handleFinalSubmit]);

  // ── Tab switch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || phase === "result") return;
    const handle = () => { if (document.hidden) triggerViolation("tab-switch"); };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [loading, phase, triggerViolation]);

  // ── Prevent back navigation ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || phase === "result") return;
    window.history.pushState(null, "", window.location.href);
    const handle = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, [loading, phase]);

  // ── Copy / prompt detection ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || phase === "result") return;
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection()?.toString() ?? "";
      if (sel.trim().length > 15) { e.preventDefault(); triggerViolation("copy-attempt"); }
    };
    const onKey = (e: KeyboardEvent) => {
      const bad = (e.ctrlKey || e.metaKey) && ["c","x","u","s","p","a"].includes(e.key.toLowerCase());
      const ps  = e.key === "PrintScreen" || e.key === "F12";
      if (bad || ps) {
        e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          const sel = window.getSelection()?.toString() ?? "";
          if (sel.trim().length > 15) triggerViolation("copy-attempt");
        }
      }
    };
    document.addEventListener("contextmenu", blockCtx);
    document.addEventListener("copy", onCopy);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", blockCtx);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("keydown", onKey);
    };
  }, [loading, phase, triggerViolation]);

  // ── Proctoring: camera + face detection + audio ───────────────────────────
  useEffect(() => {
    if (loading || phase === "result") return;
    let mounted = true;

    const startProctoring = async () => {
      try {
        await loadFaceModels();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: true,
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        procStreamRef.current = stream;
        if (procVideoRef.current) {
          procVideoRef.current.srcObject = stream;
          await procVideoRef.current.play();
        }
        setCameraReady(true);

        // ── Audio monitoring ──────────────────────────────────────────────
        try {
          const audioCtx = new AudioContext();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioCtx.createMediaStreamSource(stream).connect(analyser);
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;

          const NOISE_THRESHOLD = 40;
          const SILENCE_RESET   = 3;

          audioCheckIntervalRef.current = setInterval(() => {
            if (phaseRef.current === "result" || !analyserRef.current) return;
            const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(arr);
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            if (avg > NOISE_THRESHOLD) {
              noiseSilentCountRef.current = 0;
              if (!noiseEpisodeRef.current) { noiseEpisodeRef.current = true; setNoiseWarning(true); }
            } else {
              noiseSilentCountRef.current += 1;
              if (noiseSilentCountRef.current >= SILENCE_RESET) {
                noiseEpisodeRef.current     = false;
                noiseSilentCountRef.current = 0;
              }
            }
          }, 2000);
        } catch (e) { console.warn("Audio monitoring failed:", e); }

        // ── Face detection — TWO-PASS approach ────────────────────────────
        //
        // ROOT CAUSE of old "multiple faces never detected" bug:
        //   .detectAllFaces().withFaceLandmarks() silently DROPS any face
        //   whose landmark detection fails (common for partial/side-on faces).
        //   So even with 2 people visible, detections.length collapsed to 1.
        //
        // FIX — two separate passes:
        //
        //   PASS 1 — Count only (NO landmarks):
        //     detectAllFaces with scoreThreshold: 0.25
        //     Low threshold catches partial secondary faces at edges/angles.
        //     This is the authoritative face count.
        //
        //   PASS 2 — Gaze check (landmarks on primary face only):
        //     detectSingleFace with scoreThreshold: 0.5
        //     Only runs when pass 1 confirmed exactly 1 face.
        //     Higher threshold ensures landmarks are reliable for geometry.
        //
        const NEED_BAD = 4; // 4 × 2 s = ~8 s sustained before violation fires

        const badCount: Record<string, number> = {
          "no-face": 0, "multiple-faces": 0, "looking-away": 0,
        };

        const resetAll = () => {
          badCount["no-face"] = badCount["multiple-faces"] = badCount["looking-away"] = 0;
        };

        // Bumps only the given type; zeroes all others so mixed transients
        // don't accumulate across types.
        const bump = (type: "no-face" | "multiple-faces" | "looking-away") => {
          Object.keys(badCount).forEach((k) => { if (k !== type) badCount[k] = 0; });
          return ++badCount[type];
        };

        faceCheckIntervalRef.current = setInterval(async () => {
          if (phaseRef.current === "result" || !procVideoRef.current) return;
          if (!procVideoRef.current.readyState || procVideoRef.current.readyState < 2) return;

          try {
            const video = procVideoRef.current;

            // ── PASS 1: Count faces WITHOUT landmarks ───────────────────
            // scoreThreshold 0.25 catches partial / angled secondary faces
            const allFaces = await faceapi.detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.25, inputSize: 224 })
            );

            if (allFaces.length === 0) {
              setFaceStatus("warning");
              if (bump("no-face") >= NEED_BAD) { resetAll(); triggerViolation("no-face"); }
              return;
            }

            if (allFaces.length > 1) {
              setFaceStatus("warning");
              if (bump("multiple-faces") >= NEED_BAD) { resetAll(); triggerViolation("multiple-faces"); }
              return;
            }

            // ── PASS 2: Single face — landmarks for gaze check only ─────
            // scoreThreshold 0.5 ensures landmark geometry is reliable
            const withLandmarks = await faceapi
              .detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 224 })
              )
              .withFaceLandmarks(true);

            // Landmark pass failed this frame — skip (neither good nor bad)
            if (!withLandmarks) return;

            const { detection, landmarks } = withLandmarks;

            // Low-confidence primary face → skip frame
            if (detection.score < 0.60) return;

            // ── Head-pose / gaze check via nose + jaw geometry ──────────
            const nose = landmarks.getNose();
            const jaw  = landmarks.getJawOutline();
            let lookingAway = false;

            if (nose?.length && jaw?.length) {
              const jawLeft  = jaw[0].x;
              const jawRight = jaw[jaw.length - 1].x;
              const jawWidth = jawRight - jawLeft;

              if (jawWidth > 0) {
                const noseTip    = nose[nose.length - 1];
                const noseBridge = nose[0];

                // Horizontal: clearly turned left/right (normal reading stays under 0.38)
                const hOffset = Math.abs(noseTip.x - (jawLeft + jawRight) / 2) / jawWidth;

                // Vertical: chin nearly at chest (normal reading bow stays above 0.10)
                const vRatio = Math.abs(noseTip.y - noseBridge.y) / jawWidth;

                lookingAway = hOffset > 0.38 || vRatio < 0.10;
              }
            }

            if (lookingAway) {
              setFaceStatus("warning");
              if (bump("looking-away") >= NEED_BAD) { resetAll(); triggerViolation("looking-away"); }
              return;
            }

            // ── All good ──
            resetAll();
            setFaceStatus("ok");

          } catch {
            // Silently ignore model / canvas errors (race on load, GPU hiccup, etc.)
          }
        }, 2000);

      } catch (err) {
        console.warn("Proctoring camera error:", err);
        setCameraError(true);
      }
    };

    startProctoring();

    return () => {
      mounted = false;
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
      if (audioCheckIntervalRef.current) clearInterval(audioCheckIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (procStreamRef.current) procStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [loading, phase, triggerViolation]);

  // ── Select / change answer ────────────────────────────────────────────────
  const handleSelectOption = async (opt: string) => {
    const question = questions[currentQ];
    if (!question || finalSubmitting || savingRef.current) return;

    setAnswers((prev) => ({
      ...prev,
      [question._id]: { questionId: question._id, selectedOption: opt, submitted: true },
    }));

    savingRef.current = true;
    setSavingAnswer(true);
    try {
      await userService.submitMCQAssessment(id!, {
        questionId: question._id,
        answerText: opt,
      });
    } catch (e) {
      console.error("Save answer error:", e);
    } finally {
      savingRef.current = false;
      setSavingAnswer(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentQuestion = questions[currentQ];
  const currentAnswer   = currentQuestion ? answers[currentQuestion._id] : undefined;
  const isWarning       = timeLeft < 5 * 60;
  const progress        = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;
  const answeredCount   = Object.values(answers).filter((a) => a.submitted).length;
  const flaggedCount    = flagged.size;

  type QuestionStatus = "not-answered" | "answered" | "flagged" | "current";
  const getStatus = (idx: number): QuestionStatus => {
    if (idx === currentQ) return "current";
    const q = questions[idx];
    if (flagged.has(idx)) return "flagged";
    if (q && answers[q._id]?.submitted) return "answered";
    return "not-answered";
  };

  const statusStyle: Record<QuestionStatus, string> = {
    current:        "bg-[#2D55FB] text-white border-[#2D55FB]",
    answered:       "bg-green-600/80 text-white border-green-600",
    flagged:        "bg-amber-600/70 text-white border-amber-600",
    "not-answered": "bg-[#1a2850] text-gray-400 border-gray-600",
  };

  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(currentQ) ? next.delete(currentQ) : next.add(currentQ);
      return next;
    });
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d24] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#2D55FB] animate-spin" />
          <p className="text-gray-400 text-sm">Loading assessment…</p>
        </div>
      </div>
    );
  }

  // ── Sidebar content ───────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Question Navigator</h3>
        <p className="text-xs text-gray-500">{answeredCount} of {questions.length} answered</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((_, i) => {
          const status = getStatus(i);
          return (
            <motion.button
              key={i}
              onClick={() => { setCurrentQ(i); setShowSidePanel(false); }}
              className={`w-full aspect-square rounded-lg border text-xs font-semibold transition-all ${statusStyle[status]}`}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            >
              {i + 1}
            </motion.button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { color: "bg-green-600/80", label: "Answered" },
          { color: "bg-amber-600/70", label: "Flagged" },
          { color: "bg-[#1a2850]",    label: "Not Answered" },
          { color: "bg-[#2D55FB]",    label: "Current" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="bg-[#0a0f2e] rounded-xl p-4 border border-gray-700/40">
        <h4 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" /> Test Summary
        </h4>
        {[
          { label: "Total Questions :", value: questions.length,                 color: "text-white" },
          { label: "Answered :",        value: answeredCount,                    color: "text-blue-400" },
          { label: "Flagged :",         value: flaggedCount,                     color: "text-amber-400" },
          { label: "Remaining :",       value: questions.length - answeredCount, color: "text-white" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-700/30 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <span className={`text-xs font-semibold ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Quiz Screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#060d24] text-white flex flex-col"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Hidden video — face-api runs detection on this */}
      <video
        ref={procVideoRef} muted playsInline
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {/* ── NOISE WARNING BANNER ── */}
      <AnimatePresence>
        {noiseWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-xl backdrop-blur-sm max-w-sm w-[90%]"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs flex-1 leading-snug">
              Background noise detected. Please reduce noise around you.
            </p>
            <button onClick={() => setNoiseWarning(false)} className="text-amber-400/60 hover:text-amber-300 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PROCTORING CAMERA PiP (bottom-right) ── */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
        {violationCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold">
              {violationCount} warning{violationCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
        <div
          className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden border-2 shadow-xl"
          style={{ borderColor: faceStatus === "ok" ? "#22c55e" : faceStatus === "warning" ? "#ef4444" : "#4b5563" }}
        >
          {cameraReady && (
            <video
              autoPlay muted playsInline
              ref={(el) => { if (el && procStreamRef.current && !el.srcObject) el.srcObject = procStreamRef.current; }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1836]">
              <VideoOff className="w-5 h-5 text-gray-500 mb-1" />
              <span className="text-gray-500 text-[9px] text-center leading-tight">Camera<br />unavailable</span>
            </div>
          )}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d1836]">
              <Loader2 className="w-4 h-4 text-[#2D55FB] animate-spin" />
            </div>
          )}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: faceStatus === "ok" ? "#22c55e" : faceStatus === "warning" ? "#ef4444" : "#6b7280" }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-white text-[9px] font-medium bg-black/50 px-1 rounded">
              {faceStatus === "ok" ? "OK" : faceStatus === "warning" ? "!" : "…"}
            </span>
          </div>
          <div className="absolute bottom-1 right-1.5">
            <span className="text-[9px] text-white/60 font-medium">Proctored</span>
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-30 bg-[#060d24]/95 backdrop-blur border-b border-gray-700/30 px-3 sm:px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">{title ?? "MCQ Assessment"}</h1>
            <p className="text-xs text-gray-500">Question {currentQ + 1} of {questions.length}</p>
          </div>

          {/* Save indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            {savingAnswer
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D55FB]" /><span>Saving…</span></>
              : <><div className="w-2 h-2 rounded-full bg-green-500" /><span>Saved</span></>
            }
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-mono font-semibold ${
            isWarning ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-gray-700/50 bg-[#0d1836] text-gray-300"
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isWarning ? "animate-pulse" : ""}`} />
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={() => setShowSidePanel(true)}
            className="flex lg:hidden items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2D55FB]/20 border border-[#2D55FB]/40 text-[#2D55FB] text-xs font-medium"
          >
            <BarChart2 className="w-3.5 h-3.5" /> Navigator
          </button>

          <motion.button
            onClick={() => setShowSubmitModal(true)}
            disabled={finalSubmitting}
            className="px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 bg-green-500 hover:bg-green-400 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          >
            {finalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Test"}
          </motion.button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 gap-4 lg:gap-6">
        <div className="flex-1 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0d1836] border border-gray-700/40 rounded-2xl p-4 sm:p-6 flex flex-col gap-5"
            >
              {/* Q header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D55FB] bg-[#2D55FB]/10 px-2.5 py-1 rounded-full border border-[#2D55FB]/20">
                  Question {currentQ + 1}
                </span>
                <motion.button
                  onClick={toggleFlag}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                    flagged.has(currentQ)
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-transparent border-gray-600 text-gray-500 hover:border-amber-500/40 hover:text-amber-400"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <Flag className="w-3 h-3" />
                  {flagged.has(currentQ) ? "Flagged" : "Flag"}
                </motion.button>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-gray-700/40 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#2D55FB] rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Question text */}
              <div ref={copyProtectedRef}>
                <p className="text-white text-sm sm:text-base leading-relaxed font-medium pointer-events-none select-none">
                  {currentQuestion?.questionText}
                </p>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2.5">
                {currentQuestion?.options?.map((opt, i) => {
                  const isSelected = currentAnswer?.selectedOption === opt;
                  return (
                    <motion.button
                      key={i}
                      onClick={() => handleSelectOption(opt)}
                      disabled={finalSubmitting}
                      className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border text-left transition-all text-sm cursor-pointer ${
                        isSelected
                          ? "border-[#2D55FB] bg-[#2D55FB]/15"
                          : "border-gray-700/50 bg-[#0a0f2e]/60 hover:border-[#2D55FB]/40 hover:bg-[#0a0f2e]/80"
                      }`}
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.998 }}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? "border-[#2D55FB] bg-[#2D55FB]" : "border-gray-600"
                      }`}>
                        {isSelected && (
                          savingAnswer
                            ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                            : <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className={`flex-1 ${isSelected ? "text-white" : "text-gray-300"}`}>{opt}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Neutral confirmation */}
              {currentAnswer?.submitted && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-gray-500 text-xs py-1"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-[#2D55FB]/50" />
                  <span>
                    Answer saved —{" "}
                    <span className="text-gray-400">you can change it anytime before submitting</span>
                  </span>
                </motion.div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                <motion.button
                  onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-700/50 text-gray-400 text-xs sm:text-sm hover:border-gray-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </motion.button>

                <div className="flex items-center gap-1 overflow-hidden max-w-[120px] sm:max-w-[200px]">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQ(i)}
                      className={`rounded-full transition-all ${
                        i === currentQ ? "w-5 h-2 bg-[#2D55FB]" : "w-2 h-2 bg-gray-600 hover:bg-gray-500"
                      }`}
                    />
                  ))}
                </div>

                <motion.button
                  onClick={() => setCurrentQ((q) => Math.min(questions.length - 1, q + 1))}
                  disabled={currentQ === questions.length - 1}
                  className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-[#2D55FB] text-white bg-[#2D55FB]/20 text-xs sm:text-sm hover:bg-[#2D55FB]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
          <div className="sticky top-24 bg-[#0d1836] border border-gray-700/40 rounded-2xl p-5">
            <SidebarContent />
          </div>
        </div>
      </div>

      {/* ── MOBILE DRAWER ── */}
      {showSidePanel && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setShowSidePanel(false)}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed right-0 top-0 h-full w-72 bg-[#0d1836] border-l border-gray-700/40 z-50 p-5 overflow-y-auto lg:hidden"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Question Navigator</h3>
              <button onClick={() => setShowSidePanel(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </motion.div>
        </>
      )}

      {/* ── VIOLATION ALERT — warning only, test always continues ── */}
      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl border bg-[#0d1836] border-amber-500/40"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-500/20">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-0.5">
                    {VIOLATION_MESSAGES[activeAlert.type].title}
                  </h3>
                  <p className="text-xs font-medium text-amber-400">
                    Warning #{activeAlert.count}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-5">
                {VIOLATION_MESSAGES[activeAlert.type].body}
              </p>

              {/* Tally bar — purely informational */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Warnings recorded</span>
                  <span>{activeAlert.count}</span>
                </div>
                <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((activeAlert.count / 10) * 100, 100)}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Your test continues. All warnings are recorded and reviewed after submission.
                </p>
              </div>

              <motion.button
                onClick={handleAlertClose}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors bg-[#2D55FB] hover:bg-[#1e3fd4]"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                I Understand — Continue Test
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FINAL SUBMIT MODAL ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d1836] border border-gray-700/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <h3 className="text-base font-semibold text-white mb-2">Submit Test?</h3>
            <p className="text-sm text-gray-400 mb-4">
              You have answered {answeredCount} of {questions.length} questions.
            </p>

            {violationCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-amber-400 text-xs">
                  {violationCount} proctoring warning{violationCount > 1 ? "s" : ""} will be submitted with your test.
                </span>
              </div>
            )}

            {flaggedCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                <span className="text-amber-400 text-xs">⚠ {flaggedCount} question(s) still flagged for review.</span>
              </div>
            )}

            {!flaggedCount && !violationCount && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-green-400 text-xs">Ready to submit.</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleFinalSubmit}
                disabled={finalSubmitting}
                className="flex-1 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                {finalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MCQAssessment;