/**
 * 故事坊 MVP - 全语音交互前端核心逻辑
 *
 * 架构概览：
 * ┌─────────────┐    PCM音频流    ┌─────────────┐    腾讯云API    ┌─────────────┐
 * │   前端 H5    │──────────────►│   后端服务    │──────────────►│  腾讯云ASR   │
 * │  麦克风采集   │◄──────────────│  WebSocket   │◄──────────────│  混元+TTS   │
 * └─────────────┘    MP3音频流    └─────────────┘               └─────────────┘
 *
 * 用户体系：
 * - 登录/注册 → userId 存入 localStorage
 * - WebSocket 连接后发送 login 指令绑定用户
 * - 所有对话数据关联到 userId
 */

/* ============================================================
   第一部分：配置常量
   ============================================================ */

const CONFIG = {
    WS_URL: 'ws://localhost:8000/ws/chat',
    RECONNECT: {
        BASE_DELAY: 1000,
        MAX_DELAY: 30000,
        MULTIPLIER: 2,
    },
    AUDIO: {
        TARGET_SAMPLE_RATE: 16000,
        BUFFER_SIZE: 4096,
    },
    VAD: {
        SILENCE_THRESHOLD_DB: -45,
        SILENCE_DURATION_MS: 3500,
        FFT_SIZE: 2048,
        SMOOTHING: 0.8,
    },
    MAX_RECORDING_DURATION_S: 180,
};

/* ============================================================
   第二部分：全局状态管理
   ============================================================ */

const state = {
    mode: 'manual',
    recordingState: 'idle',
    playbackState: 'idle',

    // 用户信息
    user: null, // { userId, phone, name, age }

    // WebSocket
    wsConnected: false,
    wsReconnectAttempts: 0,
    wsReconnectTimer: null,

    // 音频
    mediaStream: null,
    audioContext: null,
    analyserNode: null,
    scriptProcessor: null,
    sourceNode: null,

    // VAD
    recordingStartTime: 0,
    silenceStartTime: 0,
    isSilent: false,
    vadAnimationFrame: null,
    visualizerFrame: null,

    // 播放
    playbackQueue: [],
    isPlaying: false,
    currentSource: null,

    // iOS
    audioUnlocked: false,
};

/* ============================================================
   第三部分：DOM 元素引用
   ============================================================ */

const DOM = {
    // 登录页面
    authPage: document.getElementById('authPage'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginPhone: document.getElementById('loginPhone'),
    loginBtn: document.getElementById('loginBtn'),
    regPhone: document.getElementById('regPhone'),
    regName: document.getElementById('regName'),
    regAge: document.getElementById('regAge'),
    registerBtn: document.getElementById('registerBtn'),
    showRegister: document.getElementById('showRegister'),
    showLogin: document.getElementById('showLogin'),
    authError: document.getElementById('authError'),

    // 聊天页面
    chatPage: document.getElementById('chatPage'),
    userName: document.getElementById('userName'),
    userStats: document.getElementById('userStats'),
    logoutBtn: document.getElementById('logoutBtn'),
    statusText: document.getElementById('statusText'),
    visualizerContainer: document.getElementById('visualizerContainer'),
    visualizer: document.getElementById('visualizer'),
    micBtn: document.getElementById('micBtn'),
    stopBtn: document.getElementById('stopBtn'),
    modeManual: document.getElementById('modeManual'),
    modeAuto: document.getElementById('modeAuto'),
    generateBtn: document.getElementById('generateBtn'),
    biographyStatus: document.getElementById('biographyStatus'),
    subtitleText: document.getElementById('subtitleText'),
    networkOverlay: document.getElementById('networkOverlay'),
};

/* ============================================================
   第四部分：初始化入口
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[故事坊] 应用初始化...');
    bindEvents();
    checkAuthState();
});

/**
 * 检查登录状态
 * 如果 localStorage 中有用户信息，直接进入聊天页面
 */
function checkAuthState() {
    const savedUser = localStorage.getItem('story_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
            showChatPage();
            connectWebSocket();
        } catch (e) {
            localStorage.removeItem('story_user');
            showAuthPage();
        }
    } else {
        showAuthPage();
    }
}

/* ============================================================
   第五部分：页面切换
   ============================================================ */

function showAuthPage() {
    DOM.authPage.classList.remove('hidden');
    DOM.chatPage.classList.add('hidden');
}

function showChatPage() {
    DOM.authPage.classList.add('hidden');
    DOM.chatPage.classList.remove('hidden');

    // 显示用户信息
    if (state.user) {
        DOM.userName.textContent = state.user.name;
        loadUserStats();
    }
}

/**
 * 加载用户统计信息
 */
async function loadUserStats() {
    if (!state.user) return;
    try {
        const res = await fetch(`/api/stats/${state.user.userId}`);
        const stats = await res.json();
        DOM.userStats.textContent = `已记录 ${stats.totalConversations} 条对话，约 ${stats.estimatedDurationMin} 分钟`;
    } catch (e) {
        console.error('加载统计失败:', e);
    }
}

/* ============================================================
   第六部分：登录/注册逻辑
   ============================================================ */

/**
 * 用户登录
 */
async function login() {
    const phone = DOM.loginPhone.value.trim();

    if (!phone || phone.length !== 11) {
        showAuthError('请输入11位手机号');
        return;
    }

    DOM.loginBtn.disabled = true;
    const btnText = DOM.loginBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = '登录中...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        const result = await res.json();

        if (result.success) {
            state.user = result;
            localStorage.setItem('story_user', JSON.stringify(result));
            showChatPage();
            connectWebSocket();
            clearAuthError();
        } else {
            showAuthError(result.message || '登录失败');
        }
    } catch (e) {
        showAuthError('网络错误，请重试');
    } finally {
        DOM.loginBtn.disabled = false;
        const btnText = DOM.loginBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '登录';
    }
}

/**
 * 用户注册
 */
async function register() {
    const phone = DOM.regPhone.value.trim();
    const name = DOM.regName.value.trim();
    const age = DOM.regAge.value.trim();

    if (!phone || phone.length !== 11) {
        showAuthError('请输入11位手机号');
        return;
    }

    if (!name) {
        showAuthError('请输入姓名');
        return;
    }

    DOM.registerBtn.disabled = true;
    const btnText = DOM.registerBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = '注册中...';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, name, age: age ? parseInt(age) : null }),
        });
        const result = await res.json();

        if (result.success) {
            state.user = result;
            localStorage.setItem('story_user', JSON.stringify(result));
            showChatPage();
            connectWebSocket();
            clearAuthError();
        } else {
            showAuthError(result.message || '注册失败');
        }
    } catch (e) {
        showAuthError('网络错误，请重试');
    } finally {
        DOM.registerBtn.disabled = false;
        const btnText = DOM.registerBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '注册';
    }
}

/**
 * 退出登录
 */
function logout() {
    localStorage.removeItem('story_user');
    state.user = null;

    // 断开 WebSocket
    if (state.ws) {
        state.ws.close(1000);
    }

    // 停止录音
    if (state.recordingState === 'recording') {
        stopRecording(false);
    }

    showAuthPage();
}

function showAuthError(msg) {
    DOM.authError.textContent = msg;
}

function clearAuthError() {
    DOM.authError.textContent = '';
}

/* ============================================================
   第七部分：WebSocket 连接模块
   ============================================================ */

function connectWebSocket() {
    if (state.ws && state.ws.readyState <= WebSocket.OPEN) {
        state.ws.close();
    }

    console.log(`[WebSocket] 正在连接 ${CONFIG.WS_URL}...`);
    updateStatus('正在连接服务器...');

    try {
        state.ws = new WebSocket(CONFIG.WS_URL);
        state.ws.binaryType = 'arraybuffer';
    } catch (err) {
        console.error('[WebSocket] 创建连接失败:', err);
        scheduleReconnect();
        return;
    }

    state.ws.onopen = () => {
        console.log('[WebSocket] 连接成功');
        state.wsConnected = true;
        state.wsReconnectAttempts = 0;
        hideNetworkOverlay();

        // 发送登录指令
        if (state.user) {
            sendJson({ type: 'login', phone: state.user.phone });
        }

        enableControls(true);
    };

    state.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
            handleJsonMessage(event.data);
        } else {
            handleAudioMessage(event.data);
        }
    };

    state.ws.onclose = (event) => {
        console.log(`[WebSocket] 连接关闭 code=${event.code}`);
        state.wsConnected = false;
        enableControls(false);
        if (event.code !== 1000) {
            scheduleReconnect();
        }
    };

    state.ws.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error);
        state.wsConnected = false;
    };
}

function handleJsonMessage(jsonStr) {
    let msg;
    try {
        msg = JSON.parse(jsonStr);
    } catch (e) {
        console.warn('[WebSocket] JSON 解析失败:', jsonStr);
        return;
    }

    console.log('[WebSocket] 收到指令:', msg);

    // 处理登录状态
    if (msg.status === 'need_login') {
        updateStatus('请先登录');
        return;
    }

    if (msg.status === 'ready' && msg.user) {
        // 登录成功
        updateStatus('请点击开始');
        showSubtitle(msg.text);
        loadUserStats();

        // 如果已有自传，隐藏生成按钮
        if (msg.hasBiography) {
            DOM.generateBtn.classList.add('hidden');
        } else {
            DOM.generateBtn.classList.remove('hidden');
        }

        // 清除之前的生成状态
        hideBiographyStatus();
        return;
    }

    if (msg.status === 'login_failed' || msg.status === 'register_failed') {
        showAuthError(msg.text);
        showAuthPage();
        return;
    }

    // 处理状态更新
    if (msg.status) {
        switch (msg.status) {
            case 'ai_thinking':
                updateStatus('AI正在思考...', 'thinking');
                break;
            case 'ai_speaking':
                updateStatus('正在播放...', 'listening');
                break;
            case 'ready':
                updateStatus('请点击开始');
                break;
        }
    }

    if (msg.text) {
        showSubtitle(msg.text);
    }

    if (msg.event === 'ai_response_end') {
        state.playbackState = 'idle';
        updateStatus('请点击开始');
        loadUserStats(); // 更新统计
    }
}

async function handleAudioMessage(arrayBuffer) {
    console.log(`[播放] 收到音频数据 ${arrayBuffer.byteLength} 字节`);

    if (!state.audioContext) {
        initAudioContext();
    }

    try {
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        state.playbackQueue.push(audioBuffer);

        if (!state.isPlaying) {
            playNextInQueue();
        }
    } catch (err) {
        console.error('[播放] 音频解码失败:', err);
    }
}

function playNextInQueue() {
    if (state.playbackQueue.length === 0) {
        state.isPlaying = false;
        state.playbackState = 'idle';
        return;
    }

    state.isPlaying = true;
    state.playbackState = 'playing';
    updateStatus('正在播放...', 'listening');

    const buffer = state.playbackQueue.shift();
    const source = state.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(state.audioContext.destination);

    source.onended = () => {
        state.currentSource = null;
        playNextInQueue();
    };

    state.currentSource = source;
    source.start(0);
}

function stopPlayback() {
    if (state.currentSource) {
        try {
            state.currentSource.onended = null;
            state.currentSource.stop();
        } catch (e) {}
        state.currentSource = null;
    }
    state.playbackQueue = [];
    state.isPlaying = false;
    state.playbackState = 'idle';
}

function scheduleReconnect() {
    if (state.wsReconnectTimer) {
        clearTimeout(state.wsReconnectTimer);
    }

    const delay = Math.min(
        CONFIG.RECONNECT.BASE_DELAY * Math.pow(CONFIG.RECONNECT.MULTIPLIER, state.wsReconnectAttempts),
        CONFIG.RECONNECT.MAX_DELAY
    );

    state.wsReconnectAttempts++;
    console.log(`[WebSocket] ${delay}ms 后重连 (第 ${state.wsReconnectAttempts} 次)`);
    showNetworkOverlay();

    state.wsReconnectTimer = setTimeout(() => {
        connectWebSocket();
    }, delay);
}

function sendJson(obj) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(obj));
        console.log('[WebSocket] 发送指令:', obj);
    }
}

function sendPcmData(arrayBuffer) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(arrayBuffer);
    }
}

/* ============================================================
   第八部分：音频采集模块
   ============================================================ */

function initAudioContext() {
    if (state.audioContext) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioCtx();

    state.analyserNode = state.audioContext.createAnalyser();
    state.analyserNode.fftSize = CONFIG.VAD.FFT_SIZE;
    state.analyserNode.smoothingTimeConstant = CONFIG.VAD.SMOOTHING;

    console.log('[AudioContext] 初始化完成, sampleRate:', state.audioContext.sampleRate);
}

async function initMicrophone() {
    if (state.mediaStream) return true;

    try {
        console.log('[录音] 请求麦克风权限...');
        state.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }
        });
        console.log('[录音] 麦克风权限获取成功');
        return true;
    } catch (err) {
        console.error('[录音] 麦克风权限被拒绝:', err);
        updateStatus('请允许麦克风权限');
        return false;
    }
}

async function startRecording(onStop) {
    if (state.recordingState === 'recording') {
        console.warn('[录音] 已在录制中，忽略重复调用');
        return false;
    }

    const micReady = await initMicrophone();
    if (!micReady) return false;
    initAudioContext();

    const ctx = state.audioContext;
    const sampleRate = ctx.sampleRate;

    state.sourceNode = ctx.createMediaStreamSource(state.mediaStream);
    state.scriptProcessor = ctx.createScriptProcessor(CONFIG.AUDIO.BUFFER_SIZE, 1, 1);

    const downsampleRatio = sampleRate / CONFIG.AUDIO.TARGET_SAMPLE_RATE;
    console.log(`[录音] 采样率: ${sampleRate}Hz, 降采样比率: ${downsampleRatio.toFixed(2)}`);

    state.scriptProcessor.onaudioprocess = (e) => {
        if (state.recordingState !== 'recording') return;

        const inputData = e.inputBuffer.getChannelData(0);

        // 降采样
        const newLength = Math.floor(inputData.length / downsampleRatio);
        const downsampled = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
            downsampled[i] = inputData[Math.floor(i * downsampleRatio)];
        }

        // 转换为 Int16 PCM
        const pcmBuffer = new ArrayBuffer(newLength * 2);
        const pcmView = new DataView(pcmBuffer);
        for (let i = 0; i < newLength; i++) {
            let sample = Math.max(-1, Math.min(1, downsampled[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            pcmView.setInt16(i * 2, sample, true);
        }

        sendPcmData(pcmBuffer);
    };

    state.sourceNode.connect(state.analyserNode);
    state.sourceNode.connect(state.scriptProcessor);
    state.scriptProcessor.connect(ctx.destination);

    state.recordingState = 'recording';
    state.recordingStartTime = Date.now();
    state.silenceStartTime = 0;
    state.isSilent = false;
    state._onStopCallback = onStop;

    console.log('[录音] 开始录制');
    return true;
}

function stopRecording(sendEvent = true) {
    if (state.scriptProcessor) {
        state.scriptProcessor.onaudioprocess = null;
        try { state.scriptProcessor.disconnect(); } catch (e) {}
        state.scriptProcessor = null;
    }

    if (state.sourceNode) {
        try { state.sourceNode.disconnect(); } catch (e) {}
        state.sourceNode = null;
    }

    state.recordingState = 'idle';
    console.log('[录音] 停止录制');

    if (state.vadAnimationFrame) {
        cancelAnimationFrame(state.vadAnimationFrame);
        state.vadAnimationFrame = null;
    }

    if (sendEvent) {
        sendJson({ event: 'user_speech_ended' });
    }

    if (state._onStopCallback) {
        state._onStopCallback();
        state._onStopCallback = null;
    }
}

/* ============================================================
   第九部分：模式一 - 按住说话
   ============================================================ */

function bindMicButtonEvents() {
    const btn = DOM.micBtn;
    let isPressed = false;

    const onPress = async (e) => {
        e.preventDefault();
        if (isPressed || state.mode !== 'manual') return;
        if (!state.wsConnected) return;

        isPressed = true;
        unlockAudioContext();

        const started = await startRecording(() => {
            updateStatus('AI正在思考...', 'thinking');
        });

        if (started) {
            btn.classList.add('recording');
            updateStatus('正在听您说…', 'recording');
            startVisualizer();
        } else {
            isPressed = false;
        }
    };

    const onRelease = (e) => {
        e.preventDefault();
        if (!isPressed || state.mode !== 'manual') return;

        isPressed = false;
        btn.classList.remove('recording');
        stopVisualizer();
        stopRecording(true);
    };

    btn.addEventListener('touchstart', onPress, { passive: false });
    btn.addEventListener('touchend', onRelease, { passive: false });
    btn.addEventListener('touchcancel', onRelease, { passive: false });
    btn.addEventListener('mousedown', onPress);
    btn.addEventListener('mouseup', onRelease);
    btn.addEventListener('mouseleave', (e) => {
        if (isPressed) onRelease(e);
    });
}

/* ============================================================
   第十部分：模式二 - 畅聊模式（VAD）
   ============================================================ */

async function enterAutoMode() {
    if (!state.wsConnected) {
        updateStatus('请先连接服务器');
        return;
    }

    unlockAudioContext();

    const started = await startRecording(() => {
        stopVisualizer();
        updateStatus('AI正在思考...', 'thinking');
    });

    if (!started) return;

    updateStatus('正在听您说…', 'recording');
    startVisualizer();
    startVADLoop();
}

function exitAutoMode() {
    stopRecording(true);
    stopVisualizer();
}

function startVADLoop() {
    const analyser = state.analyserNode;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    function analyze() {
        if (state.recordingState !== 'recording') return;

        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
            const offset = dataArray[i] - 128;
            sumSquares += offset * offset;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        const dB = rms === 0 ? -100 : 20 * Math.log10(rms / 128);

        const now = Date.now();
        const isSilentNow = dB < CONFIG.VAD.SILENCE_THRESHOLD_DB;

        if (isSilentNow) {
            if (!state.isSilent) {
                state.isSilent = true;
                state.silenceStartTime = now;
                console.log(`[VAD] 进入静音 dB=${dB.toFixed(1)}`);
            }

            const silenceDuration = now - state.silenceStartTime;
            if (silenceDuration >= CONFIG.VAD.SILENCE_DURATION_MS) {
                console.log(`[VAD] 连续静音 ${silenceDuration}ms，判定说完`);
                stopVisualizer();
                stopRecording(true);
                return;
            }
        } else {
            if (state.isSilent) {
                console.log(`[VAD] 恢复声音 dB=${dB.toFixed(1)}`);
            }
            state.isSilent = false;
            state.silenceStartTime = 0;
        }

        const recordingDuration = (now - state.recordingStartTime) / 1000;
        if (recordingDuration >= CONFIG.MAX_RECORDING_DURATION_S) {
            console.log(`[VAD] 录制超过 ${CONFIG.MAX_RECORDING_DURATION_S} 秒，强制停止`);
            stopVisualizer();
            stopRecording(true);
            return;
        }

        state.vadAnimationFrame = requestAnimationFrame(analyze);
    }

    state.vadAnimationFrame = requestAnimationFrame(analyze);
}

/* ============================================================
   第十一部分：音波可视化
   ============================================================ */

function startVisualizer() {
    const analyser = state.analyserNode;
    if (!analyser) return;

    const canvas = DOM.visualizer;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    DOM.visualizerContainer.classList.add('active');

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (state.recordingState !== 'recording') return;

        state.visualizerFrame = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, rect.width, rect.height);

        const barCount = 48;
        const barWidth = rect.width / barCount - 2;
        const step = Math.floor(bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j];
            }
            const avg = sum / step;
            const barHeight = Math.max(4, (avg / 255) * rect.height * 0.8);

            const x = i * (barWidth + 2);
            const y = (rect.height - barHeight) / 2;

            const hue = 210 + (avg / 255) * 30;
            const lightness = 50 + (avg / 255) * 20;
            ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 4);
            ctx.fill();
        }
    }

    state.visualizerFrame = requestAnimationFrame(draw);
}

function stopVisualizer() {
    DOM.visualizerContainer.classList.remove('active');
    if (state.visualizerFrame) {
        cancelAnimationFrame(state.visualizerFrame);
        state.visualizerFrame = null;
    }
    const canvas = DOM.visualizer;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ============================================================
   第十二部分：iOS Safari 音频解锁
   ============================================================ */

function unlockAudioContext() {
    if (state.audioUnlocked) return;

    initAudioContext();

    const ctx = state.audioContext;
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(ctx.currentTime + 0.001);

    state.audioUnlocked = true;
    console.log('[AudioContext] iOS 音频解锁完成');
}

/* ============================================================
   第十三部分：UI 更新函数
   ============================================================ */

function updateStatus(text, stateClass) {
    DOM.statusText.textContent = text;
    DOM.statusText.classList.remove('status--listening', 'status--thinking', 'status--recording');
    if (stateClass) {
        DOM.statusText.classList.add(`status--${stateClass}`);
    }
}

function showSubtitle(text) {
    DOM.subtitleText.textContent = text;
}

function clearSubtitle() {
    DOM.subtitleText.textContent = '';
}

function showNetworkOverlay() {
    DOM.networkOverlay.classList.remove('hidden');
}

function hideNetworkOverlay() {
    DOM.networkOverlay.classList.add('hidden');
}

function enableControls(enabled) {
    DOM.micBtn.disabled = !enabled;
    DOM.stopBtn.disabled = !enabled;
    DOM.modeManual.disabled = !enabled;
    DOM.modeAuto.disabled = !enabled;
}

/* ============================================================
   第十四部分：模式切换逻辑
   ============================================================ */

function switchToManualMode() {
    if (state.mode === 'manual') return;

    if (state.mode === 'auto' && state.recordingState === 'recording') {
        exitAutoMode();
    }

    state.mode = 'manual';

    DOM.micBtn.classList.remove('hidden');
    DOM.stopBtn.classList.add('hidden');
    DOM.modeManual.classList.add('mode-btn--active');
    DOM.modeAuto.classList.remove('mode-btn--active');

    updateStatus('请点击开始');
    console.log('[模式] 切换到按住说话');
}

function switchToAutoMode() {
    if (state.mode === 'auto') return;

    state.mode = 'auto';

    DOM.micBtn.classList.add('hidden');
    DOM.stopBtn.classList.remove('hidden');
    DOM.modeManual.classList.remove('mode-btn--active');
    DOM.modeAuto.classList.add('mode-btn--active');

    enterAutoMode();
    console.log('[模式] 切换到畅聊模式');
}

/* ============================================================
   第十五部分：事件绑定
   ============================================================ */

function bindEvents() {
    // 登录/注册
    DOM.loginBtn.addEventListener('click', login);
    DOM.registerBtn.addEventListener('click', register);

    DOM.loginPhone.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    DOM.regName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });

    DOM.showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        DOM.loginForm.classList.add('hidden');
        DOM.registerForm.classList.remove('hidden');
        clearAuthError();
    });

    DOM.showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        DOM.registerForm.classList.add('hidden');
        DOM.loginForm.classList.remove('hidden');
        clearAuthError();
    });

    // 退出登录
    DOM.logoutBtn.addEventListener('click', logout);

    // 麦克风按钮
    bindMicButtonEvents();

    // 结束按钮
    DOM.stopBtn.addEventListener('click', () => {
        exitAutoMode();
    });

    // 模式切换
    DOM.modeManual.addEventListener('click', () => {
        unlockAudioContext();
        switchToManualMode();
    });

    DOM.modeAuto.addEventListener('click', () => {
        unlockAudioContext();
        switchToAutoMode();
    });

    // 生成自传按钮
    DOM.generateBtn.addEventListener('click', handleGenerateBiography);

    // 切到后台时停止录制
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.recordingState === 'recording') {
            console.log('[系统] 页面切到后台，停止录制');
            stopVisualizer();
            stopRecording(true);
        }
    });
}

/* ============================================================
   第十二部分：自传生成
   ============================================================ */

/**
 * 处理生成自传按钮点击
 */
async function handleGenerateBiography() {
    if (!state.user) return;

    // 确认操作
    const confirmed = confirm('确定要根据您目前讲述的故事生成自传吗？\n\n如果故事还不够丰富，生成的内容会比较简短。您可以之后继续补充故事，再次生成更完整的版本。');
    if (!confirmed) return;

    // 禁用按钮，显示加载状态
    DOM.generateBtn.disabled = true;
    showBiographyStatus('正在为您撰写故事书，请稍候...', 'loading');

    try {
        const res = await fetch(`/api/biographies/${state.user.userId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();

        if (data.success) {
            showBiographyStatus(
                `您的故事书已生成！《${data.title}》共${data.chapterCount}章，${data.wordCount}字。下次打开即可查看。`,
                'success'
            );
            // 隐藏生成按钮
            DOM.generateBtn.classList.add('hidden');
        } else {
            showBiographyStatus(data.error || '生成失败，请稍后再试', 'error');
        }
    } catch (err) {
        console.error('生成自传失败:', err);
        showBiographyStatus('网络错误，请稍后再试', 'error');
    } finally {
        DOM.generateBtn.disabled = false;
    }
}

/**
 * 显示自传生成状态
 */
function showBiographyStatus(text, type) {
    DOM.biographyStatus.textContent = text;
    DOM.biographyStatus.className = `biography-status status--${type}`;
    DOM.biographyStatus.classList.remove('hidden');
}

/**
 * 隐藏自传生成状态
 */
function hideBiographyStatus() {
    DOM.biographyStatus.classList.add('hidden');
}
