"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Headphones, LockKeyhole, MessagesSquare, Mic, MicOff, RefreshCw, RotateCcw, ShieldCheck, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createApplicantVoiceSample } from "@/lib/client-audio";
import { fetchJsonWithTimeout, withTimeout } from "@/lib/client-request";
import { assessInterviewTranscript, calculateInterviewTimeLimitSeconds, formatInterviewTime, normalizeInterviewQuestionCount } from "@/lib/interview-policy";
import type { InterviewSession } from "@/lib/types";
import ConfirmModal from "@/components/confirm-modal";
import InterviewRecovery, {useInterviewRecovery} from "@/components/interview-recovery";
import {uploadInterviewRecording} from "@/lib/recording-upload";

type Line = { role: "user" | "assistant"; text: string; at?: string };
type SpeechState = "idle" | "listening" | "hearing" | "processing";
type MicrophoneOption = { deviceId: string; label: string };
type RecordingState = "unavailable" | "starting" | "recording" | "ready" | "saving" | "saved" | "failed";
type RealtimeEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  transcript?: string;
  error?: { message?: string };
  response?: { status?: string; status_details?: { error?: { message?: string } } };
};

const RECORDING_UPLOAD_TIMEOUT_MS = 45_000;
const API_REQUEST_TIMEOUT_MS = 20_000;
const VOICE_SAMPLE_PROCESSING_TIMEOUT_MS = 5_000;
const VOICE_SAMPLE_UPLOAD_TIMEOUT_MS = 8_000;

export default function InterviewApp({ sessionId }: { sessionId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [microphoneName, setMicrophoneName] = useState("Microphone");
  const [microphones, setMicrophones] = useState<MicrophoneOption[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [switchingMicrophone, setSwitchingMicrophone] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("unavailable");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionStep, setSubmissionStep] = useState("");
  const [needsAudioActivation, setNeedsAudioActivation] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(3);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(calculateInterviewTimeLimitSeconds(3));
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(calculateInterviewTimeLimitSeconds(3));
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [error, setError] = useState("");
  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const transcriptScroll = useRef<HTMLDivElement | null>(null);
  const responseActive = useRef(false);
  const outputAudioActive = useRef(false);
  const completionRequested = useRef(false);
  const completionFinalized = useRef(false);
  const lastAssistantTranscript = useRef("");
  const micMonitor = useRef<number | null>(null);
  const micAudioContext = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const applicantRecorder = useRef<MediaRecorder | null>(null);
  const applicantRecordingChunks = useRef<Blob[]>([]);
  const recordingContext = useRef<AudioContext | null>(null);
  const recordingDestination = useRef<MediaStreamAudioDestinationNode | null>(null);
  const applicantRecordingDestination = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingMicSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordingStopPromise = useRef<Promise<Blob | null> | null>(null);
  const recordingUploadPromise = useRef<Promise<string | null> | null>(null);
  const uploadedRecordingPath = useRef<string | null>(null);
  const submitting = useRef(false);
  const pendingRecordingBlob = useRef<Blob | null>(null);
  const pendingApplicantRecordingBlob = useRef<Blob | null>(null);
  const linesRef = useRef<Line[]>([]);
  const questionCountRef = useRef(3);
  const timeLimitHandled = useRef(false);
  const interviewDeadline = useRef<number | null>(null);
  const recovery=useInterviewRecovery(sessionId);
  const [uploadProgress,setUploadProgress]=useState<number|null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: loadError } = await supabase.from("interview_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (loadError || !data) {
        setError("This interview room could not be found or is no longer available.");
        return;
      }
      const loaded = data as InterviewSession;
      setSession(loaded);
      setLines(loaded.transcript || []);
      linesRef.current = loaded.transcript || [];
    })();

    return () => {
      channel.current?.close();
      pc.current?.close();
      stream.current?.getTracks().forEach((track) => track.stop());
      void stopRecording();
      stopMicMonitor();
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    transcriptScroll.current?.scrollTo({ top: transcriptScroll.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  useEffect(() => {
    const handleDeviceChange = () => { void refreshMicrophones(false); };
    void refreshMicrophones(false);
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
  }, []);

  useEffect(() => {
    if (!connected || interviewComplete || !interviewDeadline.current) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((interviewDeadline.current! - Date.now()) / 1_000));
      setTimeRemainingSeconds(remaining);
      if (remaining === 0) void endAtTimeLimit();
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1_000);
    return () => window.clearInterval(timer);
  }, [connected, interviewComplete]);

  function addLine(line: Line) {
    setLines((current) => {
      const next = [...current, line];
      linesRef.current = next;
      return next;
    });
  }

  function isFinalSignoff(text: string) {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    return normalized.includes("press submit")
      && (normalized.includes("review the transcript") || normalized.includes("review your transcript"));
  }

  function stopMicMonitor() {
    if (micMonitor.current !== null) {
      window.clearInterval(micMonitor.current);
      micMonitor.current = null;
    }
    void micAudioContext.current?.close();
    micAudioContext.current = null;
    setMicLevel(0);
  }

  function startMicMonitor(media: MediaStream) {
    stopMicMonitor();
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(media).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    micAudioContext.current = context;
    micMonitor.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / samples.length);
      setMicLevel(Math.min(100, Math.round(rms * 500)));
    }, 120);
  }

  function closeRealtime() {
    if (recorder.current?.state === "recording") void stopRecording();
    channel.current?.close();
    pc.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    channel.current = null;
    pc.current = null;
    stream.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.srcObject = null;
    }
    stopMicMonitor();
  }

  async function startRecording(media: MediaStream, remote: MediaStream) {
    if (recorder.current || recordingContext.current) return;
    if (!("MediaRecorder" in window)) throw new Error("This browser does not support audio recording.");
    setRecordingState("starting");
    const context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const applicantDestination = context.createMediaStreamDestination();
    context.createMediaStreamSource(remote).connect(destination);
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("This browser does not support a playable audio recording format.");
    const nextRecorder = new MediaRecorder(destination.stream, { mimeType });
    const nextApplicantRecorder = new MediaRecorder(applicantDestination.stream, { mimeType });
    recordingChunks.current = [];
    applicantRecordingChunks.current = [];
    pendingRecordingBlob.current = null;
    pendingApplicantRecordingBlob.current = null;
    nextRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) recordingChunks.current.push(event.data);
    });
    nextApplicantRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) applicantRecordingChunks.current.push(event.data);
    });
    recordingContext.current = context;
    recordingDestination.current = destination;
    applicantRecordingDestination.current = applicantDestination;
    recordingMicSource.current = context.createMediaStreamSource(media);
    recordingMicSource.current.connect(destination);
    recordingMicSource.current.connect(applicantDestination);
    recorder.current = nextRecorder;
    applicantRecorder.current = nextApplicantRecorder;
    try {
      nextRecorder.start(1_000);
      nextApplicantRecorder.start(1_000);
      setRecordingState("recording");
    } catch (caught) {
      recorder.current = null;
      applicantRecorder.current = null;
      recordingMicSource.current.disconnect();
      recordingMicSource.current = null;
      recordingDestination.current = null;
      applicantRecordingDestination.current = null;
      await context.close();
      recordingContext.current = null;
      throw caught;
    }
  }

  function stopRecording(): Promise<Blob | null> {
    if (recordingStopPromise.current) return recordingStopPromise.current;
    const current = recorder.current;
    const currentApplicant = applicantRecorder.current;
    if (!current && !currentApplicant) return Promise.resolve(null);

    const stopOne = (active: MediaRecorder | null, chunks: Blob[]) => new Promise<Blob | null>((resolve) => {
      if (!active) return resolve(null);
      let completed = false;
      let stopTimeout: ReturnType<typeof setTimeout>;
      const complete = () => {
        if (completed) return;
        completed = true;
        clearTimeout(stopTimeout);
        active.removeEventListener("stop", complete);
        resolve(chunks.length ? new Blob(chunks, { type: active.mimeType || "audio/webm" }) : null);
      };
      // Some browsers fail to emit the final stop event after a connection
      // loss. Preserve the chunks already captured instead of waiting forever.
      stopTimeout = setTimeout(complete, 5_000);
      active.addEventListener("stop", complete, { once: true });
      if (active.state === "recording" || active.state === "paused") active.stop();
      else complete();
    });

    recordingStopPromise.current = Promise.all([
      stopOne(current, recordingChunks.current),
      stopOne(currentApplicant, applicantRecordingChunks.current),
    ]).then(([blob, applicantBlob]) => {
        pendingApplicantRecordingBlob.current = applicantBlob;
        recorder.current = null;
        applicantRecorder.current = null;
        recordingChunks.current = [];
        applicantRecordingChunks.current = [];
        recordingMicSource.current?.disconnect();
        recordingMicSource.current = null;
        void recordingContext.current?.close();
        recordingContext.current = null;
        recordingDestination.current = null;
        applicantRecordingDestination.current = null;
        recordingStopPromise.current = null;
        return blob;
    });
    return recordingStopPromise.current;
  }

  async function uploadRecording() {
    if (recordingUploadPromise.current) return recordingUploadPromise.current;
    if (session?.recording_path) {
      setRecordingState("saved");
      return session.recording_path;
    }
    const operation = (async () => {
      setRecordingState("saving");
      const blob = pendingRecordingBlob.current || await stopRecording();
      if (!blob || !session) {
        setRecordingState("failed");
        setError("The interview finished, but no audio recording was captured. Please start over and allow microphone access.");
        return null;
      }
      pendingRecordingBlob.current = blob;
      // Storage policies scope recordings to server_id/session_id folders.
      const path = `${session.server_id}/${session.id}/recording.webm`;
      if (uploadedRecordingPath.current !== path) {
        const { error: uploadError } = await withTimeout(
          uploadInterviewRecording(path, blob, setUploadProgress),
          RECORDING_UPLOAD_TIMEOUT_MS,
          "The recording upload timed out. Check your connection and try submitting again.",
        );
        if (uploadError) {
          setRecordingState("ready");
          setError(`The interview finished, but its recording could not be saved: ${uploadError.message}`);
          return null;
        }
        uploadedRecordingPath.current = path;
      }
      const linkResponse = await fetchJsonWithTimeout<{ error?: string; ok?: boolean }>(`/api/interviews/${encodeURIComponent(session.id)}/recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      }, API_REQUEST_TIMEOUT_MS, "The recording was uploaded, but linking it timed out. Please try submitting again.");
      if (!linkResponse.ok || !linkResponse.data?.ok) {
        setRecordingState("ready");
        setError(`The recording uploaded, but could not be linked to the interview: ${linkResponse.data?.error || "Please try submitting again."}`);
        return null;
      }
      setRecordingState("saved");
      pendingRecordingBlob.current = null;
      setSession((current) => current ? { ...current, recording_path: path } : current);
      return path;
    })();
    recordingUploadPromise.current = operation;
    try {
      return await operation;
    } finally {
      if (recordingUploadPromise.current === operation) recordingUploadPromise.current = null;
    }
  }

  async function uploadApplicantVoiceSample() {
    const applicantBlob = pendingApplicantRecordingBlob.current;
    pendingApplicantRecordingBlob.current = null;
    if (!applicantBlob || !session) return;

    const controller = new AbortController();
    try {
      const voiceSample = await withTimeout(
        createApplicantVoiceSample(applicantBlob, controller.signal),
        VOICE_SAMPLE_PROCESSING_TIMEOUT_MS,
        "Temporary voice sample processing timed out.",
      );
      if (!voiceSample) return;
      const voiceSamplePath = `${session.server_id}/${session.id}/voice-sample.wav`;
      const { error: voiceUploadError } = await withTimeout(
        supabase.storage.from("interview-recordings").upload(voiceSamplePath, voiceSample, {
          contentType: "audio/wav",
          upsert: true,
          cacheControl: "no-store",
        }),
        VOICE_SAMPLE_UPLOAD_TIMEOUT_MS,
        "Temporary voice sample upload timed out.",
      );
      if (voiceUploadError) console.warn("Temporary voice sample upload failed", voiceUploadError.message);
    } catch (voiceSampleError) {
      console.warn("Temporary voice sample could not be prepared", voiceSampleError);
    } finally {
      controller.abort();
    }
  }

  async function prepareCompletedInterview() {
    if (completionFinalized.current) return;
    completionFinalized.current = true;
    setModelSpeaking(false);
    setSpeechState("processing");
    const blob = await stopRecording();
    pendingRecordingBlob.current = blob;
    setRecordingState(blob ? "ready" : "failed");
    if(blob)await recovery.save(blob,linesRef.current,'realtime');
    if (!blob) setError((session?.restart_count ?? 0) < 1
      ? "The interview finished, but no audio recording was captured. Use your one restart and allow microphone access."
      : "The interview finished, but no audio recording was captured and the restart has already been used.");
    setInterviewComplete(true);
    setConnected(false);
    setSpeechState("idle");
    closeRealtime();
  }

  async function endAtTimeLimit() {
    if (timeLimitHandled.current) return;
    timeLimitHandled.current = true;
    completionFinalized.current = true;
    setTimeLimitReached(true);
    setConnected(false);
    setModelSpeaking(false);
    setSpeechState("idle");
    const blob = await stopRecording();
    closeRealtime();

    const assessment = assessInterviewTranscript(linesRef.current, questionCountRef.current);
    if (assessment.eligible && blob) {
      pendingRecordingBlob.current = blob;
      setRecordingState("ready");
      await recovery.save(blob,linesRef.current,'realtime');
      setInterviewComplete(true);
      setError("");
      return;
    }

    pendingRecordingBlob.current = null;
    recordingChunks.current = [];
    setRecordingState("unavailable");
    setInterviewComplete(false);
    setError(`${assessment.message} This timed-out attempt was not uploaded or submitted.`);
  }

  function microphoneConstraints(deviceId = selectedMicrophoneId): MediaTrackConstraints {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
  }

  async function refreshMicrophones(requestPermission: boolean) {
    let permissionStream: MediaStream | null = null;
    try {
      if (requestPermission) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints() });
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const available = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
      setMicrophones(available);
    } catch (caught) {
      if (requestPermission) {
        setError(caught instanceof Error ? caught.message : "Dexlyy could not access your microphones.");
      }
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function changeMicrophone(deviceId: string) {
    if (!connected) {
      setSelectedMicrophoneId(deviceId);
      setError("");
      return;
    }

    setSwitchingMicrophone(true);
    setError("");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints(deviceId) });
      const nextTrack = nextStream.getAudioTracks()[0];
      if (!nextTrack) throw new Error("The selected device did not provide a microphone track.");
      nextTrack.enabled = !muted;

      const sender = pc.current?.getSenders().find((candidate) => candidate.track?.kind === "audio");
      if (!sender) throw new Error("The active interview microphone connection was not found.");
      await sender.replaceTrack(nextTrack);

      const previousStream = stream.current;
      stream.current = nextStream;
      setSelectedMicrophoneId(nextTrack.getSettings().deviceId || deviceId);
      setMicrophoneName(nextTrack.label || "Browser microphone");
      nextTrack.addEventListener("ended", () => {
        if (stream.current?.getAudioTracks()[0] === nextTrack) {
          setSpeechState("idle");
          setError("The selected microphone disconnected. Choose another microphone to continue.");
        }
      });
      if (recordingContext.current && recordingDestination.current) {
        recordingMicSource.current?.disconnect();
        recordingMicSource.current = recordingContext.current.createMediaStreamSource(nextStream);
        recordingMicSource.current.connect(recordingDestination.current);
        if (applicantRecordingDestination.current) recordingMicSource.current.connect(applicantRecordingDestination.current);
      }
      startMicMonitor(nextStream);
      previousStream?.getTracks().forEach((track) => track.stop());
      await refreshMicrophones(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The microphone could not be changed.");
    } finally {
      setSwitchingMicrophone(false);
    }
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    try {
      const payload = JSON.parse(event.data) as RealtimeEvent;

      if (payload.type === "input_audio_buffer.speech_started") {
        if (!outputAudioActive.current) setSpeechState("hearing");
        setError("");
      }
      if (payload.type === "input_audio_buffer.speech_stopped" || payload.type === "input_audio_buffer.timeout_triggered") {
        setSpeechState("processing");
      }
      if (payload.type === "response.created") {
        responseActive.current = true;
        lastAssistantTranscript.current = "";
        completionRequested.current = false;
        setModelSpeaking(true);
      }
      if (payload.type === "output_audio_buffer.started") {
        outputAudioActive.current = true;
        setModelSpeaking(true);
      }
      if (payload.type === "output_audio_buffer.stopped") {
        outputAudioActive.current = false;
        setModelSpeaking(false);
        if (completionRequested.current && !responseActive.current) void prepareCompletedInterview();
        else setSpeechState("listening");
      }
      if (payload.type === "response.output_audio_transcript.done" && payload.transcript) {
        lastAssistantTranscript.current = payload.transcript;
        addLine({ role: "assistant", text: payload.transcript, at: new Date().toISOString() });
        // The completion tool is an internal signal, but the model can
        // occasionally finish the exact sign-off without emitting that tool
        // event. The explicit sign-off is safe to use as a fallback because
        // it is only accepted after the full audio response has completed.
        if (isFinalSignoff(payload.transcript)) {
          completionRequested.current = true;
          setSpeechState("processing");
        }
      }
      if (payload.type === "conversation.item.input_audio_transcription.completed" && payload.transcript) {
        addLine({ role: "user", text: payload.transcript, at: new Date().toISOString() });
        setSpeechState("processing");
      }
      if (payload.type === "conversation.item.input_audio_transcription.failed") {
        setSpeechState("listening");
        setError("Your answer reached the interview, but it could not be transcribed. Please repeat it clearly.");
      }
      if (payload.type === "response.function_call_arguments.done" && payload.name === "complete_interview") {
        completionRequested.current = true;
        setSpeechState("processing");
      }
      if (payload.type === "response.function_call_arguments.done" && payload.name === "wait_for_applicant" && payload.call_id) {
        // Acknowledge the silent tool, but do not create another response:
        // the next real applicant turn resumes the conversation through VAD.
        if (channel.current?.readyState === "open") channel.current.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: payload.call_id, output: JSON.stringify({ waiting: true }) },
        }));
        setSpeechState("listening");
      }
      if (payload.type === "response.done") {
        responseActive.current = false;
        const status = payload.response?.status;
        if (status !== "completed") {
          completionRequested.current = false;
          setModelSpeaking(outputAudioActive.current);
          setSpeechState("listening");
          if (status === "failed") setError("The interviewer had a connection problem. Your answers are still here; please try speaking again.");
          // A cancelled/truncated response is not a failed interview, and must
          // never finish it using an old or partially spoken sign-off.
        } else if (completionRequested.current && !outputAudioActive.current) {
          void prepareCompletedInterview();
        } else if (!outputAudioActive.current) {
          setModelSpeaking(false);
          setSpeechState("listening");
        }
      }
      if (payload.type === "error") {
        responseActive.current = false;
        setModelSpeaking(false);
        setError(payload.error?.message || "The Realtime interviewer reported an error.");
      }
    } catch {
      // Ignore non-JSON data-channel messages.
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    setNeedsAudioActivation(false);
    completionRequested.current = false;
    completionFinalized.current = false;
    lastAssistantTranscript.current = "";
    outputAudioActive.current = false;
    pendingRecordingBlob.current = null;
    pendingApplicantRecordingBlob.current = null;
    timeLimitHandled.current = false;
    setTimeLimitReached(false);

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(),
      });
      stream.current = media;
      const audioTrack = media.getAudioTracks()[0];
      if (!audioTrack) throw new Error("No microphone audio track was provided by your browser.");
      setMicrophoneName(audioTrack.label || "Browser microphone");
      setSelectedMicrophoneId(audioTrack.getSettings().deviceId || selectedMicrophoneId);
      audioTrack.addEventListener("ended", () => {
        if (stream.current?.getAudioTracks()[0] === audioTrack) {
          setSpeechState("idle");
          setError("Microphone access ended. Start the interview again and allow microphone access.");
        }
      });
      startMicMonitor(media);
      await refreshMicrophones(false);

      const peer = new RTCPeerConnection();
      pc.current = peer;
      peer.ontrack = (event) => {
        const audioElement = audio.current;
        if (!audioElement) return;
        audioElement.srcObject = event.streams[0];
        audioElement.muted = false;
        audioElement.volume = 1;
        void audioElement.play().catch(() => {
          setNeedsAudioActivation(true);
          setError("Your browser blocked the interviewer audio. Select Enable sound to continue.");
        });
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        void startRecording(media, remoteStream).catch((caught) => {
          setRecordingState("failed");
          setError(caught instanceof Error ? `Audio recording is unavailable: ${caught.message}` : "Audio recording is unavailable in this browser.");
        });
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          setConnected(false);
          setError("The interview audio connection failed. Please start the interview again.");
        }
      };
      media.getTracks().forEach((track) => peer.addTrack(track, media));

      const events = peer.createDataChannel("oai-events");
      channel.current = events;
      events.addEventListener("message", handleRealtimeEvent);
      const channelReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The interviewer connection timed out. Please try again.")), 12_000);
        events.addEventListener("open", () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
        events.addEventListener("error", () => {
          window.clearTimeout(timeout);
          reject(new Error("The interviewer data connection failed."));
        }, { once: true });
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sdp: offer.sdp }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "Realtime session could not be created.");
      }

      const nextQuestionCount = normalizeInterviewQuestionCount(Number(response.headers.get("X-Dexlyy-Question-Count")));
      recovery.prime({attempt:response.headers.get('X-Dexlyy-Started-At')||'',serverId:session?.server_id||''});
      const providerLimit = Number(response.headers.get("X-Dexlyy-Interview-Limit-Seconds"));
      const nextTimeLimit = Number.isFinite(providerLimit) && providerLimit >= 60
        ? Math.floor(providerLimit)
        : calculateInterviewTimeLimitSeconds(nextQuestionCount);
      questionCountRef.current = nextQuestionCount;
      setQuestionCount(nextQuestionCount);
      setTimeLimitSeconds(nextTimeLimit);
      setTimeRemainingSeconds(nextTimeLimit);

      const answer = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
      await channelReady;

      setConnected(true);
      interviewDeadline.current = Date.now() + nextTimeLimit * 1_000;
      setSpeechState("listening");
      setSession((current) => current ? { ...current, status: "in_progress" } : current);
      events.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: "Begin the whitelist interview now. Give one short welcome, state that a human owner makes the final decision, and ask only the first configured interview question. Do not wait for the applicant to speak first.",
        },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Microphone or interview connection failed.");
      channel.current?.close();
      pc.current?.close();
      stream.current?.getTracks().forEach((track) => track.stop());
      closeRealtime();
      setSpeechState("idle");
      setConnected(false);
    } finally {
      setBusy(false);
    }
  }

  async function enableSound() {
    try {
      await audio.current?.play();
      setNeedsAudioActivation(false);
      setError("");
    } catch {
      setError("Audio is still blocked. Allow sound for dexlyy.com in your browser, then try again.");
    }
  }

  async function finish() {
    if (submitting.current || session?.status === "completed") return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const transcript = linesRef.current;
      const assessment = assessInterviewTranscript(transcript, questionCountRef.current);
      if (!assessment.eligible) {
        setError(assessment.message);
        return;
      }
      setSubmissionStep("Saving recording…");
      const recordingPath = await uploadRecording();
      if (!recordingPath) return;

      // This integrity signal is optional. It has a strict time budget and can
      // never prevent the interview itself from reaching the owner.
      setSubmissionStep("Preparing submission…");
      await uploadApplicantVoiceSample();

      setSubmissionStep("Submitting interview…");
      const submitResponse = await fetchJsonWithTimeout<{ error?: string; ok?: boolean }>("/api/interviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript }),
      }, API_REQUEST_TIMEOUT_MS, "Submitting the interview timed out. Please try again; your recording is already saved.");
      if (!submitResponse.ok || !submitResponse.data?.ok) {
        setError(submitResponse.data?.error || "Submission was not confirmed. Keep this page open and try Submit interview again.");
        return;
      }

      setConnected(false);
      closeRealtime();
      setSpeechState("idle");
      setInterviewComplete(true);
      setSession((current) => current ? { ...current, status: "completed" } : current);
      await recovery.clear();
    } catch (caught) {
      setRecordingState((current) => current === "saving" ? "ready" : current);
      setError(caught instanceof Error ? caught.message : "The interview could not be submitted. Please try again.");
    } finally {
      submitting.current = false;
      setSubmissionStep("");
      setBusy(false);
    }
  }

  async function startOver() {
    setBusy(true);
    setError("");
    closeRealtime();
    await stopRecording();
    pendingRecordingBlob.current = null;
    pendingApplicantRecordingBlob.current = null;
    recordingChunks.current = [];
    applicantRecordingChunks.current = [];
    const resetResponse = await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/reset`, { method: "POST" });
    const resetResult = await resetResponse.json().catch(() => null) as { error?: string; restartCount?: number } | null;
    if (!resetResponse.ok) {
      setError(resetResult?.error || "The interview could not be restarted.");
      setBusy(false);
      return;
    }
    await recovery.clear();
    uploadedRecordingPath.current = null;
    setLines([]);
    linesRef.current = [];
    setInterviewComplete(false);
    setConnected(false);
    setModelSpeaking(false);
    setSpeechState("idle");
    setRecordingState("unavailable");
    setRestartOpen(false);
    setTimeLimitReached(false);
    interviewDeadline.current = null;
    timeLimitHandled.current = false;
    const resetTimeLimit = calculateInterviewTimeLimitSeconds(questionCountRef.current);
    setTimeLimitSeconds(resetTimeLimit);
    setTimeRemainingSeconds(resetTimeLimit);
    completionRequested.current = false;
    completionFinalized.current = false;
    lastAssistantTranscript.current = "";
    outputAudioActive.current = false;
    setSession((current) => current ? { ...current, status: "created", transcript: [], summary: null, score: null, restart_count: resetResult?.restartCount ?? 1, started_at: null, completed_at: null, recording_path: null } : current);
    setBusy(false);
  }

  function toggleMute() {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  const submissionAssessment = assessInterviewTranscript(lines, questionCount);
  const submitted = session?.status === "completed";
  const canRestart = !submitted && (session?.restart_count ?? 0) < 1;
  const roomStatus = submitted
    ? "Interview submitted successfully"
    : interviewComplete
    ? "Your interview is complete"
    : timeLimitReached
      ? "This attempt has ended"
    : modelSpeaking
      ? "Your interviewer is speaking"
      : speechState === "hearing"
        ? "I’m listening — take your time"
        : speechState === "processing"
          ? "Thinking about your answer"
          : connected
            ? "Your turn — answer naturally"
            : "Your private room is ready";
  const roomHint = submitted
    ? "Your recording and transcript have been sent to the server’s review team. You can safely leave this page."
    : interviewComplete
    ? timeLimitReached
      ? "The time limit was reached after enough spoken answers. Review the transcript, then submit when you’re happy."
      : "Review the transcript, then submit when you’re happy. Nothing has been sent to the owner yet."
    : timeLimitReached
      ? canRestart
        ? "Not enough clear spoken answers were captured, so nothing was uploaded or submitted. Use your one restart when you’re ready."
        : "Not enough clear spoken answers were captured, so nothing was uploaded or submitted. No restarts remain for this application."
    : modelSpeaking
      ? "You’ll have the floor as soon as the question is finished."
      : speechState === "hearing"
        ? "Natural pauses are okay. Finish your thought when you’re ready."
        : speechState === "processing"
          ? "Just a moment while the interviewer prepares the next question."
          : connected
            ? `You have ${formatInterviewTime(timeRemainingSeconds)} remaining. Natural pauses are fine, but make sure you answer each question aloud.`
            : `Choose your microphone, get comfortable, and begin when you’re ready. This interview allows up to ${Math.floor(timeLimitSeconds / 60)} minutes.`;
  const voiceState = (submitted || interviewComplete)
    ? "complete"
    : timeLimitReached
      ? "ready"
    : modelSpeaking
      ? "speaking"
      : speechState === "hearing"
        ? "hearing"
        : speechState === "processing"
          ? "processing"
          : connected
            ? "listening"
            : "ready";
  const recordingMessage = submitted
    ? "Recording submitted securely."
    : recordingState === "saved"
    ? "Recording saved and ready for the owner team."
    : recordingState === "ready"
      ? "Ready to submit — the recording has not been uploaded yet."
    : recordingState === "saving"
      ? "Uploading the interview recording…"
      : recordingState === "starting"
        ? "Preparing a local recording…"
    : recordingState === "failed"
        ? canRestart ? "Recording could not be saved. Use your restart to try again." : "Recording could not be saved and no restarts remain."
        : connected
          ? "Recorded locally for now — nothing uploads until you submit."
          : "Audio recording starts when the interview connects.";

  return <main className="interview-page">
    <InterviewRecovery sessionId={sessionId} recovery={recovery} disabled={connected||busy||submitted} progress={uploadProgress} onRestore={copy=>{if(copy.mode!=='realtime')return;pendingRecordingBlob.current=copy.blob;linesRef.current=copy.lines;setLines(copy.lines);setRecordingState('ready');setInterviewComplete(true);setError('');}} />
    <div className="interview-ambient interview-ambient-one" aria-hidden="true" />
    <div className="interview-ambient interview-ambient-two" aria-hidden="true" />
    <header className="interview-header">
      <Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link>
      <span className={`interview-room-status ${connected ? "live" : ""}`}>
        <LockKeyhole size={13} /> {connected ? "Private session live" : "Private interview room"}
      </span>
    </header>

    <section className="interview-shell">
      <div className="interview-intro">
        <div>
          <span className="eyebrow">Guided voice interview</span>
          <h1>Take a breath.<br />You’re in the room.</h1>
          <p>Answer in your own words and at your own pace. Your interviewer will listen for a complete thought before moving on.</p>
        </div>
        <div className="interview-trust" aria-label="Interview assurances">
          <span><ShieldCheck size={15} /> Human-reviewed</span>
          <span><Headphones size={15} /> Private recording</span>
          <span><RotateCcw size={15} /> {canRestart ? "One restart available" : "Restart already used"}</span>
        </div>
      </div>

      <div className="interview-card">
        <section className="voice-card">
          <div className="interviewer-profile">
            <span className="interviewer-avatar"><span className="brand-mark" /></span>
            <span>
              <strong>Dexlyy interviewer</strong>
              <small>Calm, guided conversation</small>
            </span>
            <span className={`interviewer-presence ${connected ? "online" : ""}`}>{connected ? "In the room" : "Standing by"}</span>
          </div>

          <div className="voice-stage">
            <div className={`voice-orb voice-${voiceState}`} aria-hidden="true">
              <span className="voice-orb-core"><Headphones size={30} /></span>
              <span className="voice-ring voice-ring-one" />
              <span className="voice-ring voice-ring-two" />
            </div>
            <span className={`voice-state-label voice-${voiceState}`}>
              <span /> {roomStatus}
            </span>
            <h2>{roomStatus}</h2>
            <p>{roomHint}</p>
          </div>

          <div className="interview-audio-panel">
            <div className="audio-panel-heading">
              <span><Volume2 size={15} /> Your audio</span>
              <div className="interview-audio-meta">
                <span className={`interview-timer ${connected && timeRemainingSeconds <= 120 ? "ending" : ""}`}>
                  {connected ? `${formatInterviewTime(timeRemainingSeconds)} remaining` : `${Math.floor(timeLimitSeconds / 60)} minute limit`}
                </span>
                <small className={`recording-status recording-${recordingState}`}>
                  {recordingState === "recording" ? "Recording locally — not uploaded" : recordingMessage}
                </small>
              </div>
            </div>
            {connected && <div className="mic-diagnostic">
              <div className="mic-device-row">
                <span className="mic-name">{microphoneName}</span>
                <span>{muted ? "Muted" : micLevel >= 4 ? "Signal detected" : "Listening"}</span>
              </div>
              <span className="mic-meter" aria-label={`Microphone level ${micLevel}%`}><span style={{ width: `${Math.max(2, micLevel)}%` }} /></span>
            </div>}
            <div className="mic-picker">
              <label htmlFor="interview-microphone">Microphone input</label>
              <div>
                <select
                  id="interview-microphone"
                  value={selectedMicrophoneId}
                  onChange={(event) => void changeMicrophone(event.target.value)}
                  disabled={busy || switchingMicrophone}
                >
                  <option value="">System default</option>
                  {microphones.map((microphone) => <option key={microphone.deviceId} value={microphone.deviceId}>{microphone.label}</option>)}
                </select>
                <button className="mic-refresh" type="button" onClick={() => void refreshMicrophones(true)} disabled={busy || switchingMicrophone} aria-label="Refresh microphones">
                  <RefreshCw size={15} />
                </button>
              </div>
              {switchingMicrophone && <small>Switching microphone…</small>}
            </div>
          </div>

          <div className="interview-controls">
            {submitted
              ? <Link className="btn btn-primary" href="/dashboard"><CheckCircle2 size={16} /> Return to dashboard</Link>
              : interviewComplete
              ? <>
                <button className="btn btn-primary" onClick={finish} disabled={busy || !submissionAssessment.eligible || !["ready", "saved"].includes(recordingState)} title={submissionAssessment.eligible ? undefined : submissionAssessment.message}><CheckCircle2 size={16} /> {busy ? submissionStep || "Submitting…" : recordingState === "saving" ? "Saving recording…" : "Submit interview"}</button>
                {canRestart && <button className="btn interview-secondary" onClick={() => setRestartOpen(true)} disabled={busy}><RotateCcw size={16} /> Start over</button>}
              </>
              : timeLimitReached
                ? canRestart
                  ? <button className="btn btn-primary interview-start" onClick={() => setRestartOpen(true)} disabled={busy}><RotateCcw size={16} /> Use your restart</button>
                  : <span className="interview-retry-note">No restarts remain. This attempt cannot be submitted without enough clear answers.</span>
              : !connected
                ? <button className="btn btn-primary interview-start" onClick={start} disabled={busy}><Mic size={16} />{busy ? "Preparing your room…" : "Enter interview"}</button>
                : <>
                  <button className="btn interview-secondary" onClick={toggleMute}>{muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? "Unmute" : "Mute"}</button>
                  {canRestart && <button className="btn interview-finish" onClick={() => setRestartOpen(true)} disabled={busy}><RotateCcw size={16} /> Start over</button>}
                </>}
            {needsAudioActivation && <button className="btn interview-secondary" onClick={enableSound}>Enable sound</button>}
          </div>
          {interviewComplete && !submitted && !submissionAssessment.eligible && <p className="interview-submit-requirement">{submissionAssessment.message}</p>}
        </section>

        <section className="transcript-card">
          <div className="transcript-heading">
            <div>
              <span className="transcript-kicker">Conversation</span>
              <h2>Live transcript</h2>
            </div>
            <span className="turn-count">{lines.length} {lines.length === 1 ? "turn" : "turns"}</span>
          </div>
          <div className="transcript-scroll" ref={transcriptScroll} aria-live="polite">
            {lines.length
              ? lines.map((line, index) => <div className={`transcript-line ${line.role}`} key={`${index}-${line.text}`}>
                <span className="transcript-avatar">{line.role === "assistant" ? "V" : "You"}</span>
                <div>
                  <span className="transcript-role">{line.role === "assistant" ? "Dexlyy interviewer" : "You"}</span>
                  <p>{line.text}</p>
                </div>
              </div>)
              : <div className="transcript-empty">
                <span><MessagesSquare size={21} /></span>
                <strong>Your conversation will appear here</strong>
                <p>Nothing to prepare. The first question begins after you enter the room.</p>
              </div>}
          </div>
          <div className="transcript-privacy"><LockKeyhole size={13} /> Private to you and the review team, with AI processing by OpenAI as explained before the interview.</div>
        </section>
      </div>
      {error && <div className="form-error interview-error">{error}</div>}
      <audio ref={audio} autoPlay playsInline />
    </section>
    {restartOpen && canRestart && <ConfirmModal
      title="Use your one interview restart?"
      description="Your current answers and local recording will be permanently discarded. You can restart only once, and the next attempt must be completed or left unsubmitted."
      confirmLabel="Discard and start over"
      busy={busy}
      onCancel={() => setRestartOpen(false)}
      onConfirm={() => void startOver()}
    />}
  </main>;
}
