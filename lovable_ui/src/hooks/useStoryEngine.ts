import { useState, useEffect, useRef, useCallback } from "react";
import {
  createFallbackTopicProfile,
  type BiographyTopic,
  type TopicProfile,
  type TopicStatus,
} from "../lib/biographyTopics";
import { isAudioPlaybackAllowed } from "../lib/audioSessionGuard";
import type { ArchiveRecommendation, MyArchiveView } from "../lib/archiveTypes";

const CONFIG = {
  API_BASE: "http://localhost:8000",
  WS_URL: "ws://localhost:8000/ws/chat",
  RECONNECT: { BASE_DELAY: 1000, MAX_DELAY: 30000, MULTIPLIER: 2 },
  AUDIO: { TARGET_SAMPLE_RATE: 16000, BUFFER_SIZE: 4096 },
  VAD: { SILENCE_THRESHOLD_DB: -35, SILENCE_DURATION_MS: 3000, FFT_SIZE: 2048, SMOOTHING: 0.8 },
  MAX_RECORDING_DURATION_S: 180,
};

// Global audio context and instances to prevent issues during fast re-renders
let sharedAudioContext: window.AudioContext | null = null;
let audioUnlocked = false;

export type User = { userId: string; phone: string; name: string; age?: number; authToken?: string };
export type ConvoState = "idle" | "userRecording" | "aiThinking" | "aiTalking";
export type ChatMessage = { id: number; role: "ai" | "user"; text: string };
export type { BiographyTopic, TopicProfile, TopicStatus };

export function useStoryEngine() {
  const [user, setUser] = useState<User | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">("offline");
  const [convoState, setConvoState] = useState<ConvoState>("idle");
  const [subtitle, setSubtitle] = useState("");
  const [userStats, setUserStats] = useState({ totalConversations: 0, estimatedDurationMin: 0 });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [hasBiography, setHasBiography] = useState(false);
  const [topicProfile, setTopicProfile] = useState<TopicProfile | null>(null);
  const [archive, setArchive] = useState<MyArchiveView | null>(null);

  // References for mutable state that doesn't need to trigger renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<window.ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<window.MediaStreamAudioSourceNode | null>(null);
  const vadAnimationFrameRef = useRef<number | null>(null);
  
  const recordingStateRef = useRef<"idle" | "recording">("idle");
  const isSilentRef = useRef(false);
  const silenceStartTimeRef = useRef(0);
  const recordingStartTimeRef = useRef(0);
  const explicitStopCallbackRef = useRef<(() => void) | null>(null);

  // Playback Refs
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<window.AudioBufferSourceNode | null>(null);
  const activeAudioSessionRef = useRef<number | null>(null);
  const audioSessionCounterRef = useRef(0);

  // Expose frequency data for UI visualizer
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  // User auth management
  useEffect(() => {
    const savedUser = localStorage.getItem("story_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (!parsed.authToken) {
          localStorage.removeItem("story_user");
          return;
        }
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem("story_user");
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      audioSessionCounterRef.current += 1;
      activeAudioSessionRef.current = audioSessionCounterRef.current;
    } else {
      activeAudioSessionRef.current = null;
    }
  }, [user?.userId]);

  const login = async (phone: string, password: string) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const result = await res.json();
    if (result.success) {
      setUser(result);
      localStorage.setItem("story_user", JSON.stringify(result));
      return { success: true };
    }
    return {
      success: false,
      message: result.message,
      needSetPassword: result.needSetPassword || false,
    };
  };

  const register = async (phone: string, name: string, age: string, password: string) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, age: age ? parseInt(age) : null, password }),
    });
    const result = await res.json();
    if (result.success) {
      setUser(result);
      localStorage.setItem("story_user", JSON.stringify(result));
      return { success: true };
    }
    return { success: false, message: result.message };
  };

  const setPassword = async (phone: string, password: string) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/users/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const result = await res.json();
    if (result.success) {
      setUser(result);
      localStorage.setItem("story_user", JSON.stringify(result));
      return { success: true };
    }
    return { success: false, message: result.message };
  };

  const logout = () => {
    activeAudioSessionRef.current = null;
    stopRecording(false);
    stopPlayback();
    setConvoState("idle");
    setSubtitle("");
    setFrequencyData(null);
    setArchive(null);
    localStorage.removeItem("story_user");
    if (wsRef.current) wsRef.current.close(1000);
    setUser(null);
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/stats/${user.userId}`);
      const stats = await res.json();
      setUserStats({
        totalConversations: stats.totalConversations || 0,
        estimatedDurationMin: stats.estimatedDurationMin || 0,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTopicProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/topic-profile/${user.userId}`);
      const profile = await res.json();
      setTopicProfile(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchArchive = async () => {
    if (!user) return null;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/my-archive/${user.userId}`);
      const data = await res.json();
      setArchive(data);
      return data as MyArchiveView;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      setTopicProfile((prev) => prev ?? createFallbackTopicProfile(user.userId));
      fetchStats();
      fetchTopicProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Audio Context Init
  const initAudioContext = useCallback(() => {
    if (!sharedAudioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioContext = new AudioCtx();
    }
    return sharedAudioContext;
  }, []);

  const unlockAudioContext = useCallback(() => {
    if (audioUnlocked) return;
    const ctx = initAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(ctx.currentTime + 0.001);
    audioUnlocked = true;
  }, [initAudioContext]);

  // WS Connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    setNetworkStatus("offline");
    
    try {
      wsRef.current = new WebSocket(CONFIG.WS_URL);
      wsRef.current.binaryType = "arraybuffer";
    } catch (e) {
      scheduleReconnect();
      return;
    }

    wsRef.current.onopen = () => {
      setWsConnected(true);
      setNetworkStatus("online");
      reconnectAttemptsRef.current = 0;
      if (user) {
        wsRef.current?.send(JSON.stringify({
          type: "login",
          phone: user.phone,
          authToken: user.authToken,
        }));
      }
    };

    wsRef.current.onmessage = async (event) => {
      if (typeof event.data === "string") {
        handleJsonMessage(event.data);
      } else {
        handleAudioMessage(event.data);
      }
    };

    wsRef.current.onclose = (e) => {
      setWsConnected(false);
      setNetworkStatus("offline");
      if (e.code !== 1000) scheduleReconnect();
    };

    wsRef.current.onerror = () => {
      setWsConnected(false);
      setNetworkStatus("offline");
    };
  }, [user]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    const delay = Math.min(
      CONFIG.RECONNECT.BASE_DELAY * Math.pow(CONFIG.RECONNECT.MULTIPLIER, reconnectAttemptsRef.current),
      CONFIG.RECONNECT.MAX_DELAY
    );
    reconnectAttemptsRef.current++;
    reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
  }, [connectWebSocket]);

  useEffect(() => {
    if (user) connectWebSocket();
    return () => {
      activeAudioSessionRef.current = null;
      stopPlayback();
      stopRecording(false);
      if (wsRef.current) wsRef.current.close(1000);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [user, connectWebSocket]);

  // Handle incoming WS JSON
  const handleJsonMessage = (jsonStr: string) => {
    try {
      const msg = JSON.parse(jsonStr);
      if (msg.status === "ready" && msg.user) {
        setConvoState("idle");
        setSubtitle(msg.text || "");
        if (msg.hasBiography !== undefined) setHasBiography(msg.hasBiography);
        if (msg.topicProfile) {
          setTopicProfile(msg.topicProfile);
        } else {
          setTopicProfile(createFallbackTopicProfile(msg.user.userId));
        }
        fetchStats();
      }
      if (msg.event === "topic_profile_updated" && msg.topicProfile) {
        setTopicProfile(msg.topicProfile);
      }
      if (msg.status === "ai_thinking") setConvoState("aiThinking");
      if (msg.status === "ai_speaking") setConvoState("aiTalking");
      if (msg.status === "ready" && !msg.user) setConvoState("idle");

      if (msg.text) {
        setSubtitle(msg.text);
        if (msg.status === "ai_speaking") {
           setChatHistory(prev => [...prev, { id: Date.now(), role: "ai", text: msg.text }]);
        }
      }

      if (msg.event === "ai_response_end") {
        setConvoState("idle");
        fetchStats();
        fetchArchive();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle incoming WS Audio
  const handleAudioMessage = async (arrayBuffer: ArrayBuffer) => {
    const audioSessionId = activeAudioSessionRef.current;
    if (!isAudioPlaybackAllowed(audioSessionId, activeAudioSessionRef.current)) return;

    const ctx = initAudioContext();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!isAudioPlaybackAllowed(audioSessionId, activeAudioSessionRef.current)) return;

      playbackQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) playNextInQueue(audioSessionId);
    } catch (e) {
      console.error(e);
    }
  };

  const playNextInQueue = (audioSessionId = activeAudioSessionRef.current) => {
    if (!isAudioPlaybackAllowed(audioSessionId, activeAudioSessionRef.current)) {
      stopPlayback();
      setConvoState("idle");
      return;
    }

    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (convoState === "aiTalking") setConvoState("idle");
      return;
    }
    isPlayingRef.current = true;
    setConvoState("aiTalking");
    
    const ctx = initAudioContext();
    const buffer = playbackQueueRef.current.shift();
    const source = ctx.createBufferSource();
    source.buffer = buffer!;
    source.connect(ctx.destination);
    
    source.onended = () => {
      currentSourceRef.current = null;
      playNextInQueue(audioSessionId);
    };
    
    currentSourceRef.current = source;
    source.start(0);
  };

  const stopPlayback = () => {
    if (currentSourceRef.current) {
        currentSourceRef.current.onended = null;
        try { currentSourceRef.current.stop(); } catch(e) {}
        currentSourceRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // Recording logic
  const startRecordingCore = async (onStop?: () => void) => {
    if (recordingStateRef.current === "recording") return false;
    
    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      }
    } catch (e) {
      return false;
    }

    const ctx = initAudioContext();
    const sampleRate = ctx.sampleRate;
    
    analyserNodeRef.current = ctx.createAnalyser();
    analyserNodeRef.current.fftSize = CONFIG.VAD.FFT_SIZE;
    analyserNodeRef.current.smoothingTimeConstant = CONFIG.VAD.SMOOTHING;
    
    sourceNodeRef.current = ctx.createMediaStreamSource(mediaStreamRef.current);
    scriptProcessorRef.current = ctx.createScriptProcessor(CONFIG.AUDIO.BUFFER_SIZE, 1, 1);
    
    const downsampleRatio = sampleRate / CONFIG.AUDIO.TARGET_SAMPLE_RATE;
    
    scriptProcessorRef.current.onaudioprocess = (e) => {
      if (recordingStateRef.current !== "recording") return;
      const inputData = e.inputBuffer.getChannelData(0);
      const newLength = Math.floor(inputData.length / downsampleRatio);
      const downsampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        downsampled[i] = inputData[Math.floor(i * downsampleRatio)];
      }
      const pcmBuffer = new ArrayBuffer(newLength * 2);
      const pcmView = new DataView(pcmBuffer);
      for (let i = 0; i < newLength; i++) {
        let sample = Math.max(-1, Math.min(1, downsampled[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        pcmView.setInt16(i * 2, sample, true);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(pcmBuffer);
      }
    };
    
    sourceNodeRef.current.connect(analyserNodeRef.current);
    sourceNodeRef.current.connect(scriptProcessorRef.current);
    scriptProcessorRef.current.connect(ctx.destination);
    
    recordingStateRef.current = "recording";
    recordingStartTimeRef.current = Date.now();
    isSilentRef.current = false;
    explicitStopCallbackRef.current = onStop || null;
    
    setConvoState("userRecording");
    return true;
  };

  const stopRecording = useCallback((sendEvent = true) => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      try { scriptProcessorRef.current.disconnect(); } catch (e) {}
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    recordingStateRef.current = "idle";
    
    if (vadAnimationFrameRef.current) {
      cancelAnimationFrame(vadAnimationFrameRef.current);
      vadAnimationFrameRef.current = null;
    }

    if (sendEvent && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: "user_speech_ended" }));
    }

    if (explicitStopCallbackRef.current) {
      explicitStopCallbackRef.current();
      explicitStopCallbackRef.current = null;
    }
  }, []);

  // VAD Loop (For Auto Mode and Visualizer)
  const startVADLoop = useCallback(() => {
    if (!analyserNodeRef.current) return;
    const analyser = analyserNodeRef.current;
    
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const analyze = () => {
      if (recordingStateRef.current !== "recording") return;
      
      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(freqData);
      setFrequencyData(new Uint8Array(freqData));

      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const offset = dataArray[i] - 128;
        sumSquares += offset * offset;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const dB = rms === 0 ? -100 : 20 * Math.log10(rms / 128);

      const now = Date.now();
      if (dB < CONFIG.VAD.SILENCE_THRESHOLD_DB) {
        if (!isSilentRef.current) {
          isSilentRef.current = true;
          silenceStartTimeRef.current = now;
        }
        if (now - silenceStartTimeRef.current >= CONFIG.VAD.SILENCE_DURATION_MS) {
          stopRecording(true);
          setConvoState("aiThinking"); // Provide immediate feedback
          return;
        }
      } else {
        isSilentRef.current = false;
        silenceStartTimeRef.current = 0;
      }

      if ((now - recordingStartTimeRef.current) / 1000 >= CONFIG.MAX_RECORDING_DURATION_S) {
        stopRecording(true);
        setConvoState("aiThinking");
        return;
      }

      vadAnimationFrameRef.current = requestAnimationFrame(analyze);
    };

    vadAnimationFrameRef.current = requestAnimationFrame(analyze);
  }, [stopRecording]);

  const [isAutoMode, setIsAutoMode] = useState(false);

  const startManualRecord = async () => {
    unlockAudioContext();
    stopPlayback();
    const started = await startRecordingCore(() => setConvoState("idle"));
    if (started) {
      if (!vadAnimationFrameRef.current) {
         // Start dummy loop just for visualizer
         const updateVis = () => {
           if(recordingStateRef.current === "recording" && analyserNodeRef.current) {
             const freqData = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
             analyserNodeRef.current.getByteFrequencyData(freqData);
             setFrequencyData(new Uint8Array(freqData));
             vadAnimationFrameRef.current = requestAnimationFrame(updateVis);
           }
         };
         vadAnimationFrameRef.current = requestAnimationFrame(updateVis);
      }
    }
  };

  const stopManualRecord = () => {
    stopRecording(true);
    setConvoState("aiThinking");
  };

  const startAutoRecord = async () => {
    unlockAudioContext();
    stopPlayback();
    const started = await startRecordingCore();
    if (started) {
      startVADLoop();
    }
  };

  const stopAutoRecord = () => {
    stopRecording(true);
    setConvoState("aiThinking");
  };

  const stopAll = () => {
    stopRecording(false);
    stopPlayback();
    setConvoState("idle");
  };

  const selectTopic = async (topicId: string) => {
    if (!user) return;

    setTopicProfile((prev) => {
      const baseProfile = prev ?? createFallbackTopicProfile(user.userId);
      return { ...baseProfile, currentTopicId: topicId };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "select_topic", topicId }));
      return;
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/topic-profile/${user.userId}/current-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      const data = await res.json();
      if (data.profile) setTopicProfile(data.profile);
    } catch (e) {
      console.error(e);
      fetchTopicProfile();
    }
  };

  const activateArchiveRecommendation = async (recommendation: ArchiveRecommendation) => {
    if (!user) return false;
    unlockAudioContext();

    setTopicProfile((prev) => {
      const baseProfile = prev ?? createFallbackTopicProfile(user.userId);
      return { ...baseProfile, currentTopicId: recommendation.topicId };
    });
    setSubtitle(recommendation.question);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "start_recommendation_question",
      topicId: recommendation.topicId,
      question: recommendation.question,
      title: recommendation.title,
      sourceType: recommendation.sourceType,
      sourceId: recommendation.sourceId,
    }));
    return true;
  };

  return {
    user,
    wsConnected,
    networkStatus,
    convoState,
    subtitle,
    hasBiography,
    topicProfile,
    archive,
    userStats,
    chatHistory,
    frequencyData,
    login,
    register,
    setPassword,
    logout,
    startManualRecord,
    stopManualRecord,
    startAutoRecord,
    stopAutoRecord,
    stopAll,
    selectTopic,
    fetchArchive,
    activateArchiveRecommendation,
    unlockAudioContext
  };
}
