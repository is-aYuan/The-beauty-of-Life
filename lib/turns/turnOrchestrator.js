// 模块：单轮对话可靠性编排。负责 turn 状态推进，确保回复失败不会卡住移动端。

function resolveTurnStatus(chatResult) {
    if (chatResult?.localFallback) return 'failed_local_fallback';
    if (Number(chatResult?.fallbackLevel || 0) > 0) return 'completed_with_fallback';
    return 'completed';
}

function withSaveTimeout(promise, timeoutMs = 5000) {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`conversation save timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

async function runReliableTurn({
    store,
    turn,
    runChat,
    saveTurn,
    saveTimeoutMs = 5000,
} = {}) {
    if (!turn?.turnId || !turn?.userId) {
        throw new Error('reliable turn requires turnId and userId');
    }
    if (typeof runChat !== 'function') {
        throw new Error('reliable turn requires runChat');
    }

    await store?.safeUpdateTurn?.(turn.turnId, turn.userId, {
        status: 'processing',
        userText: turn.userText || '',
    });

    const chatResult = await runChat();
    const aiText = chatResult?.text || '';
    const status = resolveTurnStatus(chatResult);

    await store?.safeUpdateTurn?.(turn.turnId, turn.userId, {
        status,
        aiText,
        provider: chatResult?.provider || '',
        model: chatResult?.model || '',
        fallbackLevel: chatResult?.fallbackLevel || 0,
        errorMessage: (chatResult?.attempts || [])
            .map((attempt) => `${attempt.provider}: ${attempt.errorMessage}`)
            .join('\n')
            .slice(0, 1000),
    });

    try {
        if (typeof saveTurn === 'function') {
            await withSaveTimeout(saveTurn(chatResult), saveTimeoutMs);
            await store?.safeUpdateTurn?.(turn.turnId, turn.userId, {
                saveStatus: 'saved',
            });
        }
    } catch (err) {
        await store?.safeUpdateTurn?.(turn.turnId, turn.userId, {
            saveStatus: 'save_failed',
            errorMessage: err.message || String(err),
        });
    }

    return {
        ...chatResult,
        text: aiText,
        status,
    };
}

module.exports = {
    resolveTurnStatus,
    runReliableTurn,
};
