"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../shared/dist/capture-integrity.js
  var require_capture_integrity = __commonJS({
    "../shared/dist/capture-integrity.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.WebSpeechGate = exports.WEB_SPEECH_SUPPRESSION_MS = void 0;
      exports.transcriptTextRejection = transcriptTextRejection;
      exports.isUsableTranscriptText = isUsableTranscriptText;
      exports.audioWindowOutcomeRecord = audioWindowOutcomeRecord2;
      exports.meetingRelativeTimeline = meetingRelativeTimeline;
      var CONTAMINATION_PATTERNS = [
        /\blet us know in the comments\b/,
        /\bthanks? (you )?for watching\b/,
        /\b(please )?(like and )?subscribe to (my|our|the) channel\b/,
        /\bsee you in the next video\b/,
        /\bsubtitles (by|created by)\b/,
        /\bamara\.org\b/
      ];
      var LOW_INFORMATION_WORDS = /* @__PURE__ */ new Set([
        "um",
        "uh",
        "er",
        "erm",
        "ah",
        "oh",
        "hm",
        "hmm",
        "mm",
        "mhm",
        "mmhmm",
        "mm-hmm",
        "uh-huh",
        "uh-uh",
        "you",
        "right"
      ]);
      function transcriptTextRejection(text) {
        const normalized = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized)
          return "empty";
        if (CONTAMINATION_PATTERNS.some((pattern) => pattern.test(normalized)))
          return "contaminated";
        const words = normalized.split(" ").map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")).filter(Boolean);
        if (words.length === 0 || words.every((word) => LOW_INFORMATION_WORDS.has(word)))
          return "low_information";
        return null;
      }
      function isUsableTranscriptText(text) {
        return transcriptTextRejection(text) === null;
      }
      function audioWindowOutcomeRecord2(input) {
        const record = {
          path: input.path,
          stream: input.stream,
          outcome: input.outcome,
          chars: input.chars ?? 0
        };
        if (input.windowStartMs !== void 0)
          record.window_start_ms = input.windowStartMs;
        if (input.windowEndMs !== void 0)
          record.window_end_ms = input.windowEndMs;
        if (input.filteredReason)
          record.filtered_reason = input.filteredReason;
        if (input.filteredChars !== void 0)
          record.filtered_chars = input.filteredChars;
        if (input.bytes !== void 0)
          record.bytes = input.bytes;
        return record;
      }
      exports.WEB_SPEECH_SUPPRESSION_MS = 3e4;
      var WebSpeechGate = class {
        lastMicTranscriptAt = Number.NEGATIVE_INFINITY;
        /** Records a Whisper result. Returns true if it renewed the suppression window. */
        onWhisperResult(stream, text, nowMs) {
          if (stream !== "mic" || !isUsableTranscriptText(text))
            return false;
          this.lastMicTranscriptAt = nowMs;
          return true;
        }
        allowsWebSpeechFinal(nowMs) {
          return nowMs - this.lastMicTranscriptAt >= exports.WEB_SPEECH_SUPPRESSION_MS;
        }
      };
      exports.WebSpeechGate = WebSpeechGate;
      function meetingRelativeTimeline(entries, meetingStartedAt) {
        let carried = null;
        const timed = entries.map((entry, index) => {
          const parsed = entry.event_time_utc ? Date.parse(entry.event_time_utc) : NaN;
          if (Number.isFinite(parsed))
            carried = parsed;
          return { entry, index, ms: carried };
        });
        const known = timed.filter((item) => item.ms !== null).map((item) => item.ms);
        const firstEventMs = known.length > 0 ? Math.min(...known) : null;
        const startMs = meetingStartedAt ? Date.parse(meetingStartedAt) : NaN;
        const originMs = Number.isFinite(startMs) && (firstEventMs === null || startMs <= firstEventMs) ? startMs : firstEventMs;
        return timed.sort((a, b) => (a.ms ?? -Infinity) - (b.ms ?? -Infinity) || a.index - b.index).map(({ entry, ms }) => ({
          ...entry,
          elapsed_ms: ms !== null && originMs !== null ? ms - originMs : 0
        }));
      }
    }
  });

  // src/offscreen.ts
  var import_capture_integrity = __toESM(require_capture_integrity());
  var micRecorder = null;
  var micCapture = null;
  var micSessionId = null;
  var tabRecorder = null;
  var tabCapture = null;
  var tabAudioCtx = null;
  var tabCaptureStream = null;
  var tabSessionId = null;
  var micStartToken = 0;
  var tabStartToken = 0;
  var expectedRecorderStops = /* @__PURE__ */ new WeakSet();
  var flushResolvers = /* @__PURE__ */ new Map();
  var TRANSCRIPTION_REQUEST_TIMEOUT_MS = 3e4;
  var TRANSCRIPTION_UPLOAD_ATTEMPTS = 4;
  var TRANSCRIPTION_CADENCE_MS = 3e4;
  var REQUESTED_CHUNK_TIMEOUT_MS = 1e4;
  var MAX_QUEUED_TRANSCRIPTION_CHUNKS = 120;
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function transcribeChunkWithRetry(apiBase, sessionToken, blob, streamType, meetingSessionId) {
    let lastError = "unknown-transcription-error";
    for (let attempt = 1; attempt <= TRANSCRIPTION_UPLOAD_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_REQUEST_TIMEOUT_MS);
      try {
        const form = new FormData();
        form.append("audio", blob, "chunk.webm");
        form.append("stream", streamType);
        form.append("meeting_session_id", meetingSessionId);
        const response = await fetch(`${apiBase}/audio/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: form,
          signal: controller.signal
        });
        if (response.ok) return await response.json().catch(() => null);
        lastError = `http-${response.status}`;
        if ([400, 401, 403].includes(response.status)) break;
      } catch (err) {
        lastError = err?.name === "AbortError" ? "request-timeout" : err?.message || String(err);
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < TRANSCRIPTION_UPLOAD_ATTEMPTS) {
        console.warn(`[Evolvio Offscreen] ${streamType} upload retry ${attempt}/${TRANSCRIPTION_UPLOAD_ATTEMPTS}: ${lastError}`);
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
    throw new Error(lastError);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "START_MIC_CAPTURE") {
      const { meetingSessionId, sessionToken, apiBase } = message;
      if (micCapture && micSessionId === meetingSessionId && micCapture.recorder && isRecorderHealthy(micCapture.recorder)) {
        return;
      }
      stopMicCapture();
      const startToken = ++micStartToken;
      navigator.mediaDevices.getUserMedia({
        audio: {
          // This is an independent capture stream. Request processing here so
          // meeting-speaker audio leaking through the physical mic is less likely
          // to be transcribed and attributed to the local user.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).then((stream) => {
        if (startToken !== micStartToken) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (_) {
            }
          });
          return;
        }
        micCapture = startRecording(stream, "mic", meetingSessionId, sessionToken, apiBase, (recorder) => {
          micRecorder = recorder;
        });
        micSessionId = meetingSessionId;
        console.log("[Evolvio Offscreen] Mic capture started");
      }).catch((err) => {
        if (startToken !== micStartToken) return;
        console.warn("[Evolvio Offscreen] Mic capture failed:", err.message);
        chrome.runtime.sendMessage({
          type: "AUDIO_CAPTURE_STOPPED",
          stream: "mic",
          meetingSessionId,
          reason: `mic-start-failed:${err?.name || "unknown"}`
        }).catch(() => {
        });
      });
    }
    if (message.type === "START_TAB_CAPTURE") {
      const { meetingSessionId, sessionToken, apiBase, streamId } = message;
      if (tabCapture && tabSessionId === meetingSessionId && tabCapture.recorder && isRecorderHealthy(tabCapture.recorder)) {
        return;
      }
      stopTabCapture();
      const startToken = ++tabStartToken;
      navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId
          }
        },
        video: false
      }).then((tabStream) => {
        if (startToken !== tabStartToken) {
          tabStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (_) {
            }
          });
          return;
        }
        tabCaptureStream = tabStream;
        const audioCtx = new AudioContext();
        tabAudioCtx = audioCtx;
        const source = audioCtx.createMediaStreamSource(tabStream);
        source.connect(audioCtx.destination);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        tabCapture = startRecording(dest.stream, "tab", meetingSessionId, sessionToken, apiBase, (recorder) => {
          tabRecorder = recorder;
        });
        tabSessionId = meetingSessionId;
        console.log("[Evolvio Offscreen] Tab audio split: speakers + recorder both active");
      }).catch((err) => {
        if (startToken !== tabStartToken) return;
        console.warn("[Evolvio Offscreen] Tab capture failed:", err.message);
        chrome.runtime.sendMessage({
          type: "AUDIO_CAPTURE_STOPPED",
          stream: "tab",
          meetingSessionId,
          reason: `tab-start-failed:${err?.name || "unknown"}`
        }).catch(() => {
        });
      });
    }
    if (message.type === "STOP_MIC_CAPTURE") {
      stopMicCapture();
      console.log("[Evolvio Offscreen] Mic capture stopped");
    }
    if (message.type === "STOP_TAB_CAPTURE") {
      stopTabCapture();
      console.log("[Evolvio Offscreen] Tab capture stopped");
    }
    if (message.type === "FLUSH_AUDIO_CAPTURE") {
      Promise.all([
        micCapture?.flush(6e3) ?? Promise.resolve(),
        tabCapture?.flush(6e3) ?? Promise.resolve()
      ]).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
      return true;
    }
  });
  function settleFlushes(recorder) {
    const resolvers = flushResolvers.get(recorder) || [];
    flushResolvers.delete(recorder);
    resolvers.forEach((resolve) => resolve());
  }
  function flushRecorder(recorder, timeoutMs) {
    if (!recorder || recorder.state !== "recording") return Promise.resolve();
    return new Promise((resolve) => {
      let timer;
      const done = () => {
        clearTimeout(timer);
        const resolvers2 = flushResolvers.get(recorder) || [];
        const index = resolvers2.indexOf(done);
        if (index >= 0) resolvers2.splice(index, 1);
        if (resolvers2.length === 0) flushResolvers.delete(recorder);
        resolve();
      };
      timer = setTimeout(done, timeoutMs);
      const resolvers = flushResolvers.get(recorder) || [];
      resolvers.push(done);
      flushResolvers.set(recorder, resolvers);
      try {
        recorder.requestData();
      } catch (_) {
        done();
      }
    });
  }
  function isRecorderHealthy(recorder) {
    return recorder.state === "recording" && recorder.stream.active && recorder.stream.getAudioTracks().some((track) => track.readyState === "live");
  }
  function stopMicCapture() {
    micStartToken++;
    micCapture?.stop();
    micCapture = null;
    micRecorder = null;
    micSessionId = null;
  }
  function stopTabCapture() {
    tabStartToken++;
    tabCapture?.stop();
    tabCapture = null;
    tabRecorder = null;
    if (tabAudioCtx) {
      tabAudioCtx.close().catch(() => {
      });
      tabAudioCtx = null;
    }
    if (tabCaptureStream) {
      tabCaptureStream.getTracks().forEach((t) => t.stop());
      tabCaptureStream = null;
    }
    tabSessionId = null;
  }
  function startRecording(stream, streamType, meetingSessionId, sessionToken, apiBase, onRecorderChanged) {
    let recorder = null;
    let chunkStartedAt = Date.now();
    let stopReported = false;
    let stopped = false;
    let healthInterval = null;
    let rotationTimer = null;
    let rotationDeadlineTimer = null;
    let rotatingRecorder = null;
    const uploadQueue = [];
    let uploadInFlight = false;
    const sendDiagnostic = (reason, detail = {}) => {
      chrome.runtime.sendMessage({
        type: "CAPTURE_DIAGNOSTIC",
        meetingSessionId,
        reason,
        detail: { stream: streamType, ...detail }
      }).catch(() => {
      });
    };
    const clearRotationTimers = () => {
      if (rotationTimer) clearTimeout(rotationTimer);
      if (rotationDeadlineTimer) clearTimeout(rotationDeadlineTimer);
      rotationTimer = null;
      rotationDeadlineTimer = null;
    };
    const reportUnexpectedStop = (reason) => {
      if (stopped || stopReported) return;
      stopReported = true;
      clearRotationTimers();
      if (healthInterval) clearInterval(healthInterval);
      healthInterval = null;
      chrome.runtime.sendMessage({
        type: "AUDIO_CAPTURE_STOPPED",
        stream: streamType,
        meetingSessionId,
        reason
      }).catch(() => {
      });
      const active = recorder;
      if (active) {
        expectedRecorderStops.add(active);
        try {
          if (active.state === "recording") active.stop();
        } catch (_) {
        }
      }
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {
        }
      });
      recorder = null;
      onRecorderChanged(null);
    };
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => reportUnexpectedStop("track-ended"));
      track.addEventListener("mute", () => {
        sendDiagnostic("offscreen_track_muted", { ready_state: track.readyState });
      });
    });
    const sendWindowOutcome = (window, outcome, detail = {}) => {
      sendDiagnostic("audio_window_outcome", (0, import_capture_integrity.audioWindowOutcomeRecord)({
        path: "offscreen",
        stream: streamType === "tab" ? "tab" : "mic",
        outcome,
        windowStartMs: window.startOffsetMs,
        windowEndMs: window.endOffsetMs,
        ...detail
      }));
    };
    const drainUploadQueue = async () => {
      if (uploadInFlight) return;
      uploadInFlight = true;
      try {
        while (uploadQueue.length > 0) {
          const chunk = uploadQueue[0];
          let result;
          try {
            result = await transcribeChunkWithRetry(apiBase, sessionToken, chunk.blob, streamType, meetingSessionId);
          } catch (err) {
            sendDiagnostic("offscreen_chunk_upload_exhausted", {
              queue_depth: uploadQueue.length,
              message: err?.message || String(err)
            });
            sendWindowOutcome(chunk, "upload_failed");
            uploadQueue.shift();
            continue;
          }
          uploadQueue.shift();
          if (!result?.text) {
            sendDiagnostic("offscreen_chunk_empty", { queue_depth: uploadQueue.length });
            sendWindowOutcome(chunk, result?.filtered ? "filtered" : "empty", {
              filteredReason: result?.filtered,
              filteredChars: result?.filtered_chars
            });
            continue;
          }
          sendWindowOutcome(chunk, "transcribed", { chars: result.text.length });
          chrome.runtime.sendMessage({
            type: "AUDIO_TRANSCRIPT_RESULT",
            text: result.text,
            stream: streamType,
            startOffsetMs: chunk.startOffsetMs,
            endOffsetMs: chunk.endOffsetMs,
            eventTimeMs: chunk.endOffsetMs
          }).catch(() => {
          });
        }
      } finally {
        uploadInFlight = false;
        if (uploadQueue.length > 0) void drainUploadQueue();
      }
    };
    const enqueueChunk = async (activeRecorder, e) => {
      try {
        if (!e.data || e.data.size < 1e3) {
          sendDiagnostic("offscreen_chunk_too_small", { size: e.data?.size || 0 });
          sendWindowOutcome({ startOffsetMs: chunkStartedAt, endOffsetMs: Date.now() }, "too_small", { bytes: e.data?.size || 0 });
          return;
        }
        const chunkEndedAt = Date.now();
        const chunkStart = chunkStartedAt;
        chunkStartedAt = Date.now();
        if (uploadQueue.length >= MAX_QUEUED_TRANSCRIPTION_CHUNKS) {
          sendDiagnostic("offscreen_upload_queue_full", {
            queue_depth: uploadQueue.length,
            max_queue_depth: MAX_QUEUED_TRANSCRIPTION_CHUNKS
          });
          const dropped = uploadQueue.shift();
          if (dropped) sendWindowOutcome(dropped, "dropped");
          sendDiagnostic("offscreen_upload_queue_drop_oldest", {
            queue_depth: uploadQueue.length
          });
        }
        uploadQueue.push({ blob: e.data, startOffsetMs: chunkStart, endOffsetMs: chunkEndedAt });
        void drainUploadQueue();
      } finally {
        settleFlushes(activeRecorder);
      }
    };
    const startNextWindow = () => {
      if (stopped || !stream.active || !stream.getAudioTracks().some((track) => track.readyState === "live")) {
        if (!stopped) reportUnexpectedStop("stream-not-live-before-window");
        return;
      }
      const nextRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder = nextRecorder;
      onRecorderChanged(nextRecorder);
      chunkStartedAt = Date.now();
      rotatingRecorder = null;
      nextRecorder.ondataavailable = (event) => {
        void enqueueChunk(nextRecorder, event);
      };
      nextRecorder.onerror = () => {
        if (recorder === nextRecorder) reportUnexpectedStop("recorder-error");
      };
      nextRecorder.onstop = () => {
        settleFlushes(nextRecorder);
        if (stopped || expectedRecorderStops.has(nextRecorder)) return;
        if (rotatingRecorder === nextRecorder && recorder === nextRecorder) {
          clearRotationTimers();
          startNextWindow();
          return;
        }
        if (recorder === nextRecorder) reportUnexpectedStop("recorder-stopped");
      };
      try {
        nextRecorder.start();
        sendDiagnostic("offscreen_window_started");
      } catch (_) {
        reportUnexpectedStop("recorder-start-failed");
        return;
      }
      rotationTimer = setTimeout(() => {
        if (stopped || recorder !== nextRecorder || nextRecorder.state !== "recording") return;
        rotatingRecorder = nextRecorder;
        rotationDeadlineTimer = setTimeout(() => {
          if (!stopped && recorder === nextRecorder && rotatingRecorder === nextRecorder) {
            reportUnexpectedStop("window-stop-not-delivered");
          }
        }, REQUESTED_CHUNK_TIMEOUT_MS);
        try {
          nextRecorder.stop();
          sendDiagnostic("offscreen_window_rotation_requested");
        } catch (_) {
          reportUnexpectedStop("window-stop-failed");
        }
      }, TRANSCRIPTION_CADENCE_MS);
    };
    healthInterval = setInterval(() => {
      const active = recorder;
      if (stopped) return;
      const liveAudioTrack = stream.getAudioTracks().some((track) => track.readyState === "live");
      if (!active || active.state !== "recording" || !stream.active || !liveAudioTrack) {
        if (rotatingRecorder === active) return;
        reportUnexpectedStop("health-check-failed");
      }
    }, 5e3);
    startNextWindow();
    return {
      get recorder() {
        return recorder;
      },
      flush(timeoutMs) {
        return flushRecorder(recorder, timeoutMs);
      },
      stop() {
        stopped = true;
        clearRotationTimers();
        if (healthInterval) clearInterval(healthInterval);
        healthInterval = null;
        const active = recorder;
        recorder = null;
        onRecorderChanged(null);
        if (active) {
          expectedRecorderStops.add(active);
          try {
            if (active.state === "recording") active.stop();
          } catch (_) {
          }
        }
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {
          }
        });
      }
    };
  }
})();
