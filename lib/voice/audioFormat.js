// 模块：音频格式工具。把浏览器上传的裸 PCM 包装为 WAV，供豆包录音文件识别使用。

function pcm16leToWav(input, options = {}) {
    const pcmBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const sampleRate = options.sampleRate || 16000;
    const channels = options.channels || 1;
    const bitsPerSample = options.bitsPerSample || 16;
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(pcmBuffer.length, 40);

    return Buffer.concat([header, pcmBuffer]);
}

module.exports = {
    pcm16leToWav,
};
