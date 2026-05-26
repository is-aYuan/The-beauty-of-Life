// 模块：长语音识别切片。把前端流式 PCM 按安全时长切开，复用现有 ASR provider。

const DEFAULT_BYTES_PER_SECOND = 16000 * 2;
const DEFAULT_CHUNK_DURATION_SECONDS = 55;
const DEFAULT_MIN_CHUNK_BYTES = 1000;

function toAlignedPcmBuffer(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
    return buffer.length % 2 === 0 ? buffer : buffer.subarray(0, buffer.length - 1);
}

function splitPcm16leIntoChunks(input, options = {}) {
    const buffer = toAlignedPcmBuffer(input);
    if (buffer.length === 0) return [];

    const bytesPerSecond = options.bytesPerSecond || DEFAULT_BYTES_PER_SECOND;
    const chunkDurationSeconds = options.chunkDurationSeconds || DEFAULT_CHUNK_DURATION_SECONDS;
    const maxChunkBytes = Math.max(2, Math.floor(bytesPerSecond * chunkDurationSeconds / 2) * 2);

    if (buffer.length <= maxChunkBytes) return [buffer];

    const chunks = [];
    for (let offset = 0; offset < buffer.length; offset += maxChunkBytes) {
        const end = Math.min(offset + maxChunkBytes, buffer.length);
        const alignedEnd = end % 2 === 0 ? end : end - 1;
        if (alignedEnd > offset) {
            chunks.push(buffer.subarray(offset, alignedEnd));
        }
    }
    return chunks;
}

async function recognizeLongFormSpeech(input, recognizeChunk, options = {}) {
    if (typeof recognizeChunk !== 'function') {
        throw new Error('recognizeLongFormSpeech requires a recognizeChunk function');
    }

    const minChunkBytes = options.minChunkBytes || DEFAULT_MIN_CHUNK_BYTES;
    const joiner = options.joiner ?? '\n';
    const chunks = splitPcm16leIntoChunks(input, options).filter((chunk) => chunk.length >= minChunkBytes);
    const texts = [];

    for (let index = 0; index < chunks.length; index += 1) {
        const text = await recognizeChunk(chunks[index], {
            index,
            total: chunks.length,
        });
        const normalized = typeof text === 'string' ? text.trim() : '';
        if (normalized) {
            texts.push(normalized);
        }
    }

    return texts.length > 0 ? texts.join(joiner) : null;
}

module.exports = {
    DEFAULT_BYTES_PER_SECOND,
    DEFAULT_CHUNK_DURATION_SECONDS,
    recognizeLongFormSpeech,
    splitPcm16leIntoChunks,
};
