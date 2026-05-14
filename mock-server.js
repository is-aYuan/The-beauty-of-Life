/**
 * 故事坊 MVP - Mock WebSocket 服务器
 * 用于前端开发测试，模拟后端行为
 *
 * 功能：
 * - 接收音频数据并统计大小
 * - 接收 JSON 控制指令
 * - 返回模拟的 AI 状态和回复
 * - 生成简单的音频作为模拟 TTS
 */

const { WebSocketServer } = require('ws');
const http = require('http');

// ==================== 配置 ====================
const PORT = 8000;

// 模拟的 AI 回复库
const MOCK_REPLIES = [
    '这是一个很好的故事，请继续讲。',
    '我听到了，真有意思！后来呢？',
    '这段记忆很珍贵，我会帮您保存下来。',
    '您说得很好，请慢慢说，我在听。',
    '这段经历太精彩了，能再详细说说吗？',
    '我记住了，这是一个温暖的故事。',
];

// ==================== HTTP 服务器 ====================
const server = http.createServer((req, res) => {
    // 健康检查
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
        return;
    }
    res.writeHead(404);
    res.end('Not Found');
});

// ==================== WebSocket 服务器 ====================
const wss = new WebSocketServer({ server, path: '/ws/chat' });

wss.on('connection', (ws, req) => {
    console.log('[Mock] 新客户端连接');

    // 发送欢迎消息
    ws.send(JSON.stringify({
        status: 'ready',
        text: '您好！我是故事坊的 AI 助手，请开始讲述您的故事。',
    }));

    let audioBytes = 0;
    let messageCount = 0;

    ws.on('message', (data, isBinary) => {
        if (isBinary) {
            // 接收音频数据
            audioBytes += data.length;
            messageCount++;
            if (messageCount % 10 === 0) {
                console.log(`[Mock] 已接收音频: ${(audioBytes / 1024).toFixed(1)} KB`);
            }
        } else {
            // 接收 JSON 指令
            const msg = JSON.parse(data.toString());
            console.log('[Mock] 收到指令:', msg);

            if (msg.event === 'user_speech_ended') {
                console.log(`[Mock] 用户说完，共 ${(audioBytes / 1024).toFixed(1)} KB 音频`);

                // 模拟 AI 处理流程
                simulateAIResponse(ws);
                audioBytes = 0;
                messageCount = 0;
            }
        }
    });

    ws.on('close', () => {
        console.log('[Mock] 客户端断开');
    });

    ws.on('error', (err) => {
        console.error('[Mock] 错误:', err.message);
    });
});

/**
 * 模拟 AI 响应流程
 * 1. 发送 ai_thinking 状态
 * 2. 等待 1-2 秒
 * 3. 发送回复文字
 * 4. 发送模拟 TTS 音频
 * 5. 发送 ai_response_end
 */
function simulateAIResponse(ws) {
    // 1. AI 思考中
    ws.send(JSON.stringify({ status: 'ai_thinking' }));

    const thinkTime = 1000 + Math.random() * 1000;

    setTimeout(() => {
        if (ws.readyState !== 1) return;

        // 2. 发送回复文字
        const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
        ws.send(JSON.stringify({
            status: 'ai_speaking',
            text: reply,
        }));

        // 3. 发送模拟 TTS 音频（一个简单的正弦波 WAV）
        const wavBuffer = generateMockWav(1.5); // 1.5 秒音频
        ws.send(wavBuffer);

        // 4. 音频播放完毕
        setTimeout(() => {
            if (ws.readyState !== 1) return;
            ws.send(JSON.stringify({
                event: 'ai_response_end',
                status: 'ready',
            }));
            console.log('[Mock] AI 回复完毕');
        }, 2000);

    }, thinkTime);
}

/**
 * 生成一个简单的 WAV 音频文件（正弦波）
 * 用于模拟 TTS 语音，前端可正常解码播放
 *
 * @param {number} durationSec - 音频时长（秒）
 * @returns {Buffer} WAV 格式的音频数据
 */
function generateMockWav(durationSec) {
    const sampleRate = 16000;
    const numSamples = Math.floor(sampleRate * durationSec);
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = numSamples * blockAlign;

    // WAV 文件头 (44 字节)
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);                         // ChunkID
    header.writeUInt32LE(36 + dataSize, 4);           // ChunkSize
    header.write('WAVE', 8);                          // Format
    header.write('fmt ', 12);                         // Subchunk1ID
    header.writeUInt32LE(16, 16);                     // Subchunk1Size (PCM)
    header.writeUInt16LE(1, 20);                      // AudioFormat (PCM=1)
    header.writeUInt16LE(numChannels, 22);            // NumChannels
    header.writeUInt32LE(sampleRate, 24);             // SampleRate
    header.writeUInt32LE(byteRate, 28);               // ByteRate
    header.writeUInt16LE(blockAlign, 32);             // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);          // BitsPerSample
    header.write('data', 36);                         // Subchunk2ID
    header.writeUInt32LE(dataSize, 40);               // Subchunk2Size

    // 生成正弦波数据 (440Hz A音 + 523Hz C音，模拟简单旋律)
    const body = Buffer.alloc(dataSize);
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // 440Hz 基础音 + 523Hz 叠加，音量渐入渐出
        const envelope = Math.min(1, t * 10) * Math.min(1, (durationSec - t) * 10);
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3
                     + Math.sin(2 * Math.PI * 523 * t) * 0.2;
        const value = Math.round(sample * envelope * 32767);
        body.writeInt16LE(value, i * 2);
    }

    return Buffer.concat([header, body]);
}

// ==================== 启动服务器 ====================
server.listen(PORT, () => {
    console.log(`\n  故事坊 Mock 服务器已启动`);
    console.log(`  WebSocket: ws://localhost:${PORT}/ws/chat`);
    console.log(`  健康检查: http://localhost:${PORT}/health\n`);
});
