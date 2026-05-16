const fs = require('fs');
const path = require('path');

async function deleteCollectionDocsByUserId(db, collectionName, userId) {
    const result = await db.collection(collectionName).where({ userId }).get();
    for (const doc of result.data || []) {
        await db.collection(collectionName).doc(doc._id).remove();
    }
    return (result.data || []).length;
}

function getSafeUserAudioDir(audioRoot, userId) {
    if (!userId || typeof userId !== 'string') {
        throw new Error('不安全的用户音频目录');
    }

    const root = path.resolve(audioRoot);
    const target = path.resolve(root, userId);
    const insideRoot = target.startsWith(root + path.sep);

    if (!insideRoot || target === root) {
        throw new Error('不安全的用户音频目录');
    }

    return target;
}

function deleteUserAudioFiles(audioRoot, userId) {
    const audioDir = getSafeUserAudioDir(audioRoot, userId);
    if (!fs.existsSync(audioDir)) {
        return { deletedAudioDir: false, audioDir };
    }

    fs.rmSync(audioDir, { recursive: true, force: true });
    return { deletedAudioDir: true, audioDir };
}

module.exports = {
    deleteCollectionDocsByUserId,
    deleteUserAudioFiles,
    getSafeUserAudioDir,
};
