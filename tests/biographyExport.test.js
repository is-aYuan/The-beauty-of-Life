const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildBiographyExportModel,
    buildBiographyExportFileName,
    createBiographyExportBuffer,
    getBiographyExportContentType,
    normalizeBiographyExportFormat,
} = require('../lib/biographyExport');

function countPdfPages(buffer) {
    return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

test('builds a stable biography export model from the latest biography record', () => {
    const model = buildBiographyExportModel({
        biography: {
            title: '郑远的回忆录',
            createdAt: '2026-05-28T00:00:00.000Z',
            wordCount: 1200,
            chapterCount: 2,
            chapters: [
                { number: 1, title: '小时候的日子', content: '小时候，我住在贵州。' },
                { number: 2, title: '我的父母和家', content: '母亲做饭很好吃。' },
            ],
        },
        userProfile: { name: '郑远' },
    });

    assert.equal(model.title, '郑远的回忆录');
    assert.equal(model.userName, '郑远');
    assert.equal(model.wordCount, 1200);
    assert.equal(model.chapterCount, 2);
    assert.equal(model.chapters.length, 2);
    assert.equal(model.chapters[0].heading, '第一章：小时候的日子');
    assert.equal(model.chapters[1].content, '母亲做饭很好吃。');
});

test('normalizes export format and returns download metadata for PDF and Word', () => {
    assert.equal(normalizeBiographyExportFormat('pdf'), 'pdf');
    assert.equal(normalizeBiographyExportFormat('docx'), 'docx');
    assert.equal(normalizeBiographyExportFormat('word'), 'docx');
    assert.equal(normalizeBiographyExportFormat('unknown'), null);

    assert.equal(getBiographyExportContentType('pdf'), 'application/pdf');
    assert.equal(
        getBiographyExportContentType('docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    assert.equal(buildBiographyExportFileName({ userName: '郑远', title: '郑远的回忆录' }, 'pdf'), '郑远的回忆录.pdf');
    assert.equal(buildBiographyExportFileName({ userName: '郑远', title: '郑远的回忆录' }, 'docx'), '郑远的回忆录.docx');
});

test('creates PDF page numbers without adding trailing blank pages', async () => {
    const model = buildBiographyExportModel({
        biography: {
            title: '郑远的回忆录',
            wordCount: 120,
            chapterCount: 2,
            chapters: [
                { number: 1, title: '小时候的日子', content: '小时候，我住在贵州。' },
                { number: 2, title: '我的父母和家', content: '母亲做饭很好吃。' },
            ],
        },
        userProfile: { name: '郑远' },
    });

    const buffer = await createBiographyExportBuffer(model, 'pdf');

    assert.equal(countPdfPages(buffer), 3);
});
