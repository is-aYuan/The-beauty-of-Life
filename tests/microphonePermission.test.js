const test = require('node:test');
const assert = require('node:assert/strict');

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

test('tracks microphone readiness in storage', async () => {
    const {
        clearMicrophoneReady,
        isMicrophoneReady,
        markMicrophoneReady,
    } = await import('../lovable_ui/src/lib/microphonePermission.js');
    const storage = new MemoryStorage();

    assert.equal(isMicrophoneReady(storage), false);
    markMicrophoneReady(storage);
    assert.equal(isMicrophoneReady(storage), true);
    clearMicrophoneReady(storage);
    assert.equal(isMicrophoneReady(storage), false);
});

test('permission probe always stops opened media tracks', async () => {
    const { requestMicrophonePermission } = await import('../lovable_ui/src/lib/microphonePermission.js');
    let stopped = false;
    const mediaDevices = {
        async getUserMedia() {
            return {
                getTracks() {
                    return [{ stop: () => { stopped = true; } }];
                },
            };
        },
    };

    const result = await requestMicrophonePermission({ mediaDevices });

    assert.equal(result, true);
    assert.equal(stopped, true);
});
