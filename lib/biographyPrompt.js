function safeList(items) {
    return Array.isArray(items) && items.length > 0 ? items.join('；') : '';
}

function buildIdentitySection(accountName) {
    const name = String(accountName || '').trim();
    return `## 传主身份（最高优先级，必须严格遵守）

本书主人公姓名：${name || '未知'}。
这是账号资料中的真实姓名，是本书唯一传主。
如果后续摘要素材中出现其他姓名，例如朋友、同学、亲戚、故事人物，不得把他们当作传主。
如果摘要素材中出现的姓名与账号姓名“${name || '未知'}”不一致，以账号姓名为准。
自传第一人称必须是${name || '账号本人'}，不得写成其他人。
开篇禁止出现“我叫阿杰”等与账号姓名不一致的句子。`;
}

function buildNarrativeText(summaries = [], accountName = '') {
    return summaries.map((summary, index) => {
        let section = `=== 第${index + 1}次对话 ===\n`;
        const profileName = typeof summary.profile?.name === 'string' ? summary.profile.name.trim() : '';
        const trustedName = String(accountName || '').trim();

        if (profileName && profileName !== trustedName) {
            section += `摘要模型推测姓名：${profileName}（低可信，仅作参考，不能覆盖账号姓名“${trustedName}”）\n`;
        } else if (profileName && profileName === trustedName) {
            section += `摘要模型推测姓名：${profileName}（与账号姓名一致）\n`;
        }

        if (summary.profile?.approxAge) section += `年龄：${summary.profile.approxAge}\n`;
        if (summary.profile?.location) section += `籍贯：${summary.profile.location}\n`;

        for (const narrative of (summary.narratives || [])) {
            section += `\n【${narrative.theme || '回忆'}】${narrative.title || '一段回忆'}\n${narrative.content || ''}\n`;
            const facts = safeList(narrative.keyFacts);
            if (facts) section += `关键事实：${facts}\n`;
        }

        if (summary.emotionalNote) {
            section += `\n情感状态：${summary.emotionalNote}\n`;
        }
        return section;
    }).join('\n');
}

function buildMemoryText(memoryProfile) {
    if (!memoryProfile) return '';

    let memoryText = '\n\n=== 记忆档案 ===\n';

    if (memoryProfile.people?.length > 0) {
        memoryText += '\n【人物】\n';
        for (const person of memoryProfile.people) {
            memoryText += `- ${person.name}（${person.relation}）：${person.details || person.mentionedIn || ''}\n`;
        }
    }

    if (memoryProfile.places?.length > 0) {
        memoryText += '\n【地点】\n';
        for (const place of memoryProfile.places) {
            memoryText += `- ${place.name}：${place.context || ''}\n`;
        }
    }

    if (memoryProfile.events?.length > 0) {
        memoryText += '\n【事件】\n';
        for (const event of memoryProfile.events) {
            memoryText += `- ${event.time}：${event.description}（情感强度：${event.emotionalWeight}）\n`;
        }
    }

    if (memoryProfile.emotions?.length > 0) {
        memoryText += '\n【情感】\n';
        for (const emotion of memoryProfile.emotions) {
            memoryText += `- ${emotion.feeling}（触发：${emotion.trigger || '未知'}）\n`;
        }
    }

    return memoryText;
}

// 自传撰写 Prompt 模块：账号姓名是唯一传主身份，摘要里的姓名只能作为低可信参考。
function buildBiographyUserPrompt({ accountName, tier, summaries = [], memoryProfile = null }) {
    const chapterRange = tier?.chapterRange || [5, 8];
    const wordsPerChapter = tier?.wordsPerChapter || [800, 1500];
    const identitySection = buildIdentitySection(accountName);
    const narrativeText = buildNarrativeText(summaries, accountName);
    const memoryText = buildMemoryText(memoryProfile);

    return `${identitySection}

请根据以下素材撰写一本自传。要求章节数在 ${chapterRange[0]}-${chapterRange[1]} 章之间，每章 ${wordsPerChapter[0]}-${wordsPerChapter[1]} 字。

=== 叙事摘要素材 ===
${narrativeText}
${memoryText}

请严格按照 JSON 格式输出。`;
}

function validateBiographyIdentity({ accountName, bioData }) {
    const trustedName = String(accountName || '').trim();
    if (!trustedName || !bioData) return { valid: true, error: '' };

    const text = [
        bioData.title || '',
        ...(bioData.chapters || []).flatMap((chapter) => [chapter.title || '', chapter.content || '']),
    ].join('\n');

    const identityMatches = [...text.matchAll(/我叫([^，。,.、；;！!？?\s\n]{2,8})/g)];
    const conflict = identityMatches.find((match) => match[1] && match[1] !== trustedName);

    if (conflict) {
        return {
            valid: false,
            error: `回忆录生成时出现身份冲突：账号姓名是“${trustedName}”，正文出现“我叫${conflict[1]}”。`,
        };
    }

    return { valid: true, error: '' };
}

module.exports = {
    buildBiographyUserPrompt,
    validateBiographyIdentity,
};
