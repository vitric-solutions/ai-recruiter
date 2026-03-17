
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
  submitted: boolean; // true once API has been called at least once for this question
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
const MAX_VIOLATIONS = 3;

const VIOLATION_MESSAGES: Record<ViolationType, { title: string; body: (rem: number) => string }> = {
  "tab-switch": {
    title: "Tab Switch Detected",
    body: (rem) =>
      `You navigated away from the assessment window. Please stay on this page at all times. ${rem} warning(s) remaining.`,
  },
  "no-face": {
    title: "Face Not Detected",
    body: (rem) =>
      `Your face has not been visible for several seconds. Please ensure you are seated in front of the camera. ${rem} warning(s) remaining.`,
  },
  "multiple-faces": {
    title: "Multiple People Detected",
    body: (rem) =>
      `More than one person is visible. Only the candidate is allowed in the frame. ${rem} warning(s) remaining.`,
  },
  "looking-away": {
    title: "Looking Away Detected",
    body: (rem) =>
      `You appeared to be looking away from the screen for an extended period. Please keep your eyes on the assessment. ${rem} warning(s) remaining.`,
  },
  "copy-attempt": {
    title: "Copy Attempt Detected",
    body: (rem) =>
      `You attempted to copy assessment content. Sharing or reproducing questions is strictly prohibited. ${rem} warning(s) remaining.`,
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
  const [totalScore, setTotalScore] = useState(0);
  console.log(totalScore)

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
  const savingRef = useRef(false); // prevents concurrent API calls for same question

  useEffect(() => { violationCountRef.current = violationCount; }, [violationCount]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Auto-fail helper ──────────────────────────────────────────────────────
  const triggerAutoFail = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    if (audioCheckIntervalRef.current) clearInterval(audioCheckIntervalRef.current);
    if (procStreamRef.current) procStreamRef.current.getTracks().forEach((t) => t.stop());
    setTotalScore(0);
    setPhase("result");
  }, []);

  // ── Violation handler ─────────────────────────────────────────────────────
  const triggerViolation = useCallback((type: ViolationType) => {
    if (phaseRef.current === "result") return;
    setViolationCount((prev) => {
      const next = prev + 1;
      violationCountRef.current = next;
      setActiveAlert({ type, count: next });
      return next;
    });
  }, []);

const handleAlertClose = useCallback(() => {
  if (violationCountRef.current >= MAX_VIOLATIONS) {
    setActiveAlert(null);

    // stop everything
    if (timerRef.current) clearInterval(timerRef.current);
    if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    if (audioCheckIntervalRef.current) clearInterval(audioCheckIntervalRef.current);

    if (procStreamRef.current) {
      procStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    // redirect to result page
    navigate(`/user/${id}/assessment-complete`);
  } else {
    setActiveAlert(null);
  }
}, [navigate, id]);

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
      if (res){
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

  // ── Timer ─────────────────────────────────────────────────────────────────
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
          audioCtxRef.current  = audioCtx;
          analyserRef.current  = analyser;

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
                noiseEpisodeRef.current   = false;
                noiseSilentCountRef.current = 0;
              }
            }
          }, 2000);
        } catch (e) { console.warn("Audio monitoring failed:", e); }

        // ── Face detection — consecutive-frame gating ─────────────────────
        //
        // A violation only fires after NEED_BAD consecutive bad detections of
        // the SAME type. Any single good frame resets all counters to zero.
        //
        // This eliminates false positives from:
        //   • Momentary head turns while reading
        //   • Brief lighting changes / shadows
        //   • Low-confidence single frames from the model
        //   • Natural reading posture (slight downward gaze)
        //
        // Geometry thresholds are deliberately forgiving:
        //   hOffset > 0.38 → clearly turned left/right (NOT normal reading)
        //   vRatio  < 0.10 → chin nearly at chest (NOT slight reading bow)
        //   confidence < 0.60 → frame skipped, counts as neither good nor bad
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
            const detections = await faceapi
              .detectAllFaces(
                procVideoRef.current,
                // inputSize 224 → more accurate than default 128
                // scoreThreshold 0.5 → filters uncertain ghost detections
                new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 224 })
              )
              .withFaceLandmarks(true);

            // ── No face ──
            if (detections.length === 0) {
              setFaceStatus("warning");
              if (bump("no-face") >= NEED_BAD) { resetAll(); triggerViolation("no-face"); }
              return;
            }

            // ── Multiple faces ──
            if (detections.length > 1) {
              setFaceStatus("warning");
              if (bump("multiple-faces") >= NEED_BAD) { resetAll(); triggerViolation("multiple-faces"); }
              return;
            }

            const { detection, landmarks } = detections[0];

            // ── Low confidence → skip frame (don't count as good OR bad) ──
            if (detection.score < 0.60) return;

            // ── Head-pose / gaze check via nose + jaw geometry ────────────
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

                // Horizontal: nose tip distance from jaw centre, normalised to jaw width.
                // Comfortable front-facing seated posture stays well under 0.38.
                const hOffset = Math.abs(noseTip.x - (jawLeft + jawRight) / 2) / jawWidth;

                // Vertical: nose length normalised to jaw width.
                // Drops only when head is severely tilted forward (chin to chest).
                // Normal slight reading bow stays above 0.10.
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
            // Silently ignore model/canvas errors (race on load, GPU hiccup, etc.)
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

  // ── Select / change answer — always callable, calls API every time ────────
  //
  // The backend API (submitMCQAssessment) is expected to be an upsert:
  //   • No existing record for this question → INSERT, assign score
  //   • Record already exists               → UPDATE answer + recalculate score
  //
  // This means changing an answer is completely safe and the score will
  // always reflect the candidate's LATEST choice, not their first.
  //
  const handleSelectOption = async (opt: string) => {
    const question = questions[currentQ];
    if (!question || finalSubmitting || savingRef.current) return;

    // Optimistic UI update — candidate sees the change instantly
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/40 rounded-full">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-xs font-semibold">{violationCount}/{MAX_VIOLATIONS} warnings</span>
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

              {/* Options — ALWAYS clickable, even if previously submitted */}
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
                      {/* Radio indicator */}
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

              {/* Neutral confirmation — no score, no correctness hint */}
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

      {/* ── VIOLATION ALERT ── */}
      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-2xl p-6 w-full max-w-sm shadow-2xl border ${
                activeAlert.count >= MAX_VIOLATIONS
                  ? "bg-red-950/80 border-red-500/50"
                  : "bg-[#0d1836] border-amber-500/40"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${
                  activeAlert.count >= MAX_VIOLATIONS ? "bg-red-500/20" : "bg-amber-500/20"
                }`}>
                  {activeAlert.count >= MAX_VIOLATIONS
                    ? <ShieldAlert className="w-6 h-6 text-red-400" />
                    : <AlertTriangle className="w-6 h-6 text-amber-400" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-0.5">
                    {activeAlert.count >= MAX_VIOLATIONS
                      ? "Assessment Terminated"
                      : VIOLATION_MESSAGES[activeAlert.type].title}
                  </h3>
                  <p className={`text-xs font-medium ${activeAlert.count >= MAX_VIOLATIONS ? "text-red-400" : "text-amber-400"}`}>
                    {activeAlert.count >= MAX_VIOLATIONS
                      ? "Too many violations detected"
                      : `Violation ${activeAlert.count} of ${MAX_VIOLATIONS}`}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                {activeAlert.count >= MAX_VIOLATIONS
                  ? "You have exceeded the maximum number of violations. Your assessment has been automatically submitted with the answers recorded so far."
                  : VIOLATION_MESSAGES[activeAlert.type].body(MAX_VIOLATIONS - activeAlert.count)}
              </p>

              {activeAlert.count < MAX_VIOLATIONS && (
                <div className="mb-5">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Violations</span>
                    <span>{activeAlert.count} / {MAX_VIOLATIONS}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: activeAlert.count === 1 ? "#f59e0b" : "#ef4444" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(activeAlert.count / MAX_VIOLATIONS) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              )}

              <motion.button
                onClick={handleAlertClose}
                className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                  activeAlert.count >= MAX_VIOLATIONS ? "bg-red-500 hover:bg-red-400" : "bg-[#2D55FB] hover:bg-[#1e3fd4]"
                }`}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                {activeAlert.count >= MAX_VIOLATIONS ? "Exit Assessment" : "I Understand"}
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

            {flaggedCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                <span className="text-amber-400 text-xs">⚠ {flaggedCount} question(s) still flagged for review.</span>
              </div>
            )}
            {!flaggedCount && (
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



// import React, { useEffect, useState, useRef, useCallback } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import Vapi from "@vapi-ai/web";
// import {
//   Mic, MicOff, Video, VideoOff, PhoneOff, LayoutGrid, MonitorUp,
//   User, Loader2, ShieldAlert, AlertTriangle, Volume2, X, Maximize,
//   Wifi, CheckCircle2, EyeOff, Eye, Users, VideoOff as CamOff,
// } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { useAuth } from "../../context/context";
// import { userService } from "../../services/service/userService";
// import * as faceapi from "@vladmandic/face-api";

// // ─────────────────────────────────────────────────────────────────────────────
// // FACE-API MODEL LOADING  (same CDN as MCQAssessment)
// // ─────────────────────────────────────────────────────────────────────────────
// const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
// let faceModelsLoaded = false;
// async function loadFaceModels() {
//   if (faceModelsLoaded) return;
//   await Promise.all([
//     faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URL),
//     faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
//   ]);
//   faceModelsLoaded = true;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // AVATAR CONFIGURATION
// // ─────────────────────────────────────────────────────────────────────────────
// const AVATAR_CONFIG = {
//   heygen: {
//     apiKey: "sk_V2_hgu_kBz4ii8AzWD_oRmNinOC4JiXq8Q8KcOXuKm84nrjnquG",
//     avatarId: "a02648040d8140ffbff8157743559a98",
//     voiceId: "",
//     quality: "high" as const,
//   },
//   ganai: {
//     apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ2YWliaGF2QHZpdHJpYy5pbiIsImp0aSI6ImE1ODhiZDJiLWQ1NDUtNGFmNy1iOTRhLTYzNDAwZTliNmFmYiIsInJlZnJlc2giOmZhbHNlLCJpYXQiOjE3NzE5OTk1NDMsIm9yZ0lkIjoiYzNkODdkZjktMjEyNi00MTdkLWJiYmEtMWQ3MjZhMGI5YWI5IiwiZXhwIjoxOTI5Njc5NTQzfQ.8nPZ-7yk_agsRvoEW3gfOQMcx9-JBE722BIZTAdzwTY",
//     avatarId: "",
//     voiceId: "",
//     baseUrl: "https://api.gan.ai",
//   },
// };

// const USE_HEYGEN = !!AVATAR_CONFIG.heygen.apiKey && !!AVATAR_CONFIG.heygen.avatarId;
// const USE_GANAI  = !USE_HEYGEN && !!AVATAR_CONFIG.ganai.apiKey && !!AVATAR_CONFIG.ganai.avatarId;

// // ─────────────────────────────────────────────────────────────────────────────
// // GAN.AI SERVICE
// // ─────────────────────────────────────────────────────────────────────────────
// const ganAi = {
//   async generate(script: string): Promise<string | null> {
//     try {
//       const body: any = { avatar_id: AVATAR_CONFIG.ganai.avatarId, script, background: { type: "color", value: "#0d1535" } };
//       if (AVATAR_CONFIG.ganai.voiceId) body.voice_id = AVATAR_CONFIG.ganai.voiceId;
//       const r = await fetch(`${AVATAR_CONFIG.ganai.baseUrl}/v2/avatar/generate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", "x-api-key": AVATAR_CONFIG.ganai.apiKey },
//         body: JSON.stringify(body),
//       });
//       if (!r.ok) return null;
//       const d = await r.json();
//       return d?.render_id ?? d?.id ?? null;
//     } catch { return null; }
//   },
//   async poll(renderId: string): Promise<string | null> {
//     for (let i = 0; i < 45; i++) {
//       await new Promise((r) => setTimeout(r, 4000));
//       try {
//         const r = await fetch(`${AVATAR_CONFIG.ganai.baseUrl}/v2/renders/${renderId}`, { headers: { "x-api-key": AVATAR_CONFIG.ganai.apiKey } });
//         if (!r.ok) continue;
//         const d = await r.json();
//         if (d?.status === "completed" && d?.video_url) return d.video_url;
//         if (d?.status === "failed") return null;
//       } catch {}
//     }
//     return null;
//   },
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // HEYGEN STREAMING AVATAR SERVICE
// // ─────────────────────────────────────────────────────────────────────────────
// type HeyGenInstance = any;
// class HeyGenService {
//   private avatar: HeyGenInstance = null;
//   private sessionData: any = null;
//   private videoRef: React.RefObject<HTMLVideoElement>;
//   onStateChange?: (speaking: boolean) => void;
//   onStreamReady?: () => void;

//   constructor(videoRef: React.RefObject<HTMLVideoElement>) { this.videoRef = videoRef; }

//   async init(): Promise<boolean> {
//     try {
//       const mod = await import("@heygen/streaming-avatar" as any);
//       const StreamingAvatar = mod.StreamingAvatar ?? (mod as any).default?.StreamingAvatar ?? (mod as any).default;
//       const StreamingEvents = mod.StreamingEvents ?? (mod as any).default?.StreamingEvents;
//       if (typeof StreamingAvatar !== "function") throw new Error(`StreamingAvatar is not a constructor`);
//       this.avatar = new StreamingAvatar({ token: await this.getToken() });
//       this.avatar.on(StreamingEvents.AVATAR_START_TALKING, () => this.onStateChange?.(true));
//       this.avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => this.onStateChange?.(false));
//       this.avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
//         if (this.videoRef.current && event.detail) {
//           this.videoRef.current.srcObject = event.detail;
//           this.videoRef.current.play().catch(() => {}).then(() => { this.onStreamReady?.(); });
//         }
//       });
//       this.sessionData = await this.avatar.createStartAvatar({
//         avatarName: AVATAR_CONFIG.heygen.avatarId,
//         quality: AVATAR_CONFIG.heygen.quality,
//         voice: AVATAR_CONFIG.heygen.voiceId ? { voiceId: AVATAR_CONFIG.heygen.voiceId } : undefined,
//       });
//       return true;
//     } catch (e) { console.error("HeyGen init error:", e); return false; }
//   }

//   private async getToken(): Promise<string> {
//     const r = await fetch("https://api.heygen.com/v1/streaming.create_token", { method: "POST", headers: { "x-api-key": AVATAR_CONFIG.heygen.apiKey } });
//     const d = await r.json();
//     return d?.data?.token ?? "";
//   }

//   async speak(text: string): Promise<void> {
//     if (!this.avatar || !this.sessionData) return;
//     try {
//       const mod = await import("@heygen/streaming-avatar" as any);
//       const TaskType = mod.TaskType ?? (mod as any).default?.TaskType;
//       await this.avatar.speak({ sessionId: this.sessionData.session_id, text, task_type: TaskType?.REPEAT ?? "repeat" });
//     } catch (e) { console.warn("HeyGen speak error:", e); }
//   }

//   async destroy(): Promise<void> {
//     try { await this.avatar?.stopAvatar(); } catch {}
//     this.avatar = null; this.sessionData = null;
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // TYPES & CONSTANTS
// // ─────────────────────────────────────────────────────────────────────────────
// type Screen = "lobby" | "connecting" | "spotlight" | "grid";
// type AvatarMode = "heygen" | "ganai" | "animated";
// type AvatarState = "idle" | "thinking" | "speaking";

// const MAX_VIOLATIONS      = 3;
// const SILENCE_THRESHOLD_SEC = 30;

// // Proctoring thresholds — identical to MCQAssessment
// const TICK_MS   = 1200;  // detection interval
// const HARD_TICKS = 8;    // 8 × 1.2 s = ~10 s before violation fires
// const EAR_HARD  = 0.15;  // eyes fully closed
// const GAZE_HARD = 0.30;  // clear head turn

// // EAR helper
// const edPt = (a: faceapi.Point, b: faceapi.Point) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
// const earVal = (pts: faceapi.Point[]) => pts.length < 6 ? 1 : (edPt(pts[1],pts[5])+edPt(pts[2],pts[4]))/(2*edPt(pts[0],pts[3]));

// const VIOLATION_MESSAGES: Record<string, { title: string; body: (r: number) => string; spoken: string }> = {
//   "tab-switch":      { title: "Tab Switch Detected",      body: r => `You navigated away. ${r} warning(s) remaining.`,              spoken: "I noticed you switched tabs. Please stay on the interview window. This is a warning." },
//   "camera-off":      { title: "Camera Turned Off",        body: r => `Keep camera on. ${r} warning(s) remaining.`,                  spoken: "Please turn your camera back on. Camera must remain on throughout the interview. This is a warning." },
//   "no-face":         { title: "Face Not Detected",        body: r => `Sit in front of the camera. ${r} warning(s) remaining.`,      spoken: "I can't see your face clearly. Please sit directly in front of the camera and look at the screen. This is a warning." },
//   "multiple-faces":  { title: "Multiple People Detected", body: r => `Only candidate should be visible. ${r} warning(s) remaining.`, spoken: "I detected multiple people on camera. Only the candidate should be visible. This is a warning." },
//   "fullscreen-exit": { title: "Fullscreen Exited",        body: r => `Stay in fullscreen. ${r} warning(s) remaining.`,              spoken: "Please keep the interview in fullscreen mode. Exiting fullscreen is not permitted. This is a warning." },
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // CROSS-BROWSER FULLSCREEN HELPERS
// // ─────────────────────────────────────────────────────────────────────────────
// function isInFullscreen(): boolean {
//   return !!(
//     document.fullscreenElement ||
//     (document as any).webkitFullscreenElement ||
//     (document as any).mozFullScreenElement ||
//     (document as any).msFullscreenElement
//   );
// }
// function tryEnterFS() {
//   try {
//     if (!isInFullscreen()) {
//       const el = document.documentElement as any;
//       (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen)?.call(el, { navigationUI: "hide" });
//     }
//   } catch {}
// }
// async function tryExitFS() {
//   try {
//     if (isInFullscreen()) {
//       const doc = document as any;
//       await (doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen)?.call(document);
//     }
//   } catch {}
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // BEHAVIOR TRACKER
// // ─────────────────────────────────────────────────────────────────────────────
// class BehaviorTracker {
//   events: Array<{ type: string; timestamp: number }> = [];
//   addEvent(type: string) { this.events.push({ type, timestamp: Date.now() }); }
//   getReport() {
//     return {
//       totalEvents: this.events.length,
//       noFaceCount: this.events.filter(e => e.type === "no_face").length,
//       multipleFacesCount: this.events.filter(e => e.type === "multiple_faces").length,
//       events: this.events,
//     };
//   }
// }


// // ─────────────────────────────────────────────────────────────────────────────
// // ANIMATED AVATAR
// // ─────────────────────────────────────────────────────────────────────────────
// const AnimatedAvatar = React.memo(({ state }: { state: AvatarState }) => {
//   const [blink, setBlink] = useState(false);
//   const [mouth, setMouth] = useState(0);
//   const [breathe, setBreathe] = useState(false);

//   useEffect(() => {
//     let t: ReturnType<typeof setTimeout>;
//     const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); loop(); }, 2500 + Math.random() * 2500); };
//     loop(); return () => clearTimeout(t);
//   }, []);
//   useEffect(() => { const t = setInterval(() => setBreathe(p => !p), 2200); return () => clearInterval(t); }, []);
//   useEffect(() => {
//     if (state !== "speaking") { setMouth(0); return; }
//     const t = setInterval(() => setMouth(p => (p % 4) + 1), 90); return () => clearInterval(t);
//   }, [state]);

//   const mouthD = ["M 116 218 Q 140 222 164 218","M 116 216 Q 140 228 164 216","M 114 215 Q 140 234 166 215","M 112 213 Q 140 238 168 213","M 114 215 Q 140 232 166 215"][mouth];

//   return (
//     <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0b1230] via-[#0d1535] to-[#060c22]">
//       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
//         <div className="w-64 h-80 rounded-full opacity-15" style={{ background: "radial-gradient(ellipse, #2D55FB 0%, transparent 70%)", filter: "blur(50px)" }} />
//       </div>
//       <motion.div animate={{ y: breathe && state === "idle" ? -4 : 0 }} transition={{ duration: 2.2, ease: "easeInOut" }}>
//         <svg width="210" height="252" viewBox="0 0 280 340" style={{ filter: "drop-shadow(0 12px 40px rgba(45,85,251,0.25))" }}>
//           <defs>
//             <linearGradient id="av_skin" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f8d5b5"/><stop offset="45%" stopColor="#f0c4a0"/><stop offset="100%" stopColor="#e0a87a"/></linearGradient>
//             <linearGradient id="av_hair" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3a2c1e"/><stop offset="100%" stopColor="#1a140d"/></linearGradient>
//             <linearGradient id="av_suit" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#162050"/><stop offset="100%" stopColor="#0b1234"/></linearGradient>
//             <radialGradient id="av_iris" cx="38%" cy="32%" r="62%"><stop offset="0%" stopColor="#5b7bbf"/><stop offset="100%" stopColor="#2d4a7a"/></radialGradient>
//             <filter id="av_shadow"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.28"/></filter>
//           </defs>
//           <rect x="122" y="232" width="36" height="45" rx="6" fill="url(#av_skin)"/>
//           <path d="M 48 330 Q 50 268 90 256 L 140 266 L 190 256 Q 230 268 232 330 Z" fill="url(#av_suit)"/>
//           <path d="M 118 258 L 140 278 L 162 258 L 155 250 L 140 268 L 125 250 Z" fill="#f0f4ff"/>
//           <path d="M 134 263 L 140 308 L 146 263 L 140 258 Z" fill="#2D55FB" opacity="0.9"/>
//           <path d="M 137 261 L 143 261 L 142 267 L 138 267 Z" fill="#1e3fd4"/>
//           <path d="M 90 256 Q 112 245 130 250 L 118 258 Q 78 272 68 292 Z" fill="#101840" opacity="0.65"/>
//           <path d="M 190 256 Q 168 245 150 250 L 162 258 Q 202 272 212 292 Z" fill="#101840" opacity="0.65"/>
//           <ellipse cx="140" cy="146" rx="88" ry="100" fill="url(#av_skin)" filter="url(#av_shadow)"/>
//           <path d="M 56 108 Q 50 48 140 36 Q 230 48 224 108 L 220 128 Q 212 73 140 66 Q 68 73 60 128 Z" fill="url(#av_hair)"/>
//           <path d="M 56 108 Q 52 142 58 165 Q 54 132 60 128 Z" fill="url(#av_hair)"/>
//           <path d="M 224 108 Q 228 142 222 165 Q 226 132 220 128 Z" fill="url(#av_hair)"/>
//           <ellipse cx="52" cy="153" rx="10" ry="14" fill="url(#av_skin)"/>
//           <path d="M 56 146 Q 60 153 56 160" stroke="#d4956a" strokeWidth="1.5" fill="none"/>
//           <ellipse cx="228" cy="153" rx="10" ry="14" fill="url(#av_skin)"/>
//           <path d="M 224 146 Q 220 153 224 160" stroke="#d4956a" strokeWidth="1.5" fill="none"/>
//           <path d="M 86 106 Q 104 100 120 105" stroke="#3a2c1e" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
//           <ellipse cx="103" cy="126" rx="16" ry={blink ? 0.8 : 12} fill="white"/>
//           {!blink && (<><ellipse cx="105" cy="127" rx="9" ry="9" fill="url(#av_iris)"/><ellipse cx="105" cy="127" rx="5" ry="5" fill="#0a0a0a"/><circle cx="102" cy="124" r="2.5" fill="white" opacity="0.9"/></>)}
//           <path d={blink ? "M 87 126 Q 103 126 119 126" : "M 87 118 Q 103 113 119 118"} stroke="#3a2c1e" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
//           <path d="M 160 105 Q 176 100 194 106" stroke="#3a2c1e" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
//           <ellipse cx="177" cy="126" rx="16" ry={blink ? 0.8 : 12} fill="white"/>
//           {!blink && (<><ellipse cx="175" cy="127" rx="9" ry="9" fill="url(#av_iris)"/><ellipse cx="175" cy="127" rx="5" ry="5" fill="#0a0a0a"/><circle cx="172" cy="124" r="2.5" fill="white" opacity="0.9"/></>)}
//           <path d={blink ? "M 161 126 Q 177 126 193 126" : "M 161 118 Q 177 113 193 118"} stroke="#3a2c1e" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
//           <path d="M 140 133 L 135 168 Q 140 175 145 168 Z" fill="#d4956a" opacity="0.28"/>
//           <path d="M 130 171 Q 140 177 150 171" stroke="#c4856a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
//           <ellipse cx="92" cy="168" rx="15" ry="8" fill="#f08080" opacity="0.10"/>
//           <ellipse cx="188" cy="168" rx="15" ry="8" fill="#f08080" opacity="0.10"/>
//           <path d="M 116 213 Q 128 208 140 210 Q 152 208 164 213" stroke="#c0766a" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
//           <path d={mouthD} stroke="#a85a5a" strokeWidth="2.5" fill={mouth > 1 ? "#7a3030" : "none"} strokeLinecap="round"/>
//           {mouth > 1 && (<path d="M 120 216 Q 140 228 160 216 L 158 220 Q 140 232 122 220 Z" fill="white" opacity="0.88"/>)}
//           <path d="M 118 238 Q 140 252 162 238" stroke="#d4956a" strokeWidth="1" fill="none" opacity="0.3"/>
//         </svg>
//       </motion.div>
//       <div className="mt-2 h-5 flex items-center justify-center">
//         {state === "thinking" && (
//           <div className="flex gap-1.5 items-center">
//             {[0,0.15,0.3].map((d,i) => (<motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#2D55FB]" animate={{ y:["0px","-6px","0px"], opacity:[0.5,1,0.5] }} transition={{ duration:0.7, repeat:Infinity, delay:d }}/>))}
//             <span className="text-white/35 text-[10px] ml-1 font-medium">Thinking…</span>
//           </div>
//         )}
//         {state === "speaking" && (
//           <div className="flex items-center gap-1">
//             {[0,0.08,0.16,0.24,0.16,0.08].map((d,i) => (<motion.div key={i} className="w-0.5 rounded-full bg-[#2D55FB]" animate={{ height:["3px",`${6+(i%3)*4}px`,"3px"] }} transition={{ duration:0.45, repeat:Infinity, delay:d, ease:"easeInOut" }}/>))}
//             <span className="text-[#2D55FB] text-[10px] ml-1.5 font-semibold">Speaking</span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // AVATAR TILE
// // ─────────────────────────────────────────────────────────────────────────────
// interface AvatarTileProps { mode: AvatarMode; state: AvatarState; heygenVideoRef: React.RefObject<HTMLVideoElement>; ganAiVideoUrl: string | null; ganAiLoading: boolean; heygenReady: boolean; }
// const AvatarTile = React.memo(({ mode, state, heygenVideoRef, ganAiVideoUrl, ganAiLoading, heygenReady }: AvatarTileProps) => {
//   const ganVideoRef = useRef<HTMLVideoElement>(null);
//   useEffect(() => { if (ganAiVideoUrl && ganVideoRef.current) { ganVideoRef.current.src = ganAiVideoUrl; ganVideoRef.current.play().catch(() => {}); } }, [ganAiVideoUrl]);
//   return (
//     <div className="absolute inset-0">
//       <AnimatedAvatar state={mode === "heygen" && heygenReady ? "idle" : state}/>
//       {mode === "heygen" && (<video ref={heygenVideoRef} playsInline autoPlay className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${heygenReady?"opacity-100":"opacity-0"}`}/>)}
//       {mode === "ganai" && ganAiVideoUrl && (<video ref={ganVideoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ opacity:ganAiVideoUrl?1:0, transition:"opacity 0.5s" }} onEnded={()=>{ if(ganVideoRef.current) ganVideoRef.current.src=""; }}/>)}
//       <div className="absolute top-3 left-3 z-20">
//         {mode === "heygen" && (<div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-sm text-[9px] font-semibold ${heygenReady?"bg-green-500/15 border-green-500/30 text-green-300":"bg-amber-500/15 border-amber-500/30 text-amber-300"}`}><div className={`w-1.5 h-1.5 rounded-full ${heygenReady?"bg-green-400 animate-pulse":"bg-amber-400 animate-pulse"}`}/>{heygenReady?"Live Avatar":"Connecting…"}</div>)}
//         {mode === "ganai" && (<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-sm bg-purple-500/15 border-purple-500/30 text-purple-300 text-[9px] font-semibold"><div className={`w-1.5 h-1.5 rounded-full ${ganAiLoading?"bg-amber-400 animate-pulse":"bg-purple-400"}`}/>{ganAiLoading?"Rendering…":"Gan.AI"}</div>)}
//       </div>
//     </div>
//   );
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // CONNECTING SCREEN
// // ─────────────────────────────────────────────────────────────────────────────
// interface ConnectingScreenProps { heygenReady: boolean; vapiReady: boolean; avatarMode: AvatarMode; onBothReady: () => void; }
// const ConnectingScreen: React.FC<ConnectingScreenProps> = ({ heygenReady, vapiReady, avatarMode, onBothReady }) => {
//   const bothDone = avatarMode === "heygen" ? heygenReady && vapiReady : vapiReady;
//   useEffect(() => { if (bothDone) { const t = setTimeout(onBothReady, 600); return () => clearTimeout(t); } }, [bothDone, onBothReady]);
//   const items = [
//     { label:"Vapi Voice AI", done:vapiReady, desc:vapiReady?"Voice AI connected":"Connecting voice AI…" },
//     ...(avatarMode==="heygen" ? [{ label:"HeyGen Avatar", done:heygenReady, desc:heygenReady?"Avatar stream live":"Starting avatar stream…" }] : []),
//   ];
//   return (
//     <div className="h-screen bg-[#050A24] flex flex-col items-center justify-center gap-8 px-6">
//       <div className="relative">
//         <div className="w-24 h-24 rounded-full bg-[#2D55FB]/10 border border-[#2D55FB]/20 flex items-center justify-center"><Wifi className="h-10 w-10 text-[#2D55FB]"/></div>
//         {!bothDone && (<><motion.div className="absolute inset-0 rounded-full border border-[#2D55FB]/40" animate={{ scale:[1,1.6], opacity:[0.5,0] }} transition={{ duration:1.8, repeat:Infinity, ease:"easeOut" }}/><motion.div className="absolute inset-0 rounded-full border border-[#2D55FB]/25" animate={{ scale:[1,2.2], opacity:[0.3,0] }} transition={{ duration:1.8, repeat:Infinity, ease:"easeOut", delay:0.4 }}/></>)}
//         {bothDone && (<motion.div initial={{ scale:0 }} animate={{ scale:1 }} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 border-2 border-[#050A24] flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-white"/></motion.div>)}
//       </div>
//       <div className="text-center">
//         <h2 className="text-white text-2xl font-bold mb-2">{bothDone?"All systems ready!":"Setting up your interview…"}</h2>
//         <p className="text-white/40 text-sm">{bothDone?"Starting interview now":"Please wait while we connect the AI interviewer"}</p>
//       </div>
//       <div className="flex flex-col gap-3 w-full max-w-sm">
//         {items.map(({ label, done, desc }) => (
//           <div key={label} className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-500 ${done?"bg-green-500/10 border-green-500/30":"bg-[#0d1535] border-white/8"}`}>
//             <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${done?"bg-green-500/20":"bg-[#2D55FB]/15"}`}>{done?<CheckCircle2 className="h-5 w-5 text-green-400"/>:<Loader2 className="h-5 w-5 text-[#2D55FB] animate-spin"/>}</div>
//             <div className="flex flex-col min-w-0"><span className={`font-semibold text-sm ${done?"text-green-300":"text-white"}`}>{label}</span><span className={`text-xs ${done?"text-green-400/70":"text-white/35"}`}>{desc}</span></div>
//             {done && (<motion.div initial={{ scale:0 }} animate={{ scale:1 }} className="ml-auto w-2 h-2 rounded-full bg-green-400"/>)}
//           </div>
//         ))}
//       </div>
//       {!bothDone && (<p className="text-white/20 text-xs text-center max-w-xs">This usually takes 5–15 seconds. Do not close or navigate away.</p>)}
//     </div>
//   );
// };


// // ─────────────────────────────────────────────────────────────────────────────
// // SMALL REUSABLE UI COMPONENTS
// // ─────────────────────────────────────────────────────────────────────────────
// const WaveBar = ({ delay, active }: { delay: number; active: boolean }) => (
//   <motion.span className="inline-block w-0.75 rounded-full bg-white/80 mx-[1.5px]" style={{ minHeight:3 }}
//     animate={active?{ height:["3px","14px","5px","18px","3px"] }:{ height:"3px" }}
//     transition={{ duration:1.15, repeat:Infinity, ease:"easeInOut", delay }}/>
// );
// const AudioWave = ({ active=true }: { active?: boolean }) => (
//   <div className={`flex items-center px-2.5 py-1.5 rounded-full shadow-lg transition-all ${active?"bg-[#2D55FB] shadow-[#2D55FB]/40":"bg-white/10"}`}>
//     <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mr-1.5 shrink-0"><span className="flex gap-0.5"><span className="w-0.75 h-2.25 bg-white rounded-sm block"/><span className="w-0.75 h-2.25 bg-white rounded-sm block"/></span></div>
//     {[0,0.07,0.14,0.21,0.1,0.28,0.05,0.18,0.12,0.24,0.08,0.2,0.16].map((d,i)=>(<WaveBar key={i} delay={d} active={active}/>))}
//   </div>
// );
// const MicCircle = ({ muted }: { muted: boolean }) => (
//   <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${muted?"bg-red-500 shadow-red-500/40":"bg-[#2D55FB] shadow-[#2D55FB]/40"}`}>
//     {muted?<MicOff className="h-4 w-4 text-white"/>:<Mic className="h-4 w-4 text-white"/>}
//   </div>
// );
// const CtrlBtn = ({ onClick, active=true, danger=false, children }: { onClick?:()=>void; active?:boolean; danger?:boolean; children:React.ReactNode }) => (
//   <motion.button onClick={onClick} whileTap={{ scale:0.88 }}
//     className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-colors ${danger?"bg-red-500 hover:bg-red-400 text-white shadow-red-500/40":active?"bg-white hover:bg-gray-100 text-gray-800":"bg-white text-red-500"}`}>
//     {children}
//   </motion.button>
// );
// const UserVideo = React.memo(({ camOn, streamReady, username, onVideoMount }: { camOn:boolean; streamReady:boolean; username:string; onVideoMount:(el:HTMLVideoElement|null)=>void }) => (
//   <>
//     <video ref={onVideoMount} muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn&&streamReady?"opacity-100":"opacity-0"}`} style={{ transform:"scaleX(-1)" }}/>
//     {(!camOn||!streamReady) && (
//       <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e] to-[#060c25]">
//         <div className="w-16 h-16 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center mb-2">
//           {streamReady?<VideoOff className="h-8 w-8 text-[#2D55FB]/60"/>:<User className="h-8 w-8 text-[#2D55FB]/50"/>}
//         </div>
//         <span className="text-white/30 text-xs">{streamReady?"Camera Off":username}</span>
//       </div>
//     )}
//   </>
// ));

// interface AlertState { type: string; count: number; title: string; body: string; }
// const ViolationModal = ({ alert, onClose }: { alert: AlertState; onClose: () => void }) => {
//   const term = alert.count >= MAX_VIOLATIONS;
//   return (
//     <div className="fixed inset-0 z-[9999] flex items-center justify-center">
//       <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
//       <motion.div initial={{ opacity:0, scale:0.92, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.92, y:16 }} transition={{ duration:0.22 }}
//         className={`relative z-10 w-full max-w-sm mx-4 rounded-2xl border p-6 shadow-2xl ${term?"bg-red-950/90 border-red-500/50":"bg-[#0d1836] border-amber-500/40"}`}>
//         <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${term?"bg-red-500/20":"bg-amber-500/20"}`}>
//           {term?<ShieldAlert className="h-6 w-6 text-red-400"/>:<AlertTriangle className="h-6 w-6 text-amber-400"/>}
//         </div>
//         <h3 className="text-white font-bold text-lg mb-1">{term?"Interview Terminated":alert.title}</h3>
//         <p className={`text-sm mb-1 ${term?"text-red-400":"text-amber-400"}`}>{term?"Maximum violations reached":`Violation ${alert.count} of ${MAX_VIOLATIONS}`}</p>
//         <p className="text-white/70 text-sm leading-relaxed mb-5">{alert.body}</p>
//         {!term && (<div className="flex gap-1.5 mb-5">{[...Array(MAX_VIOLATIONS)].map((_,i)=>(<div key={i} className={`flex-1 h-1.5 rounded-full ${i<alert.count?"bg-amber-400":"bg-white/10"}`}/>))}</div>)}
//         <motion.button onClick={onClose} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
//           className={`w-full py-2.5 rounded-xl font-semibold text-white text-sm ${term?"bg-red-500 hover:bg-red-400":"bg-[#2D55FB] hover:bg-[#1e3fd4]"}`}>
//           {term?"View Results":"I Understand"}
//         </motion.button>
//       </motion.div>
//     </div>
//   );
// };
// const NoiseBanner = ({ onDismiss }: { onDismiss: () => void }) => (
//   <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }}
//     className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-amber-500/90 backdrop-blur-sm border border-amber-400/50 rounded-xl px-4 py-2.5 shadow-lg max-w-sm w-full mx-4">
//     <Volume2 className="h-4 w-4 text-amber-900 shrink-0"/>
//     <span className="text-amber-950 text-xs font-semibold flex-1">Background noise detected — please reduce noise around you.</span>
//     <button onClick={onDismiss} className="text-amber-900/60 hover:text-amber-900"><X className="h-4 w-4"/></button>
//   </motion.div>
// );
// const FullscreenBanner = ({ onDismiss }: { onDismiss: () => void }) => (
//   <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }}
//     className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-red-500/90 backdrop-blur-sm border border-red-400/50 rounded-xl px-4 py-2.5 shadow-lg max-w-sm w-full mx-4">
//     <Maximize className="h-4 w-4 text-white shrink-0"/>
//     <span className="text-white text-xs font-semibold flex-1">Fullscreen exited — re-entering automatically.</span>
//     <button onClick={onDismiss} className="text-white/60 hover:text-white"><X className="h-4 w-4"/></button>
//   </motion.div>
// );


// // ═════════════════════════════════════════════════════════════════════════════
// // MAIN COMPONENT
// // ═════════════════════════════════════════════════════════════════════════════
// const VideoInterview: React.FC = () => {
//   const { interviewInfo, userData } = useAuth();
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const interview_id = id || "";

//   // ── Core state ─────────────────────────────────────────────────────────
//   const [screen, setScreen]                     = useState<Screen>("lobby");
//   const [micOn, setMicOn]                       = useState(true);
//   const [camOn, setCamOn]                       = useState(true);
//   const [streamReady, setStreamReady]           = useState(false);
//   const [elapsed, setElapsed]                   = useState(0);
//   const [timeLeft, setTimeLeft]                 = useState(0);
//   const [now, setNow]                           = useState(new Date());
//   const [loading, setLoading]                   = useState(true);
//   const [vapi, setVapi]                         = useState<any>(null);
//   const [isCallActive, setIsCallActive]         = useState(false);
//   const [isSpeaking, setIsSpeaking]             = useState(false);
//   const [isListening, setIsListening]           = useState(false);
//   const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
//   const [avatarSub, setAvatarSub]               = useState("Waiting for AI to speak...");
//   const [userSub, setUserSub]                   = useState("Your transcript will appear here...");
//   const [resumeData, setResumeData]             = useState<any>(null);
//   const [isResumeInterview, setIsResumeInterview] = useState(false);
//   const [noFaceWarning, setNoFaceWarning]       = useState(false);
//   const [activeAlert, setActiveAlert]           = useState<AlertState | null>(null);
//   const [noiseWarning, setNoiseWarning]         = useState(false);
//   const [isFullscreen, setIsFullscreen]         = useState(false);
//   const [showFSBanner, setShowFSBanner]         = useState(false);
//   const [faceStatus, setFaceStatus]             = useState<"ok"|"warn"|"unknown">("unknown");

//   // ── Connection gate state ──────────────────────────────────────────────
//   const [vapiReady, setVapiReady]               = useState(false);
//   const [heygenStreamLive, setHeygenStreamLive] = useState(false);

//   // ── Avatar state ───────────────────────────────────────────────────────
//   const [avatarMode]                            = useState<AvatarMode>(USE_HEYGEN?"heygen":USE_GANAI?"ganai":"animated");
//   const [avatarState, setAvatarState]           = useState<AvatarState>("idle");
//   const [heygenReady, setHeygenReady]           = useState(false);
//   const [ganAiVideoUrl, setGanAiVideoUrl]       = useState<string | null>(null);
//   const [ganAiLoading, setGanAiLoading]         = useState(false);
//   const heygenVideoRef                          = useRef<HTMLVideoElement>(null);
//   const heygenServiceRef                        = useRef<HeyGenService | null>(null);

//   // ── Refs ───────────────────────────────────────────────────────────────
//   const streamRef               = useRef<MediaStream | null>(null);
//   const lobbyVidRef             = useRef<HTMLVideoElement>(null);
//   const spotlightVidElRef       = useRef<HTMLVideoElement | null>(null);
//   const gridUserVidElRef        = useRef<HTMLVideoElement | null>(null);
//   const behaviorVidRef          = useRef<HTMLVideoElement>(null);
//   const conversationRef         = useRef<any[]>([]);
//   const aiTranscriptBufRef      = useRef("");
//   const userTranscriptBufRef    = useRef("");
//   const detectionIntervalRef    = useRef<any>(null);
//   const behaviorTrackerRef      = useRef(new BehaviorTracker());
//   const audioCtxRef             = useRef<AudioContext | null>(null);
//   const analyserRef             = useRef<AnalyserNode | null>(null);
//   const audioCheckRef           = useRef<any>(null);
//   const noiseEpisodeRef         = useRef(false);
//   const noiseSilentCntRef       = useRef(0);
//   const alertCountRef           = useRef(0);
//   const vapiRef                 = useRef<any>(null);
//   const isCallActiveRef         = useRef(false);
//   const micOnRef                = useRef(true);
//   const camAlertIssuedRef       = useRef(false);
//   const interviewEndedRef       = useRef(false);
//   const trigViolRef             = useRef<(t: string) => void>(() => {});

//   // ── Violation blinking prevention: one modal at a time ────────────────
//   // violationLockedRef = true while a modal is showing (or for 5s after close)
//   // hardTicksRef = per-check consecutive bad-tick counters (reset on violation)
//   const violationLockedRef      = useRef(false);
//   const hardTicksRef            = useRef<Record<string,number>>({ noface:0, multi:0, gaze:0, eyes:0 });

//   // ── Silence detection ──────────────────────────────────────────────────
//   const lastUserSpeechRef       = useRef<number>(Date.now());
//   const silenceCheckRef         = useRef<any>(null);
//   const silenceWarnedRef        = useRef(false);
//   const silenceWarnCountRef     = useRef(0);
//   const MAX_SILENCE_WARNINGS    = 5;

//   // ── Question count tracking ────────────────────────────────────────────
//   const questionCountRef        = useRef(0);
//   const maxQuestionsRef         = useRef(0);
//   const questionLimitReachedRef = useRef(false);
//   const preCheckDoneRef         = useRef(false);  // true after AI finishes audio/video pre-check
//   const closingInProgressRef    = useRef(false);
//   const callEndedByErrorRef     = useRef(false);

//   useEffect(() => { vapiRef.current = vapi; }, [vapi]);
//   useEffect(() => { isCallActiveRef.current = isCallActive; }, [isCallActive]);
//   useEffect(() => { micOnRef.current = micOn; }, [micOn]);

//   // ── Keyboard lock ──────────────────────────────────────────────────────
//   useEffect(() => {
//     const blockKey = (e: KeyboardEvent) => { if (isCallActiveRef.current) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } };
//     const blockCtx = (e: MouseEvent) => { if (isCallActiveRef.current) e.preventDefault(); };
//     const blockClip = (e: ClipboardEvent) => { if (isCallActiveRef.current) e.preventDefault(); };
//     document.addEventListener("keydown",  blockKey, { capture:true, passive:false });
//     document.addEventListener("keyup",    blockKey, { capture:true, passive:false });
//     document.addEventListener("keypress", blockKey, { capture:true, passive:false });
//     document.addEventListener("contextmenu", blockCtx, { capture:true, passive:false });
//     document.addEventListener("copy",  blockClip, { capture:true });
//     document.addEventListener("cut",   blockClip, { capture:true });
//     document.addEventListener("paste", blockClip, { capture:true });
//     return () => {
//       document.removeEventListener("keydown",  blockKey, { capture:true } as any);
//       document.removeEventListener("keyup",    blockKey, { capture:true } as any);
//       document.removeEventListener("keypress", blockKey, { capture:true } as any);
//       document.removeEventListener("contextmenu", blockCtx, { capture:true } as any);
//       document.removeEventListener("copy",  blockClip, { capture:true } as any);
//       document.removeEventListener("cut",   blockClip, { capture:true } as any);
//       document.removeEventListener("paste", blockClip, { capture:true } as any);
//     };
//   }, []);

//   // ── Fullscreen — all vendor-prefixed events + 2s poll fallback ─────────
//   useEffect(() => {
//     setIsFullscreen(isInFullscreen());
//     const onChange = () => {
//       const inFS = isInFullscreen();
//       setIsFullscreen(inFS);
//       if (!inFS && isCallActiveRef.current) { tryEnterFS(); setShowFSBanner(true); trigViolRef.current("fullscreen-exit"); }
//     };
//     document.addEventListener("fullscreenchange", onChange);
//     document.addEventListener("webkitfullscreenchange", onChange);
//     document.addEventListener("mozfullscreenchange", onChange);
//     document.addEventListener("MSFullscreenChange", onChange);
//     const poll = setInterval(() => setIsFullscreen(isInFullscreen()), 2000);
//     return () => {
//       document.removeEventListener("fullscreenchange", onChange);
//       document.removeEventListener("webkitfullscreenchange", onChange);
//       document.removeEventListener("mozfullscreenchange", onChange);
//       document.removeEventListener("MSFullscreenChange", onChange);
//       clearInterval(poll);
//     };
//   }, []);

//   const onSpotlightVideoMount = useCallback((el: HTMLVideoElement | null) => { spotlightVidElRef.current = el; if (el && streamRef.current) { el.srcObject = streamRef.current; el.play().catch(()=>{}); } }, []);
//   const onGridUserVideoMount  = useCallback((el: HTMLVideoElement | null) => { gridUserVidElRef.current = el;  if (el && streamRef.current) { el.srcObject = streamRef.current; el.play().catch(()=>{}); } }, []);
//   const attachStream = useCallback((ref: React.RefObject<HTMLVideoElement>) => { if (ref.current && streamRef.current) { ref.current.srcObject = streamRef.current; ref.current.play().catch(()=>{}); } }, []);

//   useEffect(() => {
//     if (!streamRef.current) return;
//     if (spotlightVidElRef.current) { spotlightVidElRef.current.srcObject = streamRef.current; spotlightVidElRef.current.play().catch(()=>{}); }
//     if (gridUserVidElRef.current)  { gridUserVidElRef.current.srcObject  = streamRef.current; gridUserVidElRef.current.play().catch(()=>{}); }
//   }, [streamReady]);

//   // ── Camera + Audio ─────────────────────────────────────────────────────
//   useEffect(() => {
//     (async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:1280}, height:{ideal:720}, facingMode:"user" }, audio:true });
//         streamRef.current = stream;
//         setStreamReady(true);
//         attachStream(lobbyVidRef);
//         if (behaviorVidRef.current) { behaviorVidRef.current.srcObject = stream; behaviorVidRef.current.play().catch(()=>{}); }
//         try {
//           const ctx = new AudioContext();
//           const analyser = ctx.createAnalyser();
//           analyser.fftSize = 256;
//           ctx.createMediaStreamSource(stream).connect(analyser);
//           audioCtxRef.current = ctx; analyserRef.current = analyser;
//           audioCheckRef.current = setInterval(() => {
//             if (!isCallActiveRef.current || !analyserRef.current) return;
//             const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
//             analyserRef.current.getByteFrequencyData(arr);
//             const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
//             if (avg > 38) { noiseSilentCntRef.current = 0; if (!noiseEpisodeRef.current) { noiseEpisodeRef.current = true; setNoiseWarning(true); } }
//             else { noiseSilentCntRef.current++; if (noiseSilentCntRef.current >= 3) { noiseEpisodeRef.current = false; noiseSilentCntRef.current = 0; } }
//           }, 2000);
//         } catch {}
//       } catch (e) { console.warn("Camera unavailable:", e); }
//     })();
//     return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); audioCtxRef.current?.close(); if (audioCheckRef.current) clearInterval(audioCheckRef.current); };
//   }, []);

//   useEffect(() => { if (screen === "lobby") attachStream(lobbyVidRef); }, [screen, attachStream]);

//   const stopAllProctoring = useCallback(() => {
//     if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
//     if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
//     streamRef.current?.getTracks().forEach(t=>t.stop());
//   }, []);

//   const endInterviewAndNavigate = useCallback(async () => {
//     if (interviewEndedRef.current) return;
//     interviewEndedRef.current = true;
//     stopAllProctoring();
//     setIsCallActive(false); isCallActiveRef.current = false;
//     setIsSpeaking(false); setAvatarState("idle");
//     try { vapiRef.current?.stop(); } catch {}
//     if (heygenServiceRef.current) { await heygenServiceRef.current.destroy(); heygenServiceRef.current = null; }
//     await tryExitFS();
//   }, [stopAllProctoring]);

//   // ── Speak violation warning via Vapi ───────────────────────────────────
//   const speakViolationWarning = useCallback((type: string, isTerminal: boolean) => {
//     const v = vapiRef.current;
//     if (!v) return;
//     const spoken = isTerminal
//       ? "You have exceeded the maximum number of warnings. This interview has been terminated."
//       : VIOLATION_MESSAGES[type]?.spoken ?? "You have received a violation warning.";
//     try { v.send({ type:"add-message", message:{ role:"system", content:`[PROCTOR ALERT — speak this immediately to the candidate, in character as the interviewer]: "${spoken}"` } }); } catch {}
//   }, []);

//   // ── triggerViolation — resets ALL counters on fire to stop blinking ────
//   const triggerViolation = useCallback((type: string) => {
//     if (!isCallActiveRef.current) return;
//     if (violationLockedRef.current) return;   // modal already showing — skip
//     violationLockedRef.current = true;

//     // Reset every hard-tick counter so the same check can't immediately re-fire
//     hardTicksRef.current = { noface:0, multi:0, gaze:0, eyes:0 };

//     alertCountRef.current++;
//     const count = alertCountRef.current;
//     const config = VIOLATION_MESSAGES[type] ?? { title:"Violation", body:(r:number)=>`${r} warning(s) remaining.`, spoken:"You have received a violation warning." };
//     const isTerminal = count >= MAX_VIOLATIONS;
//     setActiveAlert({
//       type, count,
//       title: config.title,
//       body: isTerminal ? "You have exceeded the maximum violations. Interview auto-ended." : config.body(MAX_VIOLATIONS - count),
//     });
//     speakViolationWarning(type, isTerminal);
//   }, [speakViolationWarning]);

//   useEffect(() => { trigViolRef.current = triggerViolation; }, [triggerViolation]);

//   const handleAlertClose = useCallback(() => {
//     const count = alertCountRef.current;
//     const type  = activeAlert?.type;
//     setActiveAlert(null);
//     // Unlock after 5 s — long enough that face-api ticks can't immediately re-trigger
//     setTimeout(() => { violationLockedRef.current = false; }, 5000);
//     if (count >= MAX_VIOLATIONS) endInterviewAndNavigate();
//     else if (type === "fullscreen-exit") { tryEnterFS(); setShowFSBanner(false); }
//   }, [activeAlert, endInterviewAndNavigate]);


//   // ── Silence detection — escalating, up to 5× then end ─────────────────
//   const startSilenceMonitor = useCallback(() => {
//     lastUserSpeechRef.current = Date.now();
//     silenceWarnedRef.current = false;
//     silenceWarnCountRef.current = 0;
//     if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
//     silenceCheckRef.current = setInterval(() => {
//       if (!isCallActiveRef.current) return;
//       const silent = (Date.now() - lastUserSpeechRef.current) / 1000;
//       if (silent >= SILENCE_THRESHOLD_SEC && !silenceWarnedRef.current) {
//         silenceWarnedRef.current = true;
//         lastUserSpeechRef.current = Date.now();
//         silenceWarnCountRef.current++;
//         const count = silenceWarnCountRef.current;
//         if (count >= MAX_SILENCE_WARNINGS) {
//           try { vapiRef.current?.send({ type:"add-message", message:{ role:"system", content:"[SYSTEM — FINAL]: The candidate has not responded after 5 attempts. Thank them for their time, let them know the interview is being concluded due to inactivity, and end the call professionally." } }); } catch {}
//         } else {
//           const prompts = [
//             "The candidate has not responded for 30 seconds. Gently ask if they are still there, and if they are ready to answer or need the question repeated.",
//             "The candidate is still not responding (2nd attempt). Ask clearly if they can hear you and if they need a moment.",
//             "Still no response (3rd attempt). Ask if there are any technical issues and remind them you can repeat the question.",
//             "The candidate has been silent for a while (4th attempt). Firmly but politely ask if they wish to answer or skip to the next question.",
//             "Final check (5th attempt): Let the candidate know this is the last prompt before concluding, and ask if they are ready to continue.",
//           ];
//           try { vapiRef.current?.send({ type:"add-message", message:{ role:"system", content:`[SILENCE ALERT #${count}]: ${prompts[count-1]}` } }); } catch {}
//         }
//         silenceWarnedRef.current = false;
//       }
//     }, 5000);
//   }, []);

//   // ── Proctoring: tab switch ─────────────────────────────────────────────
//   useEffect(() => {
//     if (!isCallActive) return;
//     const h = () => { if (document.hidden) triggerViolation("tab-switch"); };
//     document.addEventListener("visibilitychange", h);
//     return () => document.removeEventListener("visibilitychange", h);
//   }, [isCallActive, triggerViolation]);

//   // ── Proctoring: camera off ─────────────────────────────────────────────
//   useEffect(() => {
//     if (!isCallActive) return;
//     if (!camOn) {
//       if (!camAlertIssuedRef.current) {
//         camAlertIssuedRef.current = true;
//         triggerViolation("camera-off");
//       }
//     } else {
//       camAlertIssuedRef.current = false;
//     }
//   }, [camOn, isCallActive, triggerViolation]);

//   // ── Proctoring: face-api engine — mirrors MCQAssessment exactly ────────
//   useEffect(() => {
//     if (!isCallActive) { clearInterval(detectionIntervalRef.current); return; }
//     let modelReady = false;
//     loadFaceModels()
//       .then(() => { modelReady = true; })
//       .catch(e => console.warn("face-api load failed:", e));

//     detectionIntervalRef.current = setInterval(async () => {
//       if (!isCallActiveRef.current || !modelReady) return;
//       const vid = behaviorVidRef.current;
//       if (!vid || vid.readyState < 2) return;

//       try {
//         const dets = await faceapi
//           .detectAllFaces(vid, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.40 }))
//           .withFaceLandmarks();

//         const H = hardTicksRef.current;

//         // ── NO FACE ──────────────────────────────────────────────────────
//         if (dets.length === 0) {
//           setNoFaceWarning(true);
//           setFaceStatus("warn");
//           H.multi = 0; H.gaze = 0; H.eyes = 0;
//           H.noface = (H.noface || 0) + 1;
//           if (H.noface >= HARD_TICKS) { H.noface = 0; behaviorTrackerRef.current.addEvent("no_face"); triggerViolation("no-face"); }
//           return;
//         }
//         H.noface = 0;
//         setNoFaceWarning(false);

//         // ── MULTIPLE FACES ────────────────────────────────────────────────
//         if (dets.length > 1) {
//           setFaceStatus("warn");
//           H.gaze = 0; H.eyes = 0;
//           H.multi = (H.multi || 0) + 1;
//           if (H.multi >= HARD_TICKS) { H.multi = 0; behaviorTrackerRef.current.addEvent("multiple_faces"); triggerViolation("multiple-faces"); }
//           return;
//         }
//         H.multi = 0;

//         if (dets[0].detection.score < 0.42) return;
//         const { landmarks } = dets[0];
//         const nose = landmarks.getNose();
//         const jaw  = landmarks.getJawOutline();
//         const lEye = landmarks.getLeftEye();
//         const rEye = landmarks.getRightEye();

//         // ── GAZE / HEAD POSE ──────────────────────────────────────────────
//         let gazeHard = false;
//         if (nose?.length && jaw?.length) {
//           const jL = jaw[0].x, jR = jaw[jaw.length-1].x;
//           const jawW = jR - jL;
//           const jawM = (jL + jR) / 2;
//           if (jawW > 20) {
//             const tip = nose[nose.length-1];
//             const hOff = Math.abs(tip.x - jawM) / jawW;
//             let eyeOff = 0;
//             if (lEye?.length && rEye?.length) {
//               const em = (lEye.reduce((s,p)=>s+p.x,0)/lEye.length + rEye.reduce((s,p)=>s+p.x,0)/rEye.length) / 2;
//               eyeOff = Math.abs(em - jawM) / jawW;
//             }
//             gazeHard = hOff > GAZE_HARD || eyeOff > GAZE_HARD;
//           }
//         }
//         if (gazeHard) {
//           setFaceStatus("warn");
//           H.gaze = (H.gaze || 0) + 1;
//           if (H.gaze >= HARD_TICKS) { H.gaze = 0; triggerViolation("no-face"); }
//         } else { H.gaze = 0; }

//         // ── EYES CLOSED ───────────────────────────────────────────────────
//         let eyesHard = false;
//         if (lEye?.length >= 6 && rEye?.length >= 6) {
//           const avgEAR = (earVal(lEye) + earVal(rEye)) / 2;
//           eyesHard = avgEAR < EAR_HARD;
//         }
//         if (eyesHard) {
//           H.eyes = (H.eyes || 0) + 1;
//           if (H.eyes >= HARD_TICKS) { H.eyes = 0; triggerViolation("no-face"); }
//         } else { H.eyes = 0; }

//         // Face OK when all checks pass
//         if (!gazeHard && !eyesHard) setFaceStatus("ok");

//       } catch { /* suppress GPU / model race errors */ }
//     }, TICK_MS);

//     return () => clearInterval(detectionIntervalRef.current);
//   }, [isCallActive, triggerViolation]);


//   // ── Interview info ─────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!interviewInfo) { navigate(`/user/${interview_id}/interview-instruction`); return; }
//     const dur = (parseInt(String(interviewInfo?.duration||"5"),10)||5)*60;
//     setTimeLeft(dur);
//     setIsResumeInterview((interviewInfo?.type||interviewInfo?.examType||"")==="resume-based");
//     maxQuestionsRef.current = parseInt(String(interviewInfo?.numberOfQuestions||"5"),10)||5;
//     setLoading(false);
//   }, [interviewInfo, interview_id, navigate]);

//   useEffect(() => { if(isResumeInterview) fetch(`/api/resumes/${interview_id}`).then(r=>r.json()).then(({data})=>setResumeData(data)).catch(()=>{}); }, [isResumeInterview, interview_id]);
//   useEffect(() => { const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); }, []);
//   useEffect(() => { if(screen==="lobby"||screen==="connecting") return; const t=setInterval(()=>setElapsed(e=>e+1),1000); return ()=>clearInterval(t); }, [screen]);
//   useEffect(() => {
//     if (!isCallActive || timeLeft <= 0) return;
//     const t = setInterval(()=>setTimeLeft(s=>{ if(s<=1){clearInterval(t);endInterviewAndNavigate();return 0;} return s-1; }),1000);
//     return ()=>clearInterval(t);
//   }, [isCallActive, endInterviewAndNavigate]);

//   // ── HeyGen init ────────────────────────────────────────────────────────
//   const initHeyGen = useCallback(async () => {
//     if (avatarMode !== "heygen") return;
//     const svc = new HeyGenService(heygenVideoRef);
//     svc.onStateChange = (speaking) => setAvatarState(speaking?"speaking":"idle");
//     svc.onStreamReady = () => { setHeygenReady(true); setHeygenStreamLive(true); };
//     heygenServiceRef.current = svc;
//     const ok = await svc.init();
//     if (!ok) { console.warn("HeyGen init failed — falling back to animated avatar"); setHeygenStreamLive(true); }
//   }, [avatarMode]);

//   // ── Gan.AI greeting ────────────────────────────────────────────────────
//   const generateGanAiGreeting = useCallback(async (greetingText: string) => {
//     if (avatarMode !== "ganai") return;
//     setGanAiLoading(true);
//     try {
//       const renderId = await ganAi.generate(greetingText);
//       if (!renderId) return;
//       const url = await ganAi.poll(renderId);
//       if (url) setGanAiVideoUrl(url);
//     } catch {} finally { setGanAiLoading(false); }
//   }, [avatarMode]);

//   // ── Vapi setup ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     const instance = new Vapi("e1b6fe14-f22f-4a75-af38-5136766216ec");
//     setVapi(instance);

//     instance.on("speech-start", () => {
//       setIsSpeaking(true);
//       if (avatarMode==="animated"||(avatarMode==="ganai"&&!ganAiVideoUrl)) setAvatarState("speaking");
//     });
//     instance.on("speech-end", () => {
//       setIsSpeaking(false);
//       if (avatarMode !== "heygen") setAvatarState("idle");
//       const text = aiTranscriptBufRef.current.trim();
//       if (text) {
//         setAvatarSub(text);
//         if (avatarMode==="heygen"&&heygenServiceRef.current&&heygenReady) heygenServiceRef.current.speak(text).catch(()=>{});
//         aiTranscriptBufRef.current = "";
//       }
//       // If closing in progress, stop call 3.5 s after AI finishes goodbye speech
//       if (closingInProgressRef.current && isCallActiveRef.current) {
//         closingInProgressRef.current = false;
//         setTimeout(()=>{ try { vapiRef.current?.stop(); } catch {} }, 3500);
//       }
//     });
//     instance.on("call-start", () => { setIsCallActive(true); isCallActiveRef.current = true; setAvatarState("thinking"); setVapiReady(true); });
//     instance.on("error", (e: any) => {
//       const errType = e?.error?.type ?? e?.type ?? "unknown";
//       console.error(`Vapi error [${errType}]:`, e);
//       if (errType==="daily-error"||errType==="connection-error") callEndedByErrorRef.current = true;
//     });
//     instance.on("message", (msg: any) => {
//       if (msg?.type === "transcript") {
//         const text = msg.transcript || msg.text || "";
//         if (msg.role === "assistant") {
//           conversationRef.current.push(msg);
//           aiTranscriptBufRef.current = text;
//           setAvatarSub(text);
//           setAvatarState("thinking");

//           // ── Question counting logic ────────────────────────────────────
//           if (text.includes("?")) {
//             if (!preCheckDoneRef.current) {
//               // Detect when pre-check transitions to interview
//               const lt = text.toLowerCase();
//               if (lt.includes("let's begin")||lt.includes("let's get started")||lt.includes("let's start")||
//                   lt.includes("tell me about yourself")||lt.includes("tell me a little about yourself")||
//                   lt.includes("great, so let's")||lt.includes("perfect, let's")) {
//                 preCheckDoneRef.current = true;
//               }
//               // Don't count questions during pre-check phase
//             } else {
//               // "Tell me about yourself" is a warm-up — does NOT count toward limit
//               const isTMAY = text.toLowerCase().includes("tell me about yourself")||
//                              text.toLowerCase().includes("tell me a little about yourself")||
//                              text.toLowerCase().includes("start by telling me about yourself");
//               if (!isTMAY) {
//                 questionCountRef.current++;
//                 if (!questionLimitReachedRef.current && questionCountRef.current >= maxQuestionsRef.current) {
//                   questionLimitReachedRef.current = true;
//                   setTimeout(()=>{
//                     try {
//                       closingInProgressRef.current = true;
//                       vapiRef.current?.send({ type:"add-message", message:{ role:"system",
//                         content:`[SYSTEM — FINAL]: You have now asked all ${maxQuestionsRef.current} interview questions. This is the LAST thing you will say. Thank the candidate sincerely for their time and thoughtful answers, let them know the interview is now complete, wish them well, and say a warm goodbye. Do NOT ask any more questions.`
//                       } });
//                     } catch {}
//                   }, 500);
//                 }
//               }
//             }
//           }
//         } else if (msg.role === "user") {
//           if (!micOnRef.current) return;
//           conversationRef.current.push(msg);
//           userTranscriptBufRef.current = text;
//           setUserSub(text);
//           setIsListening(true); setAvatarState("idle");
//           lastUserSpeechRef.current = Date.now();
//           silenceWarnedRef.current = false;
//           silenceWarnCountRef.current = 0;
//         }
//       } else { conversationRef.current.push(msg); }
//     });
//     instance.on("user-speech-start", () => {
//       if (!micOnRef.current) return;
//       setIsListening(true);
//       lastUserSpeechRef.current = Date.now();
//       silenceWarnedRef.current = false;
//       silenceWarnCountRef.current = 0;
//     });
//     instance.on("user-speech-end", () => {
//       setIsListening(false);
//       if (!micOnRef.current) return;
//       if (userTranscriptBufRef.current.trim()) { setUserSub(userTranscriptBufRef.current.trim()); userTranscriptBufRef.current = ""; }
//     });
//     return () => { instance.stop(); };
//   }, [avatarMode, heygenReady]);


//   // ── Start call ─────────────────────────────────────────────────────────
//   const startCall = useCallback(() => {
//     if (!vapi || !interviewInfo) return;
//     alertCountRef.current = 0;
//     questionCountRef.current = 0;
//     questionLimitReachedRef.current = false;
//     closingInProgressRef.current = false;
//     preCheckDoneRef.current = false;
//     interviewEndedRef.current = false;
//     hardTicksRef.current = { noface:0, multi:0, gaze:0, eyes:0 };
//     violationLockedRef.current = false;

//     const jobPosition   = interviewInfo?.position || interviewInfo?.jobPosition || "the role";
//     const jobDesc       = interviewInfo?.jobDescription || "";
//     const difficulty    = interviewInfo?.difficulty || "Medium";
//     const skills        = Array.isArray(interviewInfo?.skills) ? interviewInfo.skills.join(", ") : interviewInfo?.skills || "";
//     const numQs         = maxQuestionsRef.current;
//     const candidateName = interviewInfo?.username || interviewInfo?.candidateName || "Candidate";

//     // ── Professional system prompt with pre-check + TMAY warm-up ──────────
//     const PRECHECK = `
// PHASE 1 — AUDIO & VIDEO PRE-CHECK (do this FIRST, before any interview questions):
// - Greet the candidate warmly by name.
// - Ask: "Can you hear me clearly? Is your audio and video working fine on your end?"
// - If yes/confirmed: say "Perfect, great to hear that. Let's get started with the interview." then move to PHASE 2.
// - If no/issues: help them troubleshoot patiently.
// - This pre-check does NOT count as an interview question.`;

//     const INTERVIEW_RULES = `
// PHASE 2 — INTERVIEW (begin only after pre-check confirmation):
// - You are a senior ${difficulty}-level interviewer. Be professional, warm, and conversational — like a real human, not a robot.
// - Ask ONE question at a time. Wait for a complete answer before moving on.
// - Your very first interview question MUST be: "Great, so let's begin. Could you start by telling me a little about yourself?"
// - "Tell me about yourself" does NOT count toward the ${numQs} question limit. It is a warm-up only.
// - After "tell me about yourself", ask exactly ${numQs} interview questions. These are the actual assessment.
// - Probe naturally if vague ("Could you elaborate?" "Can you give an example?") — probes do NOT count as questions.
// - Acknowledge answers briefly before moving on ("That's interesting.", "Good point.", "Thank you for sharing that.").
// - Do NOT number questions out loud. Keep it natural and conversational.
// - Do NOT say "Question 1:" or "Moving to question 3" — just ask naturally.
// - After all ${numQs} questions are answered, thank the candidate genuinely, confirm the interview is complete, and say a warm goodbye.`;

//     let systemContent = "", firstMessage = "";
//     if (isResumeInterview) {
//       systemContent = `You are a senior AI interviewer conducting a real job interview.
// CANDIDATE RESUME:\n${resumeData?.resumeText||"Not provided"}
// ROLE: ${jobPosition}
// ${PRECHECK}
// ${INTERVIEW_RULES}`;
//       firstMessage = `Hello ${candidateName}! I'm your AI interviewer today for the ${jobPosition} position. It's great to have you here.`;
//     } else {
//       let qList: string[] = [];
//       try {
//         const raw = interviewInfo?.questions ?? interviewInfo?.questionList;
//         if (Array.isArray(raw) && raw.length) qList = raw.map((x:any)=>(typeof x==="string"?x:x?.question)).filter(Boolean);
//         if (!qList.length && typeof raw==="string") qList = (JSON.parse(raw)||[]).map((x:any)=>(typeof x==="string"?x:x?.question)).filter(Boolean);
//       } catch {}
//       const filteredQList = qList.filter(q=>!q.toLowerCase().includes("tell me about yourself")).slice(0, numQs);
//       const questionBlock = filteredQList.length
//         ? `INTERVIEW QUESTIONS (ask these in order after "tell me about yourself"):\n${filteredQList.map((q,i)=>`${i+1}. ${q}`).join("\n")}`
//         : `Generate ${numQs} professional interview questions for the role.\nROLE: ${jobPosition}\nJOB DESCRIPTION: ${jobDesc}\nKEY SKILLS: ${skills}\nDIFFICULTY: ${difficulty}`;
//       systemContent = `You are a senior AI interviewer conducting a professional job interview.
// ROLE BEING INTERVIEWED FOR: ${jobPosition}
// ${questionBlock}
// ${PRECHECK}
// ${INTERVIEW_RULES}`;
//       firstMessage = `Hello ${userData?.name||userData?.firstName||userData?.username||candidateName}! Welcome, and thank you for joining today. I'm your AI interviewer for the ${jobPosition} position.`;
//     }

//     if (avatarMode === "heygen") initHeyGen();
//     if (avatarMode === "ganai") generateGanAiGreeting(firstMessage);

//     vapi.start({
//       name: "AI Recruiter",
//       firstMessage,
//       transcriber: null,
//       voice: { provider:"vapi", voiceId:"Neha", speed:0.92, fillerInjectionEnabled:false },
//       model: { provider:"openai", model:"gpt-4-turbo", messages:[{ role:"system", content:systemContent }], temperature:0.65, maxTokens:420 },
//       endCallMessage: "Thank you so much for your time. Best of luck — we'll be in touch soon!",
//     });
//   }, [vapi, interviewInfo, isResumeInterview, resumeData, userData, avatarMode, initHeyGen, generateGanAiGreeting]);

//   const handleBothReady = useCallback(() => { startSilenceMonitor(); setScreen("spotlight"); }, [startSilenceMonitor]);

//   // ── Feedback ───────────────────────────────────────────────────────────
//   const generateFeedback = useCallback(async () => {
//     setIsGeneratingFeedback(true);
//     try {
//       const conversation = conversationRef.current;
//       if (!conversation.length) { navigate(`/user/${interview_id}/assessment-complete`); return; }
//       const transcript = conversation.filter(m=>m?.type==="transcript"&&(m.role==="assistant"||m.role==="user"))
//         .map(m=>({ role:m.role==="assistant"?"Interviewer":"Candidate", text:m.transcript||m.text||"" }))
//         .filter(m=>m.text.trim());
//       const r = await fetch("http://localhost:3000/api/ai-feedback", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ conversation, transcript }) });
//       const data = await r.json();
//       const raw = (data?.content||data?.feedback||"").replace(/```json|```/g,"").trim();
//       if (raw) {
//         let parsed: any = {};
//         try { parsed = JSON.parse(raw); } catch {}
//         await userService.generateFeedback({ interview_id, userName:userData?.name, userEmail:userData?.email, feedback:parsed, transcript, behaviorReport:behaviorTrackerRef.current.getReport(), completedAt:new Date().toISOString() });
//       }
//     } catch (e) { console.error("Feedback error:", e); }
//     finally { setIsGeneratingFeedback(false); navigate(`/user/${interview_id}/assessment-complete`); }
//   }, [interview_id, navigate, userData]);

//   useEffect(() => {
//     if (!vapi) return;
//     const h = () => {
//       const hasRealConversation = conversationRef.current.filter(m=>m?.type==="transcript"&&(m.role==="assistant"||m.role==="user")).length >= 2;
//       setIsCallActive(false); isCallActiveRef.current = false;
//       setIsSpeaking(false); setAvatarState("idle");
//       if (!hasRealConversation) {
//         console.warn("Call ended with no conversation — returning to lobby");
//         setScreen("lobby"); setVapiReady(false); setHeygenStreamLive(false); setHeygenReady(false); setElapsed(0);
//         return;
//       }
//       generateFeedback();
//     };
//     vapi.on("call-end", h);
//     return () => vapi.off("call-end", h);
//   }, [vapi, generateFeedback]);

//   // ── Controls ───────────────────────────────────────────────────────────
//   const handleJoin = () => { tryEnterFS(); setScreen("connecting"); startCall(); };
//   const handleEndCall = () => {
//     setIsCallActive(false);
//     if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
//     try { vapi?.stop(); } catch {}
//     tryExitFS();
//     setScreen("lobby"); setElapsed(0); setVapiReady(false); setHeygenStreamLive(false); setHeygenReady(false);
//   };
//   const toggleMic = () => {
//     const n = !micOn;
//     streamRef.current?.getAudioTracks().forEach(t=>{ t.enabled=n; });
//     micOnRef.current = n; setMicOn(n);
//     if (!n) userTranscriptBufRef.current = "";
//   };
//   const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t=>{ t.enabled=!camOn; }); setCamOn(v=>!v); };

//   const fmt  = (s:number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
//   const fmtL = (s:number) => isNaN(s)||s<0?"00:00":`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
//   const fmtC = (d:Date)   => { let h=d.getHours(),m=d.getMinutes(); const ap=h>=12?"PM":"AM"; h=h%12||12; return `${h}:${String(m).padStart(2,"0")} ${ap}`; };
//   const fmtD = (d:Date)   => d.toLocaleDateString("en-US",{ weekday:"short", month:"short", day:"numeric" });

//   const faceStatusColor = faceStatus==="ok" ? "#22c55e" : faceStatus==="warn" ? "#ef4444" : "#4b5563";
//   const faceStatusLabel = faceStatus==="ok" ? "OK" : faceStatus==="warn" ? "!" : "…";

//   if (loading||!interviewInfo) return (<div className="h-screen bg-[#050A24] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#2D55FB]"/><span className="ml-3 text-white text-lg">Preparing Interview...</span></div>);
//   if (isGeneratingFeedback) return (<div className="h-screen bg-[#050A24] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin h-12 w-12 text-[#2D55FB]"/><h2 className="text-white text-xl font-bold">Generating Your Feedback...</h2><p className="text-white/40 text-sm">Please wait while our AI analyzes your performance</p></div>);

//   const username = userData?.name || "You";
//   const avatarProps: AvatarTileProps = { mode:avatarMode, state:avatarState, heygenVideoRef, ganAiVideoUrl, ganAiLoading, heygenReady };


//   // ── Bottom bar ─────────────────────────────────────────────────────────
//   const BottomBar = () => (
//     <div className="shrink-0 bg-[#070e2b] border-t border-white/5 px-5 sm:px-8 py-3.5 flex items-center justify-between">
//       <div className="flex items-center gap-2 sm:gap-3 min-w-0">
//         <span className="text-white/40 text-sm font-medium whitespace-nowrap">{interviewInfo?.position||interviewInfo?.jobPosition||"Interview"}</span>
//         <div className="w-px h-5 bg-white/15"/>
//         <span className={`font-bold text-sm whitespace-nowrap ${timeLeft<60?"text-red-400 animate-pulse":"text-[#2D55FB]"}`}>⏱ {fmtL(timeLeft)}</span>
//         {maxQuestionsRef.current > 0 && preCheckDoneRef.current && (
//           <><div className="w-px h-5 bg-white/15"/><span className="text-white/40 text-xs whitespace-nowrap">Q {Math.min(questionCountRef.current,maxQuestionsRef.current)}/{maxQuestionsRef.current}</span></>
//         )}
//       </div>
//       <div className="flex items-center gap-2 sm:gap-3">
//         <CtrlBtn onClick={toggleMic} active={micOn}>{micOn?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}</CtrlBtn>
//         <CtrlBtn onClick={toggleCam} active={camOn}>{camOn?<Video className="h-4 w-4"/>:<VideoOff className="h-4 w-4"/>}</CtrlBtn>
//         <CtrlBtn><MonitorUp className="h-4 w-4 text-gray-800"/></CtrlBtn>
//         <CtrlBtn onClick={handleEndCall} danger><PhoneOff className="h-4 w-4"/></CtrlBtn>
//       </div>
//       <div className="min-w-[80px] sm:min-w-[120px] flex flex-col items-end gap-1">
//         <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${isFullscreen?"bg-green-500/10 border-green-500/30 text-green-400":"bg-red-500/15 border-red-500/30 text-red-400 animate-pulse"}`}>
//           <Maximize className="w-2.5 h-2.5"/>{isFullscreen?"Fullscreen":"Not FS!"}
//         </div>
//         {noFaceWarning && <span className="text-red-400 text-[10px] font-bold animate-pulse">⚠ No face</span>}
//         {!noFaceWarning && alertCountRef.current > 0 && <span className="text-orange-400 text-[10px] font-bold">{alertCountRef.current}/3 warns</span>}
//       </div>
//     </div>
//   );

//   // ── Global overlays (violation modal + banners + proctoring PiP) ───────
//   // The PiP camera monitor is identical to MCQAssessment's bottom-right widget
//   const GlobalOverlays = () => (
//     <>
//       <AnimatePresence>{activeAlert && <ViolationModal alert={activeAlert} onClose={handleAlertClose}/>}</AnimatePresence>
//       <AnimatePresence>{noiseWarning && screen!=="lobby" && screen!=="connecting" && (<NoiseBanner onDismiss={()=>setNoiseWarning(false)}/>)}</AnimatePresence>
//       <AnimatePresence>{showFSBanner && screen!=="lobby" && screen!=="connecting" && !activeAlert && (<FullscreenBanner onDismiss={()=>{ tryEnterFS(); setShowFSBanner(false); }}/>)}</AnimatePresence>

//       {/* ── Proctoring PiP — shown during interview (mirrors MCQAssessment) ── */}
//       {isCallActive && (
//         <div className="fixed bottom-20 right-3 z-40 flex flex-col items-end gap-1.5">
//           {alertCountRef.current > 0 && (
//             <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/40 rounded-full">
//               <ShieldAlert className="w-3 h-3 text-red-400"/>
//               <span className="text-red-400 text-xs font-semibold">{alertCountRef.current}/{MAX_VIOLATIONS} warns</span>
//             </div>
//           )}
//           <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${isFullscreen?"bg-green-500/10 border-green-500/30 text-green-400":"bg-red-500/15 border-red-500/30 text-red-400 animate-pulse"}`}>
//             <Maximize className="w-2.5 h-2.5"/>{isFullscreen?"Fullscreen":"Not Fullscreen!"}
//           </div>
//           {/* Live camera PiP with face-status border */}
//           <div className="relative w-24 h-16 rounded-xl overflow-hidden border-2 shadow-xl" style={{ borderColor:faceStatusColor }}>
//             <video
//               ref={el=>{ if(el&&streamRef.current&&!el.srcObject) el.srcObject=streamRef.current; }}
//               autoPlay muted playsInline
//               className="w-full h-full object-cover scale-x-[-1]"
//             />
//             <div className="absolute top-1 left-1 flex items-center gap-0.5">
//               <motion.div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:faceStatusColor }} animate={{ opacity:[1,0.4,1] }} transition={{ duration:1.5, repeat:Infinity }}/>
//               <span className="text-white text-[8px] bg-black/50 px-1 rounded font-medium">{faceStatusLabel}</span>
//             </div>
//             <span className="absolute bottom-0.5 right-1 text-[8px] text-white/50">Proctored</span>
//           </div>
//         </div>
//       )}
//     </>
//   );

//   // ══════════════════════════════════════════════════════════════════════
//   // LOBBY
//   // ══════════════════════════════════════════════════════════════════════
//   if (screen === "lobby") return (
//     <div className="h-screen bg-[#050A24] bg-[radial-gradient(ellipse_at_65%_0%,rgba(45,85,251,0.4),transparent_60%),radial-gradient(ellipse_at_0%_100%,rgba(20,40,120,0.4),transparent_60%)] flex flex-col overflow-hidden">
//       <video ref={behaviorVidRef} muted playsInline className="hidden"/>
//       <div className="flex items-center justify-between px-6 sm:px-10 py-5 shrink-0">
//         <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">Vitric IQ</h1>
//         <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
//           <span>{fmtC(now)}</span><span className="text-white/20 mx-1">|</span><span>{fmtD(now)}</span>
//         </div>
//       </div>
//       <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 pb-10">
//         <motion.div className="relative w-full max-w-sm sm:max-w-md lg:max-w-xl xl:max-w-2xl bg-[#0a1035] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50" style={{ aspectRatio:"16/9" }} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.55 }}>
//           <video ref={lobbyVidRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn&&streamReady?"opacity-100":"opacity-0"}`} style={{ transform:"scaleX(-1)" }}/>
//           {(!camOn||!streamReady) && (
//             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e] to-[#050A24] gap-3">
//               <div className="w-20 h-20 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center">
//                 {streamReady?<VideoOff className="h-10 w-10 text-[#2D55FB]/60"/>:<User className="h-10 w-10 text-[#2D55FB]/50"/>}
//               </div>
//               <span className="text-white/30 text-sm">{streamReady?"Camera off":"Waiting for camera…"}</span>
//             </div>
//           )}
//           <div className="absolute bottom-4 left-4 flex items-center gap-3">
//             <motion.button onClick={toggleMic} whileTap={{ scale:0.9 }} className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur transition-all ${micOn?"bg-white/15 border-white/25 text-white hover:bg-white/25":"bg-red-500 border-red-400 text-white"}`}>{micOn?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}</motion.button>
//             <motion.button onClick={toggleCam} whileTap={{ scale:0.9 }} className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur transition-all ${camOn?"bg-white/15 border-white/25 text-white hover:bg-white/25":"bg-red-500 border-red-400 text-white"}`}>{camOn?<Video className="h-4 w-4"/>:<VideoOff className="h-4 w-4"/>}</motion.button>
//           </div>
//         </motion.div>
//         <motion.div className="flex flex-col items-center gap-5" initial={{ opacity:0, x:28 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.55, delay:0.2 }}>
//           <h2 className="text-white text-2xl sm:text-3xl font-semibold">Ready to Join?</h2>
//           <p className="text-white/40 text-sm text-center max-w-xs">{interviewInfo?.position||interviewInfo?.jobPosition||"Interview"} • {interviewInfo?.duration||"N/A"}</p>
//           <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl max-w-xs border ${USE_HEYGEN?"bg-green-500/10 border-green-500/25":USE_GANAI?"bg-purple-500/10 border-purple-500/25":"bg-[#2D55FB]/10 border-[#2D55FB]/25"}`}>
//             <div className={`w-2 h-2 rounded-full ${USE_HEYGEN?"bg-green-400":USE_GANAI?"bg-purple-400":"bg-[#2D55FB]/60"}`}/>
//             <span className="text-white/50 text-xs">{USE_HEYGEN?"Photorealistic avatar via HeyGen Streaming":USE_GANAI?"Avatar intro via Gan.AI + animated live":"Animated AI avatar"}</span>
//           </div>
//           <div className="flex items-center gap-2 px-3.5 py-2 bg-[#2D55FB]/10 border border-[#2D55FB]/25 rounded-xl max-w-xs">
//             <Maximize className="h-3.5 w-3.5 text-[#2D55FB]/70 shrink-0"/>
//             <span className="text-white/50 text-xs">Interview will run in fullscreen mode</span>
//           </div>
//           <div className="flex items-center">
//             <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 border-2 border-[#2D55FB] flex items-center justify-center shadow-lg"><User className="h-6 w-6 text-white/80"/></div>
//             <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-orange-400 flex items-center justify-center -ml-3 shadow-lg"><User className="h-6 w-6 text-white/80"/></div>
//           </div>
//           <p className="text-white/50 text-sm -mt-2">{username} and AI Recruiter</p>
//           <motion.button onClick={handleJoin} whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }} className="px-10 py-3 bg-[#2D55FB] hover:bg-[#1e3fd4] text-white font-semibold rounded-xl transition-colors shadow-lg shadow-[#2D55FB]/30">Join Interview</motion.button>
//         </motion.div>
//       </div>
//     </div>
//   );

//   // ══════════════════════════════════════════════════════════════════════
//   // CONNECTING GATE
//   // ══════════════════════════════════════════════════════════════════════
//   if (screen === "connecting") return (
//     <>
//       <video ref={behaviorVidRef} muted playsInline className="hidden"/>
//       <ConnectingScreen heygenReady={heygenStreamLive} vapiReady={vapiReady} avatarMode={avatarMode} onBothReady={handleBothReady}/>
//     </>
//   );


//   // ══════════════════════════════════════════════════════════════════════
//   // SPOTLIGHT
//   // ══════════════════════════════════════════════════════════════════════
//   if (screen === "spotlight") return (
//     <div className="h-screen bg-[#070e2b] flex flex-col overflow-hidden relative">
//       <video ref={behaviorVidRef} muted playsInline className="hidden"/>
//       <GlobalOverlays/>
//       <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#070e2b] shrink-0">
//         <div className="flex items-center gap-2">
//           <span className="text-white/40 text-sm">Time :</span>
//           <span className="text-[#2D55FB] font-mono font-bold text-sm tracking-widest">{fmt(elapsed)}</span>
//           {isCallActive && (<div className="flex items-center gap-1.5 ml-3 text-green-400 text-xs font-bold"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>LIVE</div>)}
//         </div>
//         <motion.button onClick={()=>setScreen("grid")} whileTap={{ scale:0.94 }} className="flex items-center gap-2 text-white/60 hover:text-white text-xs font-medium transition-colors">
//           Grid View<div className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><LayoutGrid className="h-4 w-4 text-white"/></div>
//         </motion.button>
//       </div>
//       <div className="flex flex-1 min-h-0 gap-2.5 px-2.5 pb-2 pt-1">
//         <div className="w-44 sm:w-52 shrink-0 flex flex-col gap-2">
//           <div className="relative rounded-xl overflow-hidden bg-[#0d1535] border border-white/5 shrink-0" style={{ aspectRatio:"4/3" }}>
//             <UserVideo camOn={camOn} streamReady={streamReady} username={username} onVideoMount={onSpotlightVideoMount}/>
//             <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"/>
//             <div className="absolute bottom-2 left-2.5 z-10"><span className="text-white text-xs font-semibold drop-shadow">{username}</span></div>
//             <div className="absolute bottom-2 right-2.5 z-10"><MicCircle muted={!micOn}/></div>
//           </div>
//           <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
//             <div className="bg-[#0e1640]/90 rounded-xl p-3 border border-white/5">
//               <div className="flex items-center justify-between mb-1.5">
//                 <span className="text-[#7a9cff] text-[11px] font-semibold">AI Recruiter:</span>
//                 {isSpeaking && <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"/>}
//               </div>
//               <p className="text-gray-300 text-[11px] leading-relaxed">{avatarSub}</p>
//             </div>
//             <div className="bg-[#0e1640]/90 rounded-xl p-3 border border-white/5">
//               <div className="flex items-center justify-between mb-1.5">
//                 <span className="text-[#7a9cff] text-[11px] font-semibold">You:</span>
//                 {isListening && micOn && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"/>}
//                 {!micOn && <span className="text-red-400/70 text-[9px] font-bold">MIC OFF</span>}
//               </div>
//               <p className="text-gray-300 text-[11px] leading-relaxed">{micOn?userSub:"Microphone is muted."}</p>
//             </div>
//           </div>
//         </div>
//         <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
//           <AvatarTile {...avatarProps}/>
//           <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"/>
//           <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"><AudioWave active={isSpeaking}/></div>
//           <div className="absolute bottom-4 left-5 z-10"><span className="text-white font-medium text-sm">AI Recruiter</span></div>
//           {isCallActive && (<div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-bold z-10"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>REC</div>)}
//         </div>
//       </div>
//       <BottomBar/>
//     </div>
//   );

//   // ══════════════════════════════════════════════════════════════════════
//   // GRID
//   // ══════════════════════════════════════════════════════════════════════
//   return (
//     <div className="h-screen bg-[#070e2b] flex flex-col overflow-hidden relative">
//       <video ref={behaviorVidRef} muted playsInline className="hidden"/>
//       <GlobalOverlays/>
//       <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#070e2b] shrink-0">
//         <div className="flex items-center gap-2">
//           <span className="text-white/40 text-sm">Time :</span>
//           <span className="text-[#2D55FB] font-mono font-bold text-sm tracking-widest">{fmt(elapsed)}</span>
//           {isCallActive && (<div className="flex items-center gap-1.5 ml-3 text-green-400 text-xs font-bold"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>LIVE</div>)}
//         </div>
//         <motion.button onClick={()=>setScreen("spotlight")} whileTap={{ scale:0.94 }} className="flex items-center gap-2 text-white/80 hover:text-white text-xs font-medium transition-colors">
//           Spotlight View<div className="w-7 h-7 rounded-lg bg-[#2D55FB] flex items-center justify-center shadow-md shadow-[#2D55FB]/30"><LayoutGrid className="h-4 w-4 text-white"/></div>
//         </motion.button>
//       </div>
//       <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-2 pb-1 gap-0">
//         <div className="flex gap-4 sm:gap-5" style={{ flex:"0 0 auto", height:"clamp(200px, 58vh, 420px)" }}>
//           <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
//             <video ref={onGridUserVideoMount} muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${camOn&&streamReady?"opacity-100":"opacity-0"}`} style={{ transform:"scaleX(-1)" }}/>
//             {(!camOn||!streamReady) && (
//               <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a2a5e]/80 to-[#060c25]/80">
//                 <div className="w-14 h-14 rounded-full bg-[#2D55FB]/20 border border-[#2D55FB]/30 flex items-center justify-center mb-2">
//                   {streamReady?<VideoOff className="h-7 w-7 text-[#2D55FB]/60"/>:<User className="h-7 w-7 text-[#2D55FB]/50"/>}
//                 </div>
//               </div>
//             )}
//             <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none"/>
//             <div className="absolute bottom-12 right-3 z-10"><MicCircle muted={!micOn}/></div>
//             <div className="absolute bottom-4 left-4 z-10"><span className="text-white font-semibold text-base drop-shadow">{username}</span></div>
//             {isListening && micOn && (<div className="absolute top-4 left-4 z-10"><div className="flex items-center gap-1.5 bg-blue-600/80 text-white px-2 py-1 rounded-full text-xs font-bold"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>Speaking</div></div>)}
//           </div>
//           <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0d1535] border border-white/5">
//             <AvatarTile {...avatarProps}/>
//             <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none"/>
//             <div className="absolute bottom-12 right-3 z-10"><AudioWave active={isSpeaking}/></div>
//             <div className="absolute bottom-4 left-4 z-10"><span className="text-white font-semibold text-base drop-shadow">AI Recruiter</span></div>
//             {isSpeaking && (<div className="absolute top-4 left-4 z-10"><div className="flex items-center gap-1.5 bg-green-600/80 text-white px-2 py-1 rounded-full text-xs font-bold"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>Speaking</div></div>)}
//           </div>
//         </div>
//         <div className="flex gap-4 sm:gap-5 mt-3" style={{ flex:"0 0 auto" }}>
//           <div className="flex-1 flex items-start justify-center"><p className="text-white/65 text-sm text-center leading-snug max-w-xs">{micOn?userSub:"🎤 Mic is muted"}</p></div>
//           <div className="flex-1 flex items-start justify-center"><p className="text-white/65 text-sm text-center leading-snug max-w-xs">{avatarSub}</p></div>
//         </div>
//         <div className="flex-1"/>
//       </div>
//       <BottomBar/>
//     </div>
//   );
// };

// export default VideoInterview;