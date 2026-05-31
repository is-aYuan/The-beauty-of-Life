const test = require('node:test');
const assert = require('node:assert/strict');

const {
    TURN_TASK_COLLECTION,
    createTurnTaskStore,
} = require('../lib/turns/turnTaskStore');

function createMemoryDb() {
    const collections = new Map();

    function getCollection(name) {
        if (!collections.has(name)) collections.set(name, []);
        const docs = collections.get(name);

        function createQuery(currentDocs) {
            return {
                where(filter) {
                    return createQuery(currentDocs.filter((doc) => Object.entries(filter)
                        .every(([key, value]) => doc[key] === value)));
                },
                orderBy(field, direction) {
                    const sorted = [...currentDocs].sort((left, right) => {
                        const leftValue = left[field] || 0;
                        const rightValue = right[field] || 0;
                        return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
                    });
                    return createQuery(sorted);
                },
                limit(count) {
                    return createQuery(currentDocs.slice(0, count));
                },
                async get() {
                    return { data: currentDocs };
                },
                async add(payload) {
                    const id = `${name}_${docs.length + 1}`;
                    docs.push({ _id: id, ...payload });
                    return { id };
                },
                doc(id) {
                    return {
                        async update(patch) {
                            const index = docs.findIndex((doc) => doc._id === id);
                            docs[index] = { ...docs[index], ...patch };
                        },
                    };
                },
            };
        }

        return createQuery(docs);
    }

    return {
        collections,
        collection: getCollection,
    };
}

test('turn task store creates accepted turn only once for the same turnId', async () => {
    const db = createMemoryDb();
    const store = createTurnTaskStore({ db });

    const first = await store.createAcceptedTurn({
        turnId: 'turn_same',
        userId: 'user_1',
        sessionId: 'session_1',
        inputMode: 'text',
        userText: '第一次讲述',
    });
    const second = await store.createAcceptedTurn({
        turnId: 'turn_same',
        userId: 'user_1',
        sessionId: 'session_1',
        inputMode: 'text',
        userText: '重复提交',
    });

    assert.equal(first._id, second._id);
    assert.equal(db.collections.get(TURN_TASK_COLLECTION).length, 1);
    assert.equal(second.userText, '第一次讲述');
});

test('turn task store updates status and reads latest recoverable turn', async () => {
    const db = createMemoryDb();
    const store = createTurnTaskStore({ db });

    await store.createAcceptedTurn({
        turnId: 'turn_1',
        userId: 'user_1',
        sessionId: 'session_1',
        inputMode: 'text',
        userText: '旧内容',
    });
    await store.createAcceptedTurn({
        turnId: 'turn_2',
        userId: 'user_1',
        sessionId: 'session_2',
        inputMode: 'voice',
        userText: '新内容',
    });
    await store.updateTurn('turn_2', 'user_1', {
        status: 'completed_with_fallback',
        aiText: '备用模型回复',
        provider: 'hunyuan',
        fallbackLevel: 1,
    });

    const updated = await store.findByTurnId('turn_2', 'user_1');
    assert.equal(updated.status, 'completed_with_fallback');
    assert.equal(updated.aiText, '备用模型回复');
    assert.equal(updated.provider, 'hunyuan');

    const latest = await store.getLatestRecoverableTurn('user_1');
    assert.equal(latest.turnId, 'turn_2');
});

test('turn task store safe methods return quickly when CloudBase hangs', async () => {
    const hangingDb = {
        collection() {
            return {
                where() {
                    return this;
                },
                limit() {
                    return this;
                },
                get() {
                    return new Promise(() => {});
                },
            };
        },
    };
    const warnings = [];
    const store = createTurnTaskStore({
        db: hangingDb,
        storeTimeoutMs: 10,
        logger: {
            warn(...args) {
                warnings.push(args);
            },
        },
    });

    const startedAt = Date.now();
    const result = await store.safeFindByTurnId('turn_hang', 'user_1');

    assert.equal(result, null);
    assert.ok(Date.now() - startedAt < 500);
    assert.ok(warnings.some((args) => String(args[0]).includes('[turn_tasks] find failed')));
});
