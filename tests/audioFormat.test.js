const test = require('node:test');
const assert = require('node:assert/strict');

const {
    pcm16leToWav,
} = require('../lib/voice/audioFormat');

test('wraps raw PCM 16k 16-bit mono audio in a WAV container', () => {
    const pcm = Buffer.from([0x01, 0x00, 0xff, 0x7f]);
    const wav = pcm16leToWav(pcm, {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
    });

    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(24), 16000);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), pcm.length);
    assert.deepEqual(wav.subarray(44), pcm);
});
