const test = require('node:test');
const assert = require('node:assert/strict');

const {
    recognizeLongFormSpeech,
    splitPcm16leIntoChunks,
} = require('../lib/voice/longFormRecognition');

test('splitPcm16leIntoChunks splits long PCM audio by duration and keeps sample alignment', () => {
    const bytesPerSecond = 32000;
    const audio = Buffer.alloc(bytesPerSecond * 120);
    const chunks = splitPcm16leIntoChunks(audio, {
        bytesPerSecond,
        chunkDurationSeconds: 55,
    });

    assert.deepEqual(chunks.map((chunk) => chunk.length), [
        bytesPerSecond * 55,
        bytesPerSecond * 55,
        bytesPerSecond * 10,
    ]);
    assert.equal(chunks.every((chunk) => chunk.length % 2 === 0), true);
});

test('recognizeLongFormSpeech recognizes each long-audio chunk and merges non-empty text', async () => {
    const bytesPerSecond = 32000;
    const audio = Buffer.alloc(bytesPerSecond * 120);
    const recognizedChunks = [];

    const text = await recognizeLongFormSpeech(
        audio,
        async (chunk) => {
            recognizedChunks.push(chunk.length);
            return recognizedChunks.length === 2 ? '' : `第${recognizedChunks.length}段`;
        },
        {
            bytesPerSecond,
            chunkDurationSeconds: 55,
        },
    );

    assert.deepEqual(recognizedChunks, [
        bytesPerSecond * 55,
        bytesPerSecond * 55,
        bytesPerSecond * 10,
    ]);
    assert.equal(text, '第1段\n第3段');
});
