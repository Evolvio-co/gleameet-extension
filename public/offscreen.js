"use strict";
(() => {
  // src/offscreen.ts
  var micRecorder = null;
  var micInterval = null;
  var micSessionId = null;
  var tabRecorder = null;
  var tabInterval = null;
  var tabAudioCtx = null;
  var tabCaptureStream = null;
  var tabSessionId = null;
  var micStartToken = 0;
  var tabStartToken = 0;
  var expectedRecorderStops = /* @__PURE__ */ new WeakSet();
  var flushResolvers = /* @__PURE__ */ new Map();
  var TRANSCRIPTION_REQUEST_TIMEOUT_MS = 3e4;
  var TRANSCRIPTION_UPLOAD_ATTEMPTS = 4;
  var MAX_QUEUED_TRANSCRIPTION_CHUNKS = 90;
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
      if (micRecorder && micSessionId === meetingSessionId && isRecorderHealthy(micRecorder)) {
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
        const { recorder, interval } = startRecording(stream, "mic", meetingSessionId, sessionToken, apiBase);
        micRecorder = recorder;
        micInterval = interval;
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
      if (tabRecorder && tabSessionId === meetingSessionId && isRecorderHealthy(tabRecorder)) {
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
        const { recorder, interval } = startRecording(dest.stream, "tab", meetingSessionId, sessionToken, apiBase);
        tabRecorder = recorder;
        tabInterval = interval;
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
        flushRecorder(micRecorder, 6e3),
        flushRecorder(tabRecorder, 6e3)
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
    if (micInterval) {
      clearInterval(micInterval);
      micInterval = null;
    }
    if (micRecorder) {
      expectedRecorderStops.add(micRecorder);
      if (micRecorder.state === "recording") {
        try {
          micRecorder.stop();
        } catch (_) {
        }
      }
      micRecorder.stream.getTracks().forEach((t) => t.stop());
      micRecorder = null;
    }
    micSessionId = null;
  }
  function stopTabCapture() {
    tabStartToken++;
    if (tabInterval) {
      clearInterval(tabInterval);
      tabInterval = null;
    }
    if (tabRecorder) {
      expectedRecorderStops.add(tabRecorder);
      if (tabRecorder.state === "recording") {
        try {
          tabRecorder.stop();
        } catch (_) {
        }
      }
      tabRecorder.stream.getTracks().forEach((t) => t.stop());
      tabRecorder = null;
    }
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
  function startRecording(stream, streamType, meetingSessionId, sessionToken, apiBase) {
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    let chunkStartedAt = Date.now();
    let stopReported = false;
    let interval = null;
    let consecutiveUploadFailures = 0;
    let lastDataAvailableAt = Date.now();
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
    const reportUnexpectedStop = (reason) => {
      if (stopReported || expectedRecorderStops.has(recorder)) return;
      stopReported = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      chrome.runtime.sendMessage({
        type: "AUDIO_CAPTURE_STOPPED",
        stream: streamType,
        meetingSessionId,
        reason
      }).catch(() => {
      });
      try {
        if (recorder.state === "recording") recorder.stop();
      } catch (_) {
      }
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {
        }
      });
    };
    recorder.onerror = () => reportUnexpectedStop("recorder-error");
    recorder.onstop = () => reportUnexpectedStop("recorder-stopped");
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => reportUnexpectedStop("track-ended"));
      track.addEventListener("mute", () => {
        setTimeout(() => {
          if (track.muted && recorder.state === "recording") {
            reportUnexpectedStop("track-muted");
          }
        }, 3e4);
      });
    });
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
            consecutiveUploadFailures++;
            sendDiagnostic("offscreen_chunk_upload_exhausted", {
              queue_depth: uploadQueue.length,
              message: err?.message || String(err)
            });
            uploadQueue.shift();
            continue;
          }
          uploadQueue.shift();
          consecutiveUploadFailures = 0;
          if (!result?.text) {
            sendDiagnostic("offscreen_chunk_empty", { queue_depth: uploadQueue.length });
            continue;
          }
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
    recorder.ondataavailable = async (e) => {
      try {
        lastDataAvailableAt = Date.now();
        if (!e.data || e.data.size < 1e3) {
          sendDiagnostic("offscreen_chunk_too_small", { size: e.data?.size || 0 });
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
          reportUnexpectedStop("upload-queue-full");
          return;
        }
        uploadQueue.push({ blob: e.data, startOffsetMs: chunkStart, endOffsetMs: chunkEndedAt });
        void drainUploadQueue();
      } finally {
        settleFlushes(recorder);
      }
    };
    recorder.start(1e4);
    interval = setInterval(() => {
      const liveAudioTrack = stream.getAudioTracks().some((track) => track.readyState === "live");
      if (recorder.state !== "recording" || !stream.active || !liveAudioTrack) {
        reportUnexpectedStop("health-check-failed");
        return;
      }
      if (Date.now() - lastDataAvailableAt > 12e4) {
        reportUnexpectedStop("no-audio-chunks");
        return;
      }
    }, 15e3);
    return { recorder, interval };
  }
})();
