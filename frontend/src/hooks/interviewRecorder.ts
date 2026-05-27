

// import { useRef, useState, useCallback } from "react";
// import { Base_Url } from "../utils/constants";

// type ScreenRecorderStatus = "idle" | "recording" | "stopped" | "error";

// interface UseScreenRecorderOptions {
//   interview_id: string;
//   candidateId: string;
//   /** streamRef.current from VideoInterview — the getUserMedia webcam+mic stream */
//   micStream: MediaStream | null;
//   chunkIntervalMs?: number;
//   onChunkUploaded?: (chunkIndex: number) => void;
//   onError?: (err: Error) => void;
// }

// interface UseScreenRecorderReturn {
//   start: () => Promise<void>;
//   stop: () => Promise<void>;
//   status: ScreenRecorderStatus;
//   sessionId: string;
//   chunksUploaded: number;
// }

// // ─── MIME ────────────────────────────────────────────────────────────────────
// function getSupportedMime(): string {
//   const candidates = [
//     "video/webm;codecs=vp9,opus",
//     "video/webm;codecs=vp8,opus",
//     "video/webm;codecs=h264,opus",
//     "video/webm",
//   ];
//   return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
// }

// // ─── Find Vapi's audio element (polls DOM until found or timeout) ─────────────
// // Vapi injects a hidden <audio> element with a MediaStream as srcObject.
// // We need this to clone its audio tracks WITHOUT hijacking playback.
// function findVapiAudioElement(timeoutMs = 8000): Promise<HTMLAudioElement | null> {
//   return new Promise((resolve) => {
//     const deadline = Date.now() + timeoutMs;

//     const check = () => {
//       const audios = Array.from(document.querySelectorAll("audio"));

//       // Find the one Vapi uses: has a srcObject that is a MediaStream with audio tracks
//       const vapiEl = audios.find((a) => {
//         if (!(a.srcObject instanceof MediaStream)) return false;
//         return (a.srcObject as MediaStream).getAudioTracks().length > 0;
//       });

//       if (vapiEl) {
//         console.log("[ScreenRecorder] Found Vapi <audio> element with MediaStream srcObject");
//         resolve(vapiEl);
//         return;
//       }

//       if (Date.now() >= deadline) {
//         console.warn("[ScreenRecorder] Vapi <audio> element not found — AI voice won't be recorded");
//         resolve(null);
//         return;
//       }

//       setTimeout(check, 250);
//     };

//     check();
//   });
// }

// // ─── Hook ────────────────────────────────────────────────────────────────────
// export function useScreenRecorder({
//   interview_id,
//   candidateId,
//   micStream,
//   chunkIntervalMs = 30_000,
//   onChunkUploaded,
//   onError,
// }: UseScreenRecorderOptions): UseScreenRecorderReturn {
//   const [status, setStatus] = useState<ScreenRecorderStatus>("idle");
//   const [chunksUploaded, setChunksUploaded] = useState(0);

//   const sessionIdRef     = useRef<string>("");
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const screenStreamRef  = useRef<MediaStream | null>(null);
//   const audioCtxRef      = useRef<AudioContext | null>(null);
//   const chunkIndexRef    = useRef(0);
//   const isStoppingRef    = useRef(false);

//   // ── Upload chunk ──────────────────────────────────────────────────────────
//   const uploadChunk = useCallback(
//     async (blob: Blob, chunkIndex: number, isFinal: boolean) => {
//       if (blob.size === 0) return;

//       const form = new FormData();
//       form.append("chunk", blob, `chunk_${chunkIndex}.webm`);
//       form.append("interview_id", interview_id);
//       form.append("candidate_id", candidateId);
//       form.append("session_id", sessionIdRef.current);
//       form.append("chunk_index", String(chunkIndex));
//       form.append("is_final", isFinal ? "true" : "false");
//       form.append("mime_type", blob.type || "video/webm");

//       try {
//         const res = await fetch(`${Base_Url}/candidate/interview-recording-chunk`, {
//           method: "POST",
//           body: form,
//         });
//         if (!res.ok) {
//           console.error(`[ScreenRecorder] chunk ${chunkIndex} upload failed:`, res.status);
//           return;
//         }
//         setChunksUploaded((n) => n + 1);
//         onChunkUploaded?.(chunkIndex);
//         console.log(
//           `[ScreenRecorder] ✓ chunk ${chunkIndex} (${Math.round(blob.size / 1024)} KB)${isFinal ? " [FINAL]" : ""}`,
//         );
//       } catch (err) {
//         console.error(`[ScreenRecorder] chunk ${chunkIndex} error:`, err);
//         onError?.(err as Error);
//       }
//     },
//     [interview_id, candidateId, onChunkUploaded, onError],
//   );

//   // ── Cleanup ───────────────────────────────────────────────────────────────
//   const cleanup = useCallback(() => {
//     screenStreamRef.current?.getTracks().forEach((t) => t.stop());
//     screenStreamRef.current = null;
//     try { audioCtxRef.current?.close(); } catch (_) {}
//     audioCtxRef.current  = null;
//     mediaRecorderRef.current = null;
//   }, []);

//   // ── Start ─────────────────────────────────────────────────────────────────
//   const start = useCallback(async (): Promise<void> => {
//     if (mediaRecorderRef.current) {
//       console.warn("[ScreenRecorder] Already recording");
//       return;
//     }

//     // ── Step 1: Screen video (no audio from getDisplayMedia) ─────────────────
//     let screenStream: MediaStream;
//     try {
//       screenStream = await navigator.mediaDevices.getDisplayMedia({
//         video: {
//           frameRate: { ideal: 15, max: 30 },
//           width:  { ideal: 1280 },
//           height: { ideal: 720 },
//         },
//         audio: false, // ← deliberately false; we build audio ourselves
//       });
//     } catch (err) {
//       console.warn("[ScreenRecorder] getDisplayMedia denied/cancelled:", err);
//       setStatus("error");
//       onError?.(err as Error);
//       return;
//     }

//     screenStreamRef.current = screenStream;

//     // ── Step 2: Build mixed audio (mic + AI) ──────────────────────────────────
//     let mixedAudioTrack: MediaStreamTrack | null = null;

//     try {
//       const audioCtx = new AudioContext();
//       audioCtxRef.current = audioCtx;
//       const dest = audioCtx.createMediaStreamDestination();

//       // 2a. Mic — createMediaStreamSource is safe; does NOT affect playback
//       if (micStream && micStream.getAudioTracks().length > 0) {
//         const micSource = audioCtx.createMediaStreamSource(micStream);
//         micSource.connect(dest);
//         console.log("[ScreenRecorder] ✓ Mic connected");
//       }

//       // 2b. Vapi AI audio — find its <audio> element and clone its MediaStream
//       //     Cloning tracks is NON-DESTRUCTIVE: the original element keeps playing.
//       const vapiAudioEl = await findVapiAudioElement(8000);

//       if (vapiAudioEl && vapiAudioEl.srcObject instanceof MediaStream) {
//         const vapiStream = vapiAudioEl.srcObject as MediaStream;

//         // Clone each audio track — the clone can be used in a new MediaStream
//         // without affecting the original stream's playback at all.
//         const clonedTracks = vapiStream.getAudioTracks().map((t) => t.clone());

//         if (clonedTracks.length > 0) {
//           // Wrap clones in a new MediaStream so AudioContext can source it
//           const clonedStream = new MediaStream(clonedTracks);
//           const aiSource = audioCtx.createMediaStreamSource(clonedStream);
//           aiSource.connect(dest);
//           console.log(
//             `[ScreenRecorder] ✓ Vapi AI audio cloned & connected (${clonedTracks.length} track(s))`,
//           );
//         }
//       } else if (vapiAudioEl) {
//         console.warn("[ScreenRecorder] Vapi audio element has no MediaStream srcObject");
//       }

//       mixedAudioTrack = dest.stream.getAudioTracks()[0] ?? null;

//       console.log(
//         "[ScreenRecorder] Audio mix ready:",
//         mixedAudioTrack ? "1 mixed track" : "no audio track",
//       );
//     } catch (err) {
//       console.warn("[ScreenRecorder] Audio mix failed, recording video-only:", err);
//     }

//     // ── Step 3: Combine screen video + mixed audio ─────────────────────────
//     const combined = new MediaStream();
//     screenStream.getVideoTracks().forEach((t) => combined.addTrack(t));
//     if (mixedAudioTrack) combined.addTrack(mixedAudioTrack);

//     // ── Step 4: Session init ──────────────────────────────────────────────
//     sessionIdRef.current  = `screen_${interview_id}_${candidateId}_${Date.now()}`;
//     chunkIndexRef.current = 0;
//     isStoppingRef.current = false;

//     const mimeType = getSupportedMime();
//     console.log(
//       `[ScreenRecorder] Starting | session=${sessionIdRef.current}`,
//       `| mime=${mimeType}`,
//       `| videoTracks=${combined.getVideoTracks().length}`,
//       `| audioTracks=${combined.getAudioTracks().length}`,
//     );

//     // ── Step 5: MediaRecorder ─────────────────────────────────────────────
//     let recorder: MediaRecorder;
//     try {
//       recorder = new MediaRecorder(combined, {
//         mimeType,
//         videoBitsPerSecond: 800_000,
//         audioBitsPerSecond: 128_000,
//       });
//     } catch (err) {
//       console.error("[ScreenRecorder] MediaRecorder init failed:", err);
//       cleanup();
//       setStatus("error");
//       onError?.(err as Error);
//       return;
//     }

//     recorder.ondataavailable = (event: BlobEvent) => {
//       if (event.data.size === 0) return;
//       const isFinal = isStoppingRef.current;
//       const idx     = chunkIndexRef.current++;
//       uploadChunk(event.data, idx, isFinal);
//     };

//     recorder.onerror = () => {
//       setStatus("error");
//       onError?.(new Error("MediaRecorder error"));
//     };

//     recorder.onstart = () => {
//       setStatus("recording");
//       console.log("[ScreenRecorder] ✓ Recording started");
//     };

//     recorder.onstop = () => {
//       console.log("[ScreenRecorder] Stopped — cleaning up");
//       cleanup();
//       setStatus("stopped");
//     };

//     // Handle user clicking browser's native "Stop sharing" button
//     screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
//       const rec = mediaRecorderRef.current;
//       if (rec && rec.state !== "inactive") {
//         isStoppingRef.current = true;
//         rec.requestData();
//         rec.stop();
//       }
//     });

//     recorder.start(chunkIntervalMs);
//     mediaRecorderRef.current = recorder;
//   }, [interview_id, candidateId, micStream, chunkIntervalMs, uploadChunk, onError, cleanup]);

//   // ── Stop ──────────────────────────────────────────────────────────────────
//   const stop = useCallback(async (): Promise<void> => {
//     const recorder = mediaRecorderRef.current;
//     if (!recorder || recorder.state === "inactive") return;

//     return new Promise<void>((resolve) => {
//       isStoppingRef.current = true;

//       const originalOnStop = recorder.onstop;
//       recorder.onstop = (event) => {
//         if (typeof originalOnStop === "function") {
//           originalOnStop.call(recorder, event);
//         }
//         resolve();
//       };

//       recorder.requestData(); // flush final chunk
//       recorder.stop();
//       console.log("[ScreenRecorder] Stop requested — flushing final chunk…");
//     });
//   }, []);

//   return { start, stop, status, sessionId: sessionIdRef.current, chunksUploaded };
// }


// useScreenRecorder.ts
//
// FIX: On stop(), we immediately set a hard "dead" flag that blocks ALL
// further uploads. The MediaRecorder may still fire ondataavailable once
// after stop() (the final flush) — we send that one final chunk with
// is_final=true, then the flag cuts off everything permanently.

import { useRef, useState, useCallback } from "react";
import { Base_Url } from "../utils/constants";

type ScreenRecorderStatus = "idle" | "recording" | "stopped" | "error";

interface UseScreenRecorderOptions {
  interview_id: string;
  candidateId: string;
  getMicStream: () => MediaStream | null;
  chunkIntervalMs?: number;
  onChunkUploaded?: (chunkIndex: number) => void;
  onError?: (err: Error) => void;
}

interface UseScreenRecorderReturn {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  status: ScreenRecorderStatus;
  sessionId: string;
  chunksUploaded: number;
}

function getSupportedMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
}

function findVapiAudioElement(timeoutMs = 8000): Promise<HTMLAudioElement | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const audios = Array.from(document.querySelectorAll("audio"));
      const vapiEl = audios.find(
        (a) =>
          a.srcObject instanceof MediaStream &&
          (a.srcObject as MediaStream).getAudioTracks().length > 0,
      );
      if (vapiEl) { resolve(vapiEl); return; }
      if (Date.now() >= deadline) { resolve(null); return; }
      setTimeout(check, 250);
    };
    check();
  });
}

export function useScreenRecorder({
  interview_id,
  candidateId,
  getMicStream,
  chunkIntervalMs = 30_000,
  onChunkUploaded,
  onError,
}: UseScreenRecorderOptions): UseScreenRecorderReturn {
  const [status, setStatus]           = useState<ScreenRecorderStatus>("idle");
  const [chunksUploaded, setChunks]   = useState(0);

  const sessionIdRef     = useRef<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef  = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const chunkIndexRef    = useRef(0);

  // ── TWO flags that control upload behaviour ───────────────────────────────
  // isStoppingRef : set to true exactly once when stop() is called.
  //                 The very next ondataavailable fires the FINAL chunk then sets isDead.
  // isDeadRef     : once true, ALL ondataavailable callbacks become no-ops.
  //                 This is what stops the continuous API calls.
  const isStoppingRef = useRef(false);
  const isDeadRef     = useRef(false);

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadChunk = useCallback(
    async (blob: Blob, chunkIndex: number, isFinal: boolean) => {
      // Hard gate — if recorder is dead, never upload again
      if (isDeadRef.current && !isFinal) return;
      if (blob.size === 0) return;

      const form = new FormData();
      form.append("chunk",        blob, `chunk_${chunkIndex}.webm`);
      form.append("interview_id", interview_id);
      form.append("candidate_id", candidateId);
      form.append("session_id",   sessionIdRef.current);
      form.append("chunk_index",  String(chunkIndex));
      form.append("is_final",     isFinal ? "true" : "false");
      form.append("mime_type",    blob.type || "video/webm");

      try {
        const res = await fetch(`${Base_Url}/candidate/interview-recording-chunk`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          console.error(`[ScreenRecorder] chunk ${chunkIndex} failed:`, res.status);
          return;
        }
        setChunks((n) => n + 1);
        onChunkUploaded?.(chunkIndex);
        console.log(
          `[ScreenRecorder] ✓ chunk ${chunkIndex} (${Math.round(blob.size / 1024)} KB)${isFinal ? " [FINAL]" : ""}`,
        );
      } catch (err) {
        console.error(`[ScreenRecorder] chunk ${chunkIndex} error:`, err);
        onError?.(err as Error);
      }
    },
    [interview_id, candidateId, onChunkUploaded, onError],
  );

  // ── Cleanup all resources ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Kill the screen stream tracks — stops the browser "sharing" indicator
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Close AudioContext — releases all audio resources
    try { audioCtxRef.current?.close(); } catch (_) {}
    audioCtxRef.current = null;

    mediaRecorderRef.current = null;
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async (): Promise<void> => {
    if (mediaRecorderRef.current) {
      console.warn("[ScreenRecorder] Already recording");
      return;
    }

    // Reset all flags for a fresh session
    isStoppingRef.current = false;
    isDeadRef.current     = false;
    chunkIndexRef.current = 0;

    // 1. Screen video
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false, // we build audio manually
      });
    } catch (err) {
      console.warn("[ScreenRecorder] getDisplayMedia denied/cancelled:", err);
      setStatus("error");
      onError?.(err as Error);
      return;
    }

    screenStreamRef.current = screenStream;

    // 2. Mix mic + AI audio
    let mixedAudioTrack: MediaStreamTrack | null = null;
    try {
      const micStream = getMicStream();
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      // Mic
      if (micStream && micStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(micStream).connect(dest);
        console.log("[ScreenRecorder] ✓ Mic connected");
      }

      // AI (Vapi) — clone tracks so playback is unaffected
      const vapiEl = await findVapiAudioElement(8000);
      if (vapiEl && vapiEl.srcObject instanceof MediaStream) {
        const clones = (vapiEl.srcObject as MediaStream)
          .getAudioTracks()
          .map((t) => t.clone());
        if (clones.length > 0) {
          audioCtx.createMediaStreamSource(new MediaStream(clones)).connect(dest);
          console.log("[ScreenRecorder] ✓ Vapi AI audio cloned & connected");
        }
      } else {
        console.warn("[ScreenRecorder] Vapi audio element not found");
      }

      mixedAudioTrack = dest.stream.getAudioTracks()[0] ?? null;
    } catch (err) {
      console.warn("[ScreenRecorder] Audio mix failed, video-only:", err);
    }

    // 3. Combined stream
    const combined = new MediaStream();
    screenStream.getVideoTracks().forEach((t) => combined.addTrack(t));
    if (mixedAudioTrack) combined.addTrack(mixedAudioTrack);

    sessionIdRef.current = `screen_${interview_id}_${candidateId}_${Date.now()}`;

    const mimeType = getSupportedMime();
    console.log(
      `[ScreenRecorder] Starting | session=${sessionIdRef.current}`,
      `| video=${combined.getVideoTracks().length}`,
      `| audio=${combined.getAudioTracks().length}`,
    );

    // 4. MediaRecorder
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 800_000,
        audioBitsPerSecond: 128_000,
      });
    } catch (err) {
      console.error("[ScreenRecorder] MediaRecorder init failed:", err);
      cleanup();
      setStatus("error");
      onError?.(err as Error);
      return;
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      // If already dead — drop this chunk completely, no upload
      if (isDeadRef.current) {
        console.log("[ScreenRecorder] Dead — dropping chunk, no upload");
        return;
      }

      if (event.data.size === 0) return;

      const isFinal = isStoppingRef.current;
      const idx     = chunkIndexRef.current++;

      // If this is the final chunk, mark dead BEFORE the async upload
      // so any race-condition chunks that fire after are dropped
      if (isFinal) {
        isDeadRef.current = true;
        console.log("[ScreenRecorder] Final chunk — marking dead, no more uploads after this");
      }

      uploadChunk(event.data, idx, isFinal);
    };

    recorder.onerror = () => {
      isDeadRef.current = true;
      setStatus("error");
      onError?.(new Error("MediaRecorder error"));
    };

    recorder.onstart = () => {
      setStatus("recording");
      console.log("[ScreenRecorder] ✓ Recording started");
    };

    recorder.onstop = () => {
      console.log("[ScreenRecorder] Stopped — cleaning up");
      isDeadRef.current = true; // belt-and-suspenders
      cleanup();
      setStatus("stopped");
    };

    // Browser "Stop sharing" button
    screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        isStoppingRef.current = true;
        rec.requestData();
        rec.stop();
      }
    });

    recorder.start(chunkIntervalMs);
    mediaRecorderRef.current = recorder;
  }, [interview_id, candidateId, getMicStream, chunkIntervalMs, uploadChunk, onError, cleanup]);

  // ── Stop ─────────────────────────────────────────────────────────────────
  // Called from handleEnd / endInterview.
  // After this returns, zero further API calls will be made.
  const stop = useCallback(async (): Promise<void> => {
    const recorder = mediaRecorderRef.current;

    // Already stopped or never started — nothing to do
    if (!recorder || recorder.state === "inactive") {
      isDeadRef.current = true; // ensure dead even if recorder never started
      cleanup();
      return;
    }

    return new Promise<void>((resolve) => {
      // Mark stopping so the next ondataavailable sends is_final=true
      isStoppingRef.current = true;

      const originalOnStop = recorder.onstop;
      recorder.onstop = (event) => {
        // isDeadRef is set inside ondataavailable before this fires,
        // but set it here too as a safety net
        isDeadRef.current = true;
        if (typeof originalOnStop === "function") {
          originalOnStop.call(recorder, event);
        }
        resolve();
      };

      // requestData() triggers one final ondataavailable with the remaining data
      // stop() fires onstop after that
      recorder.requestData();
      recorder.stop();

      console.log("[ScreenRecorder] stop() called — final chunk will upload then all uploads cease");
    });
  }, [cleanup]);

  return {
    start,
    stop,
    status,
    sessionId: sessionIdRef.current,
    chunksUploaded,
  };
}