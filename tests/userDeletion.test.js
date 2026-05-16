const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    deleteCollectionDocsByUserId,
    deleteUserAudioFiles,
    getSafeUserAudioDir,
} = require('../lib/userDeletion');

function createMockDb(docs) {
    const removedIds = [];

    return {
        removedIds,
        collection() {
            return {
                where(query) {
                    return {
                        async get() {
                            return {
                                data: docs.filter((doc) => doc.userId === query.userId),
                            };
                        },
                    };
                },
                doc(id) {
                    return {
                        async remove() {
                            removedIds.push(id);
                        },
                    };
                },
            };
        },
    };
}

test('deletes all documents in a collection for a user and returns the count', async () => {
    const db = createMockDb([
        { _id: 'a', userId: 'user_1' },
        { _id: 'b', userId: 'user_2' },
        { _id: 'c', userId: 'user_1' },
    ]);

    const deletedCount = await deleteCollectionDocsByUserId(db, 'conversations', 'user_1');

    assert.equal(deletedCount, 2);
    assert.deepEqual(db.removedIds, ['a', 'c']);
});

test('deletes a user audio directory under the audio root', () => {
    const audioRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'story-audio-'));
    const audioDir = path.join(audioRoot, 'user_1', 'session_1', 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    fs.writeFileSync(path.join(audioDir, 'sample.pcm'), 'audio');

    const result = deleteUserAudioFiles(audioRoot, 'user_1');

    assert.equal(result.deletedAudioDir, true);
    assert.equal(fs.existsSync(path.join(audioRoot, 'user_1')), false);
    fs.rmSync(audioRoot, { recursive: true, force: true });
});

test('does not fail when the user audio directory does not exist', () => {
    const audioRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'story-audio-empty-'));

    const result = deleteUserAudioFiles(audioRoot, 'missing_user');

    assert.equal(result.deletedAudioDir, false);
    fs.rmSync(audioRoot, { recursive: true, force: true });
});

test('rejects audio deletion paths outside the audio root', () => {
    const audioRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'story-audio-safe-'));

    assert.throws(
        () => getSafeUserAudioDir(audioRoot, '../outside'),
        /不安全的用户音频目录/,
    );

    fs.rmSync(audioRoot, { recursive: true, force: true });
});
