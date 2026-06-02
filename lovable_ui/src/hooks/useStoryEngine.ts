import { useState, useEffect, useRef, useCallback } from "react";
import {
  createFallbackTopicProfile,
  type BiographyTopic,
  type TopicProfile,
  type TopicStatus,
} from "../lib/biographyTopics";
import { isAudioPlaybackAllowed } from "../lib/audioSessionGuard";
import type { ArchiveRecommendation, BiographyBook, MyArchiveView } from "../lib/archiveTypes";
import {
  buildFontScaleCssValue,
  loadLocalUserPreferences,
  normalizeUserPreferences,
  saveLocalUserPreferences,
  type UserPreferences,
} from "../lib/userPreferences.js";
import { getRuntimeConfig } from "../lib/runtimeConfig.js";
import { upsertSessionEntryMessage } from "../lib/sessionEntryMessage.js";
import {
  clearPendingTurn,
  getPendingTurnStorage,
  loadPendingTurn,
  savePendingTurn,
  type PendingTurnInputMode,
} from "../lib/pendingTurnRecovery.js";
import {
  createVoiceDraftMessage,
  failVoiceTranscript,
  finalizeVoiceTranscript,
  type VoiceMessageMode,
  type VoiceMessageStatus,
} from "../lib/voiceTranscript.js";

const runtimeConfig = getRuntimeConfig(import.meta.env);

const CONFIG = {
  API_BASE: runtimeConfig.apiBase,
  WS_URL: runtimeConfig.wsUrl,
  RECONNECT: { BASE_DELAY: 1000, MAX_DELAY: 30000, MULTIPLIER: 2 },
  AUDIO: { TARGET_SAMPLE_RATE: 16000, BUFFER_SIZE: 4096 },
  VAD: { FFT_SIZE: 2048, SMOOTHING: 0.8 },
  MAX_RECORDING_DURATION_S: 180,
  TABLE_MODE_ENDS_ON_EXPLICIT_FINISH: true,
};

// Global audio context and instances to prevent issues during fast re-renders
let sharedAudioContext: window.AudioContext | null = null;
let audioUnlocked = false;

export type User = {
  userId: string;
  phone: string;
  name: string;
  age?: number | null;
  authToken?: string;
};
export type UserProfileUpdate = {
  name: string;
  age?: string | number | null;
};
export type AccountDeletionInput = {
  password: string;
  confirmText: string;
};
export type ConvoState = "idle" | "userRecording" | "aiThinking" | "aiTalking";
export type ChatMessage = {
  id: number;
  role: "ai" | "user";
  text: string;
  status?: VoiceMessageStatus;
  turnId?: string;
  mode?: VoiceMessageMode;
  source?: "entry_guidance" | "topic_switch_opening";
  entryGuidanceId?: string;
};
export type LegalConsentInput = {
  acceptedLegalTerms: boolean;
  acceptedPersonalInfoProcessing: boolean;
};
export type ServerEntryGuidance = {
  mode: "new_user" | "returning_user";
  topicId: string;
  topicTitle: string;
  displayText: string;
  speechText: string;
  nextQuestion: string;
  shouldAutoSpeak: boolean;
};
export type TopicTransitionPrompt = {
  kind: "switch" | "all_rich";
  currentTopicId: string;
  currentTopicTitle: string;
  nextTopicId: string;
  nextTopicTitle: string;
  text: string;
};
type BiographyDownloadFormat = "pdf" | "docx";
export type { BiographyTopic, TopicProfile, TopicStatus };

export function useStoryEngine() {
  const [user, setUser] = useState<User | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">("offline");
  const [convoState, setConvoState] = useState<ConvoState>("idle");
  const [aiThinkingText, setAiThinkingText] = useState("我在接着整理您的故事...");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [subtitle, setSubtitle] = useState("");
  const [recorderError, setRecorderError] = useState("");
  const [userStats, setUserStats] = useState({ totalConversations: 0, estimatedDurationMin: 0 });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [hasBiography, setHasBiography] = useState(false);
  const [topicProfile, setTopicProfile] = useState<TopicProfile | null>(null);
  const [serverEntryGuidance, setServerEntryGuidance] = useState<ServerEntryGuidance | null>(null);
  const [pendingTopicTransition, setPendingTopicTransition] =
    useState<TopicTransitionPrompt | null>(null);
  const [archive, setArchive] = useState<MyArchiveView | null>(null);
  const [biographies, setBiographies] = useState<BiographyBook[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() =>
    loadLocalUserPreferences(),
  );

  // References for mutable state that doesn't need to trigger renders
  const wsRef = useRef<WebSocket | null>(null);
  const userRef = useRef<User | null>(null);
  const intentionalWsCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectWebSocketRef = useRef<(() => void) | null>(null);
  const userPreferencesRef = useRef<UserPreferences>(userPreferences);
  const preferenceSyncVersionRef = useRef(0);
  const inputModeRef = useRef<"voice" | "text">("voice");

  // Audio Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<window.ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<window.MediaStreamAudioSourceNode | null>(null);
  const vadAnimationFrameRef = useRef<number | null>(null);

  const recordingStateRef = useRef<"idle" | "recording">("idle");
  const recordingStartTimeRef = useRef(0);
  const explicitStopCallbackRef = useRef<(() => void) | null>(null);
  const activeVoiceTurnRef = useRef<{ turnId: string; mode: VoiceMessageMode } | null>(null);

  // Playback Refs
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<window.AudioBufferSourceNode | null>(null);
  const activeAudioSessionRef = useRef<number | null>(null);
  const audioSessionCounterRef = useRef(0);
  const ignoreIncomingAudioRef = useRef(false);

  // Expose frequency data for UI visualizer
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    userRef.current = user;
    userPreferencesRef.current = userPreferences;
    document.documentElement.style.fontSize = buildFontScaleCssValue(userPreferences);
  }, [user, userPreferences]);

  useEffect(() => {
    inputModeRef.current = inputMode;
  }, [inputMode]);

  useEffect(() => {
    if (convoState !== "aiThinking") {
      setAiThinkingText("我在接着整理您的故事...");
      return;
    }

    const timer = window.setTimeout(() => {
      setAiThinkingText("网络有点慢，我正在换个方式接上...");
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [convoState]);

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

  const login = async (phone: string, password: string, consent: LegalConsentInput) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password, consent }),
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

  const register = async (
    phone: string,
    name: string,
    age: string,
    password: string,
    consent: LegalConsentInput,
  ) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, age: age ? parseInt(age) : null, password, consent }),
    });
    const result = await res.json();
    if (result.success) {
      setUser(result);
      localStorage.setItem("story_user", JSON.stringify(result));
      return { success: true };
    }
    return { success: false, message: result.message };
  };

  const setPassword = async (phone: string, password: string, consent: LegalConsentInput) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/users/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password, consent }),
    });
    const result = await res.json();
    if (result.success) {
      setUser(result);
      localStorage.setItem("story_user", JSON.stringify(result));
      return { success: true };
    }
    return { success: false, message: result.message };
  };

  // 模块：无差别一键准入流线。静默分流 — 后台查询手机号是否已注册。
  const checkPhone = async (phone: string) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/check-phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    return res.json() as Promise<{ success: boolean; exists: boolean }>;
  };

  // 模块：验证码统一入口。开发模式接受任意 6 位数字，生产环境接入真实短信。
  const verifyCode = async (input: {
    phone: string;
    code: string;
    consent: LegalConsentInput;
    name?: string;
    age?: string;
  }) => {
    const res = await fetch(`${CONFIG.API_BASE}/api/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: input.phone,
        code: input.code,
        consent: input.consent,
        name: input.name,
        age: input.age ? parseInt(input.age) : null,
      }),
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
    setServerEntryGuidance(null);
    setPendingTopicTransition(null);
    setFrequencyData(null);
    setArchive(null);
    setBiographies([]);
    localStorage.removeItem("story_user");
    clearPendingTurn(getPendingTurnStorage());
    closeWebSocket();
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

  const fetchBiographies = async () => {
    if (!user) return [];
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/biographies/${user.userId}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setBiographies(list);
      return list as BiographyBook[];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // 模块：用户偏好同步。前端先本地即时生效，并用版本号避免旧的网络响应覆盖新设置。
  const applyIncomingUserPreferences = (
    input: Partial<UserPreferences>,
    sourceVersion = preferenceSyncVersionRef.current,
  ) => {
    if (sourceVersion < preferenceSyncVersionRef.current) {
      return userPreferencesRef.current;
    }
    const preferences = saveLocalUserPreferences(localStorage, input);
    userPreferencesRef.current = preferences;
    setUserPreferences(preferences);
    return preferences;
  };

  const fetchUserPreferences = async () => {
    if (!user) return userPreferencesRef.current;
    const requestVersion = preferenceSyncVersionRef.current;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/user-preferences/${user.userId}`);
      const data = await res.json();
      if (data.success && data.preferences) {
        if (requestVersion !== preferenceSyncVersionRef.current) return userPreferencesRef.current;
        return applyIncomingUserPreferences(data.preferences, requestVersion);
      }
    } catch (e) {
      console.error(e);
    }
    return userPreferencesRef.current;
  };

  const updateUserPreferences = async (updates: Partial<UserPreferences>) => {
    const requestVersion = ++preferenceSyncVersionRef.current;
    const next = applyIncomingUserPreferences({
      ...userPreferencesRef.current,
      ...updates,
    }, requestVersion);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "update_preferences",
          preferences: next,
          syncVersion: requestVersion,
        }),
      );
    }

    if (!user) return next;

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/user-preferences/${user.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: next }),
      });
      const data = await res.json();
      if (data.success && data.preferences) {
        if (requestVersion !== preferenceSyncVersionRef.current) return userPreferencesRef.current;
        applyIncomingUserPreferences(data.preferences, requestVersion);
      }
    } catch (e) {
      console.error(e);
    }

    return userPreferencesRef.current;
  };

  // 模块：账号资料同步。只更新姓名和年龄，并把最新资料写回本地登录态，保证标题和导出链路读取一致。
  const updateUserProfile = async (updates: UserProfileUpdate) => {
    if (!user) {
      return { success: false, message: "请先登录" };
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/user/${user.userId}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.authToken || ""}`,
        },
        body: JSON.stringify(updates),
      });
      const result = await res.json();

      if (!result.success) {
        return { success: false, message: result.message || "资料保存失败，请稍后再试" };
      }

      const nextUser: User = {
        userId: result.userId || user.userId,
        phone: result.phone || user.phone,
        name: result.name || user.name,
        age: result.age ?? null,
        authToken: result.authToken || user.authToken,
      };

      setUser(nextUser);
      localStorage.setItem("story_user", JSON.stringify(nextUser));
      return { success: true, user: nextUser };
    } catch (e) {
      console.error(e);
      return { success: false, message: "网络错误，请稍后再试" };
    }
  };

  // 模块：账号注销。确认服务端已完成级联删除后，再清理本地登录态和音频会话。
  const deleteAccount = async (input: AccountDeletionInput) => {
    if (!user) {
      return { success: false, message: "请先登录" };
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/user/${user.userId}/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.authToken || ""}`,
        },
        body: JSON.stringify(input),
      });
      const result = await res.json();

      if (!result.success) {
        return { success: false, message: result.message || "账号注销失败，请稍后再试" };
      }

      logout();
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, message: "网络错误，请稍后再试" };
    }
  };

  useEffect(() => {
    if (user) {
      setTopicProfile((prev) => prev ?? createFallbackTopicProfile(user.userId));
      fetchUserPreferences();
      fetchStats();
      fetchTopicProfile();
      fetchBiographies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Audio Context Init
  const initAudioContext = useCallback(() => {
    if (!sharedAudioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("当前浏览器不支持音频上下文");
      }
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

  // 模块：语音轮次协议。每次录音都有独立 turnId，避免长录音和旧 WebSocket 音频串线。
  const createTurnId = (prefix: "voice" | "text") =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 模块：当前标签页 pending turn 协议。只允许恢复本 tab 未完成的指定 turnId，正常登录不恢复历史 completed turn。
  const loadCurrentPendingTurn = () => {
    const currentUser = userRef.current;
    return loadPendingTurn(getPendingTurnStorage(), currentUser?.userId || "");
  };

  const rememberPendingTurn = ({
    turnId,
    inputMode: pendingInputMode,
  }: {
    turnId?: string;
    inputMode: PendingTurnInputMode;
  }) => {
    const currentUser = userRef.current;
    if (!currentUser?.userId || !turnId) return null;
    return savePendingTurn(getPendingTurnStorage(), {
      userId: currentUser.userId,
      turnId,
      inputMode: pendingInputMode,
    });
  };

  const clearCurrentPendingTurn = () => {
    clearPendingTurn(getPendingTurnStorage());
  };

  const clearPendingTurnIfMatches = (turnId?: string) => {
    const pendingTurn = loadCurrentPendingTurn();
    if (!pendingTurn) return;
    if (!turnId || pendingTurn.turnId === turnId) {
      clearCurrentPendingTurn();
    }
  };

  const requestLatestTurnRecovery = () => {
    const pendingTurn = loadCurrentPendingTurn();
    if (!pendingTurn) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "recover_latest_turn", turnId: pendingTurn.turnId }));
  };

  // 模块：WebSocket 生命周期管理。区分主动关闭和异常掉线，避免清理旧连接时触发重连循环。
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    intentionalWsCloseRef.current = true;
    clearReconnectTimer();

    const socket = wsRef.current;
    wsRef.current = null;
    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close(1000, "client closed intentionally");
    }

    setWsConnected(false);
    setNetworkStatus("offline");
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    if (!userRef.current) return;

    clearReconnectTimer();
    const delay = Math.min(
      CONFIG.RECONNECT.BASE_DELAY *
        Math.pow(CONFIG.RECONNECT.MULTIPLIER, reconnectAttemptsRef.current),
      CONFIG.RECONNECT.MAX_DELAY,
    );
    reconnectAttemptsRef.current++;
    reconnectTimerRef.current = setTimeout(() => {
      connectWebSocketRef.current?.();
    }, delay);
  }, [clearReconnectTimer]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      closeWebSocket();
    }
    intentionalWsCloseRef.current = false;
    setNetworkStatus("offline");

    let socket: WebSocket;
    try {
      socket = new WebSocket(CONFIG.WS_URL);
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;
    } catch (e) {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      clearReconnectTimer();
      setWsConnected(true);
      setNetworkStatus("online");
      reconnectAttemptsRef.current = 0;
      const currentUser = userRef.current;
      if (currentUser) {
        socket.send(
          JSON.stringify({
            type: "login",
            phone: currentUser.phone,
            authToken: currentUser.authToken,
            userPreferences: userPreferencesRef.current,
          }),
        );
      }
    };

    socket.onmessage = async (event) => {
      if (wsRef.current !== socket) return;
      if (typeof event.data === "string") {
        handleJsonMessage(event.data);
      } else {
        handleAudioMessage(event.data);
      }
    };

    socket.onclose = (e) => {
      if (wsRef.current !== socket) return;
      wsRef.current = null;
      setWsConnected(false);
      setNetworkStatus("offline");
      if (!intentionalWsCloseRef.current && userRef.current && e.code !== 1000) {
        scheduleReconnect();
      }
      intentionalWsCloseRef.current = false;
    };

    socket.onerror = () => {
      if (wsRef.current !== socket) return;
      setWsConnected(false);
      setNetworkStatus("offline");
    };
  }, [clearReconnectTimer, closeWebSocket, scheduleReconnect]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    if (user) connectWebSocket();
    return () => {
      activeAudioSessionRef.current = null;
      stopPlayback();
      stopRecording(false);
      closeWebSocket();
    };
  }, [user, connectWebSocket, closeWebSocket]);

  // Handle incoming WS JSON
  const handleJsonMessage = (jsonStr: string) => {
    try {
      const msg = JSON.parse(jsonStr);
      const appendAiMessage = (text?: string, turnId?: string) => {
        if (!text) return;
        setChatHistory((prev) => {
          if (turnId && prev.some((item) => item.role === "ai" && item.turnId === turnId)) {
            return prev;
          }
          return [...prev, { id: Date.now(), role: "ai", text, turnId }];
        });
      };
      const appendUserMessage = (text?: string, turnId?: string) => {
        if (!text) return;
        setChatHistory((prev) => {
          if (turnId && prev.some((item) => item.role === "user" && item.turnId === turnId)) {
            return prev;
          }
          return [...prev, { id: Date.now(), role: "user", text, turnId }];
        });
      };

      if (msg.event === "input_mode_updated") {
        if (msg.inputMode === "text" || msg.inputMode === "voice") {
          inputModeRef.current = msg.inputMode;
          setInputMode(msg.inputMode);
        }
        return;
      }

      if (msg.event === "ai_text_response") {
        const text = msg.text || "";
        appendAiMessage(text, msg.turnId);
        clearPendingTurnIfMatches(msg.turnId);
        setSubtitle(text);
        setConvoState("idle");
        fetchStats();
        fetchArchive();
        return;
      }

      if (msg.event === "turn_accepted") {
        setAiThinkingText(msg.text || "我在接着整理您的故事...");
        setConvoState("aiThinking");
        return;
      }

      if (msg.event === "turn_busy") {
        clearPendingTurnIfMatches(msg.turnId);
        setAiThinkingText(msg.text || "我在接着整理您的故事...");
        setConvoState("aiThinking");
        return;
      }

      if (msg.event === "turn_completed") {
        const text = msg.text || "";
        appendAiMessage(text, msg.turnId);
        clearPendingTurnIfMatches(msg.turnId);
        setSubtitle(text);
        setConvoState(msg.status === "ai_speaking" ? "aiTalking" : "idle");
        if (msg.status === "ready") {
          fetchStats();
          fetchArchive();
        }
        return;
      }

      if (msg.event === "turn_recovered") {
        const pendingTurn = loadCurrentPendingTurn();
        if (!pendingTurn || pendingTurn.turnId !== msg.turnId) {
          return;
        }
        const text = msg.text || "";
        appendUserMessage(msg.userText, msg.turnId);
        appendAiMessage(text, msg.turnId);
        clearPendingTurnIfMatches(msg.turnId);
        setSubtitle(text);
        setConvoState("idle");
        fetchStats();
        fetchArchive();
        return;
      }

      if (msg.event === "text_input_error") {
        const message = msg.text || "文字发送失败，请再试一次。";
        clearPendingTurnIfMatches(msg.turnId);
        setRecorderError(message);
        setSubtitle(message);
        setConvoState("idle");
        return;
      }

      if (msg.status === "ready" && msg.user) {
        setConvoState("idle");
        setSubtitle(msg.text || "");
        setPendingTopicTransition(null);
        if (msg.hasBiography !== undefined) setHasBiography(msg.hasBiography);
        if (msg.entryGuidance) {
          setServerEntryGuidance(msg.entryGuidance);
          setChatHistory(
            (prev) =>
              upsertSessionEntryMessage(prev, {
                entryGuidance: msg.entryGuidance,
              }) as ChatMessage[],
          );
        }
        if (msg.preferences) {
          applyIncomingUserPreferences(msg.preferences);
        }
        if (msg.topicProfile) {
          setTopicProfile(msg.topicProfile);
        } else {
          setTopicProfile(createFallbackTopicProfile(msg.user.userId));
        }
        fetchStats();
        requestLatestTurnRecovery();
      }
      if (msg.event === "topic_profile_updated" && msg.topicProfile) {
        setTopicProfile(msg.topicProfile);
      }
      if (msg.event === "topic_transition_prompt" && msg.transition) {
        setPendingTopicTransition(msg.transition);
        setSubtitle(msg.text || msg.transition.text || "");
        if (msg.status !== "ai_speaking") appendAiMessage(msg.text || msg.transition.text || "");
      }
      if (msg.event === "topic_transition_resolved") {
        setPendingTopicTransition(null);
        if (msg.topicProfile) setTopicProfile(msg.topicProfile);
      }
      if (msg.event === "topic_switch_opening") {
        setPendingTopicTransition(null);
        setSubtitle(msg.text || "");
        if (msg.status !== "ai_speaking") appendAiMessage(msg.text || "");
      }
      if (msg.event === "recommendation_question_started") {
        setSubtitle(msg.text || "");
        if (msg.status !== "ai_speaking") appendAiMessage(msg.text || "");
      }
      if (msg.event === "preferences_updated" && msg.preferences) {
        const sourceVersion =
          typeof msg.syncVersion === "number"
            ? msg.syncVersion
            : preferenceSyncVersionRef.current;
        applyIncomingUserPreferences(msg.preferences, sourceVersion);
      }
      if (msg.event === "user_transcript") {
        setChatHistory(
          (prev) =>
            finalizeVoiceTranscript(prev, {
              turnId: msg.turnId,
              text: msg.text,
              mode: msg.mode,
            }) as ChatMessage[],
        );
        return;
      }
      if (msg.event === "user_transcript_failed") {
        const message = msg.text || "没有听清，请再说一次。";
        clearPendingTurnIfMatches(msg.turnId);
        setChatHistory((prev) =>
          failVoiceTranscript(prev, {
            turnId: msg.turnId,
            message,
          }),
        );
        setRecorderError(message);
        return;
      }
      if (msg.status === "ai_thinking") setConvoState("aiThinking");
      if (msg.status === "ai_speaking") setConvoState("aiTalking");
      if (msg.status === "ready" && !msg.user) setConvoState("idle");

      if (msg.text) {
        setSubtitle(msg.text);
        if (msg.status === "ai_speaking") {
          appendAiMessage(msg.text, msg.turnId);
        }
      }

      if (msg.event === "ai_response_end") {
        if (msg.turnId) clearPendingTurnIfMatches(msg.turnId);
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
    if (ignoreIncomingAudioRef.current) return;

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
      setConvoState((prev) => (prev === "aiTalking" ? "idle" : prev));
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
      try {
        currentSourceRef.current.stop();
      } catch (error) {
        console.warn("[audio] stop playback failed", error);
      }
      currentSourceRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // Recording logic
  const startRecordingCore = async ({
    mode,
    onStop,
  }: {
    mode: VoiceMessageMode;
    onStop?: () => void;
  }) => {
    if (recordingStateRef.current === "recording") return false;

    setRecorderError("");

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setRecorderError("手机录音需要 HTTPS 环境，请使用正式域名或 HTTPS 测试地址。");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError("当前浏览器不支持麦克风录音。");
      return false;
    }

    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
    } catch (e) {
      setRecorderError("麦克风没有开启，请允许浏览器使用麦克风。");
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
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
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
    explicitStopCallbackRef.current = onStop || null;

    const voiceTurn = {
      turnId: createTurnId("voice"),
      mode,
    };
    activeVoiceTurnRef.current = voiceTurn;
    rememberPendingTurn({ turnId: voiceTurn.turnId, inputMode: "voice" });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: "user_speech_started",
          turnId: voiceTurn.turnId,
          mode: voiceTurn.mode,
        }),
      );
    }

    setChatHistory((prev) => [
      ...prev,
      createVoiceDraftMessage({
        turnId: voiceTurn.turnId,
        mode: voiceTurn.mode,
      }),
    ]);
    setConvoState("userRecording");
    return true;
  };

  const stopRecording = useCallback((sendEvent = true) => {
    const wasRecording = recordingStateRef.current === "recording";
    if (!wasRecording) {
      return false;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      try {
        scriptProcessorRef.current.disconnect();
      } catch (error) {
        console.warn("[audio] disconnect recorder processor failed", error);
      }
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (error) {
        console.warn("[audio] disconnect recorder source failed", error);
      }
      sourceNodeRef.current = null;
    }
    recordingStateRef.current = "idle";

    if (vadAnimationFrameRef.current) {
      cancelAnimationFrame(vadAnimationFrameRef.current);
      vadAnimationFrameRef.current = null;
    }

    const voiceTurn = activeVoiceTurnRef.current;
    activeVoiceTurnRef.current = null;

    if (sendEvent && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      rememberPendingTurn({ turnId: voiceTurn?.turnId, inputMode: "voice" });
      wsRef.current.send(
        JSON.stringify({
          event: "user_speech_ended",
          turnId: voiceTurn?.turnId,
          mode: voiceTurn?.mode,
        }),
      );
    } else if (voiceTurn?.turnId) {
      clearPendingTurnIfMatches(voiceTurn.turnId);
    }

    if (explicitStopCallbackRef.current) {
      explicitStopCallbackRef.current();
      explicitStopCallbackRef.current = null;
    }

    return true;
  }, []);

  // 模块：输入方式同步。文字模式会立即停掉录音和朗读，避免继续占用麦克风或播放 TTS。
  const sendInputModeToServer = (mode: "voice" | "text") => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "set_input_mode",
          inputMode: mode,
        }),
      );
    }
  };

  const enterTextInputMode = () => {
    inputModeRef.current = "text";
    setInputMode("text");
    ignoreIncomingAudioRef.current = true;
    activeAudioSessionRef.current = null;
    stopRecording(false);
    stopPlayback();
    setRecorderError("");
    setConvoState((prev) => (prev === "aiTalking" || prev === "userRecording" ? "idle" : prev));
    sendInputModeToServer("text");
  };

  const enterVoiceInputMode = () => {
    inputModeRef.current = "voice";
    setInputMode("voice");
    ignoreIncomingAudioRef.current = false;
    audioSessionCounterRef.current += 1;
    activeAudioSessionRef.current = audioSessionCounterRef.current;
    sendInputModeToServer("voice");
  };

  // 模块：录音可视化循环。录音上传只由“讲完了”结束，循环不再用静音截断用户。
  const startVADLoop = useCallback(() => {
    if (!analyserNodeRef.current) return;
    const analyser = analyserNodeRef.current;

    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const analyze = () => {
      if (recordingStateRef.current !== "recording") return;

      analyser.getByteFrequencyData(freqData);
      setFrequencyData(new Uint8Array(freqData));

      const now = Date.now();
      if ((now - recordingStartTimeRef.current) / 1000 >= CONFIG.MAX_RECORDING_DURATION_S) {
        setRecorderError("录音已到最长时间，正在整理前面内容。");
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
    enterVoiceInputMode();
    unlockAudioContext();
    stopPlayback();
    const started = await startRecordingCore({
      mode: "hold",
      onStop: () => setConvoState("idle"),
    });
    if (started) {
      if (!vadAnimationFrameRef.current) {
        // Start dummy loop just for visualizer
        const updateVis = () => {
          if (recordingStateRef.current === "recording" && analyserNodeRef.current) {
            const freqData = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
            analyserNodeRef.current.getByteFrequencyData(freqData);
            setFrequencyData(new Uint8Array(freqData));
            vadAnimationFrameRef.current = requestAnimationFrame(updateVis);
          }
        };
        vadAnimationFrameRef.current = requestAnimationFrame(updateVis);
      }
    }
    return started;
  };

  const stopManualRecord = () => {
    const stopped = stopRecording(true);
    if (stopped) {
      setConvoState("aiThinking");
    }
  };

  const startAutoRecord = async () => {
    enterVoiceInputMode();
    unlockAudioContext();
    stopPlayback();
    const started = await startRecordingCore({
      mode: "table",
    });
    if (started) {
      startVADLoop();
    }
    return started;
  };

  const stopAutoRecord = () => {
    const stopped = stopRecording(true);
    if (stopped) {
      setConvoState("aiThinking");
    }
  };

  const stopAll = () => {
    stopRecording(false);
    stopPlayback();
    setConvoState("idle");
  };

  const sendTextMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setRecorderError("网络未连接，请稍后再试。");
      return false;
    }

    enterTextInputMode();
    setRecorderError("");
    const turnId = createTurnId("text");
    rememberPendingTurn({ turnId, inputMode: "text" });
    setChatHistory((prev) => [...prev, { id: Date.now(), role: "user", text: trimmed, turnId }]);
    setConvoState("aiThinking");
    wsRef.current.send(
      JSON.stringify({
        type: "user_text_message",
        inputMode: "text",
        turnId,
        text: trimmed,
      }),
    );
    return true;
  };

  const selectTopic = async (topicId: string) => {
    if (!user) return;
    setPendingTopicTransition(null);

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

  // 模块：富主题换题选择。按钮只是辅助入口，语音里的“继续/换一个”由后端同一套协议处理。
  const respondTopicTransition = (choice: "continue" | "switch" | "review") => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;

    wsRef.current.send(
      JSON.stringify({
        type: "topic_transition_choice",
        choice,
        topicId: choice === "switch" ? pendingTopicTransition?.nextTopicId || "" : "",
      }),
    );
    return true;
  };

  const activateArchiveRecommendation = async (recommendation: ArchiveRecommendation) => {
    if (!user) return false;
    unlockAudioContext();
    setPendingTopicTransition(null);

    setTopicProfile((prev) => {
      const baseProfile = prev ?? createFallbackTopicProfile(user.userId);
      return { ...baseProfile, currentTopicId: recommendation.topicId };
    });
    setSubtitle(recommendation.question);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "start_recommendation_question",
        topicId: recommendation.topicId,
        question: recommendation.question,
        title: recommendation.title,
        sourceType: recommendation.sourceType,
        sourceId: recommendation.sourceId,
      }),
    );
    return true;
  };

  const generateBiography = async (style?: string) => {
    if (!user) return { success: false, error: "请先登录" };
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/biographies/${user.userId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBiographies();
        return { success: true, ...data };
      }
      return { success: false, error: data.error || "生成回忆录失败" };
    } catch (e) {
      console.error(e);
      return { success: false, error: "网络错误，请稍后再试" };
    }
  };

  const getExportFileName = (header: string | null, fallback: string) => {
    if (!header) return fallback;
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return fallback;
      }
    }
    const plainMatch = header.match(/filename="([^"]+)"/);
    return plainMatch?.[1] || fallback;
  };

  // 模块：回忆录文件下载。只下载已生成文件，不触发 AI 生成或语音合成。
  const downloadBiography = async (format: BiographyDownloadFormat) => {
    if (!user) return { success: false, error: "请先登录" };
    try {
      const res = await fetch(
        `${CONFIG.API_BASE}/api/biographies/${user.userId}/export?format=${format}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || "下载失败，请稍后再试。" };
      }

      const blob = await res.blob();
      const filename = getExportFileName(
        res.headers.get("Content-Disposition"),
        format === "pdf" ? "我的回忆录.pdf" : "我的回忆录.docx",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "网络错误，请稍后再试" };
    }
  };

  return {
    user,
    wsConnected,
    networkStatus,
    convoState,
    aiThinkingText,
    inputMode,
    subtitle,
    hasBiography,
    topicProfile,
    serverEntryGuidance,
    pendingTopicTransition,
    archive,
    biographies,
    userPreferences,
    userStats,
    chatHistory,
    frequencyData,
    recorderError,
    login,
    register,
    setPassword,
    checkPhone,
    verifyCode,
    logout,
    startManualRecord,
    stopManualRecord,
    startAutoRecord,
    stopAutoRecord,
    sendTextMessage,
    enterTextInputMode,
    enterVoiceInputMode,
    stopAll,
    selectTopic,
    respondTopicTransition,
    fetchArchive,
    fetchBiographies,
    generateBiography,
    downloadBiography,
    activateArchiveRecommendation,
    updateUserPreferences,
    updateUserProfile,
    deleteAccount,
    unlockAudioContext,
  };
}
