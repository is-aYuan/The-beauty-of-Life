// 模块：单轮对话任务存储。把移动端每次输入的处理状态持久化到 CloudBase turn_tasks。

const TURN_TASK_COLLECTION = 'turn_tasks';

function nowMs() {
    return Date.now();
}

function normalizeTurnId(turnId) {
    return typeof turnId === 'string' && turnId.trim() ? turnId.trim() : '';
}

function buildTurnId(prefix = 'turn') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function withStoreTimeout(promise, timeoutMs = 1500) {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`turn task store timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

function createTurnTaskStore({ db, logger = console, storeTimeoutMs = 1500 } = {}) {
    if (!db || typeof db.collection !== 'function') {
        throw new Error('turn task store requires a CloudBase-like db');
    }

    const collection = () => db.collection(TURN_TASK_COLLECTION);

    async function findByTurnId(turnId, userId) {
        const safeTurnId = normalizeTurnId(turnId);
        if (!safeTurnId || !userId) return null;
        const result = await collection()
            .where({ turnId: safeTurnId, userId })
            .limit(1)
            .get();
        return result.data?.[0] || null;
    }

    async function createAcceptedTurn({
        turnId,
        userId,
        sessionId,
        inputMode,
        userText = '',
        mode = '',
    }) {
        const safeTurnId = normalizeTurnId(turnId) || buildTurnId(inputMode || 'turn');
        const existing = await findByTurnId(safeTurnId, userId);
        if (existing) return existing;

        const timestamp = nowMs();
        const payload = {
            turnId: safeTurnId,
            userId,
            sessionId,
            inputMode,
            mode,
            userText,
            status: 'accepted',
            aiText: '',
            provider: '',
            model: '',
            fallbackLevel: 0,
            saveStatus: 'pending',
            errorMessage: '',
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        const addResult = await collection().add(payload);
        return {
            _id: addResult.id || addResult._id,
            ...payload,
        };
    }

    async function updateTurn(turnId, userId, patch = {}) {
        const existing = await findByTurnId(turnId, userId);
        if (!existing?._id) return null;
        const nextUpdatedAt = Math.max(nowMs(), Number(existing.updatedAt || 0) + 1);
        const payload = {
            ...patch,
            updatedAt: nextUpdatedAt,
        };
        await collection().doc(existing._id).update(payload);
        return {
            ...existing,
            ...payload,
        };
    }

    async function getLatestRecoverableTurn(userId) {
        if (!userId) return null;
        const result = await collection()
            .where({ userId })
            .orderBy('updatedAt', 'desc')
            .limit(1)
            .get();
        return result.data?.[0] || null;
    }

    async function safeCreateAcceptedTurn(input) {
        try {
            return await withStoreTimeout(createAcceptedTurn(input), storeTimeoutMs);
        } catch (err) {
            logger.warn?.('[turn_tasks] create accepted failed', err.message || err);
            return null;
        }
    }

    async function safeFindByTurnId(turnId, userId) {
        try {
            return await withStoreTimeout(findByTurnId(turnId, userId), storeTimeoutMs);
        } catch (err) {
            logger.warn?.('[turn_tasks] find failed', err.message || err);
            return null;
        }
    }

    async function safeUpdateTurn(turnId, userId, patch) {
        try {
            return await withStoreTimeout(updateTurn(turnId, userId, patch), storeTimeoutMs);
        } catch (err) {
            logger.warn?.('[turn_tasks] update failed', err.message || err);
            return null;
        }
    }

    async function safeGetLatestRecoverableTurn(userId) {
        try {
            return await withStoreTimeout(getLatestRecoverableTurn(userId), storeTimeoutMs);
        } catch (err) {
            logger.warn?.('[turn_tasks] latest query failed', err.message || err);
            return null;
        }
    }

    return {
        buildTurnId,
        createAcceptedTurn,
        findByTurnId,
        getLatestRecoverableTurn,
        safeCreateAcceptedTurn,
        safeFindByTurnId,
        safeGetLatestRecoverableTurn,
        safeUpdateTurn,
        updateTurn,
    };
}

module.exports = {
    TURN_TASK_COLLECTION,
    buildTurnId,
    createTurnTaskStore,
};
