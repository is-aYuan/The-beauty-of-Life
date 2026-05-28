const fs = require('fs');
const path = require('path');

const BIOGRAPHY_EXPORT_FORMATS = {
    pdf: {
        extension: 'pdf',
        contentType: 'application/pdf',
    },
    docx: {
        extension: 'docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
};

const CHINESE_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const DEFAULT_FONT_CANDIDATES = [
    path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansCJKsc-Regular.otf'),
    process.env.BIOGRAPHY_EXPORT_FONT_PATH,
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/Supplemental/Songti.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
].filter(Boolean);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function toChineseNumber(value) {
    const number = Math.max(1, Math.round(Number(value) || 1));
    if (number < 10) return CHINESE_NUMERALS[number];
    if (number === 10) return '十';
    if (number < 20) return `十${CHINESE_NUMERALS[number % 10]}`;
    if (number < 100) {
        const tens = Math.floor(number / 10);
        const ones = number % 10;
        return `${CHINESE_NUMERALS[tens]}十${ones ? CHINESE_NUMERALS[ones] : ''}`;
    }
    return String(number);
}

function normalizeBiographyExportFormat(value) {
    const format = normalizeText(value).toLowerCase();
    if (format === 'word') return 'docx';
    return BIOGRAPHY_EXPORT_FORMATS[format] ? format : null;
}

function getBiographyExportContentType(format) {
    const normalized = normalizeBiographyExportFormat(format);
    return normalized ? BIOGRAPHY_EXPORT_FORMATS[normalized].contentType : '';
}

function buildBiographyExportModel({ biography, userProfile } = {}) {
    if (!biography || typeof biography !== 'object') return null;

    const userName = normalizeText(userProfile?.name);
    const title = normalizeText(biography.title) || (userName ? `${userName}的回忆录` : '我的回忆录');
    const chapters = Array.isArray(biography.chapters) ? biography.chapters : [];
    const normalizedChapters = chapters
        .map((chapter, index) => {
            const number = Math.max(1, Math.round(Number(chapter?.number) || index + 1));
            const titleText = normalizeText(chapter?.title) || `第${toChineseNumber(number)}章`;
            const content = normalizeText(chapter?.content);
            return {
                number,
                title: titleText,
                heading: `第${toChineseNumber(number)}章：${titleText}`,
                content,
            };
        })
        .filter((chapter) => chapter.title || chapter.content);

    return {
        title,
        userName,
        createdAt: biography.updatedAt || biography.createdAt || null,
        wordCount: Math.max(0, Math.round(Number(biography.wordCount) || 0)),
        chapterCount: normalizedChapters.length || Math.max(0, Math.round(Number(biography.chapterCount) || 0)),
        chapters: normalizedChapters,
        fullText: normalizeText(biography.fullText),
    };
}

function sanitizeFileNamePart(value) {
    const text = normalizeText(value) || '我的回忆录';
    return text.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '').slice(0, 60) || '我的回忆录';
}

function buildBiographyExportFileName(model, format) {
    const normalized = normalizeBiographyExportFormat(format) || 'pdf';
    const title = sanitizeFileNamePart(model?.title || (model?.userName ? `${model.userName}的回忆录` : '我的回忆录'));
    return `${title}.${BIOGRAPHY_EXPORT_FORMATS[normalized].extension}`;
}

function resolveChineseFontPath() {
    return DEFAULT_FONT_CANDIDATES.find((fontPath) => {
        try {
            return fs.existsSync(fontPath);
        } catch {
            return false;
        }
    }) || null;
}

function formatDate(value) {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN');
    }
    if (typeof value === 'object') {
        const seconds = value._seconds ?? value.seconds;
        if (typeof seconds === 'number') {
            return new Date(seconds * 1000).toLocaleDateString('zh-CN');
        }
    }
    return '';
}

function getExportChapters(model) {
    if (model.chapters.length > 0) return model.chapters;
    if (!model.fullText) return [];
    return [{
        number: 1,
        title: '正文',
        heading: '正文',
        content: model.fullText.replace(/^#.+\n+/u, '').trim(),
    }];
}

function requireExportDependency(packageName) {
    try {
        return require(packageName);
    } catch (err) {
        if (err?.code === 'MODULE_NOT_FOUND') {
            throw new Error(`缺少回忆录导出依赖 ${packageName}，请先执行 npm install。`);
        }
        throw err;
    }
}

async function createBiographyPdfBuffer(model, options = {}) {
    const PDFDocument = requireExportDependency('pdfkit');
    const fontPath = options.fontPath || resolveChineseFontPath();
    if (!fontPath) {
        throw new Error('缺少中文字体文件，无法生成 PDF。请配置 BIOGRAPHY_EXPORT_FONT_PATH 或放置 assets/fonts/NotoSansCJKsc-Regular.otf。');
    }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            bufferPages: true,
            margins: { top: 72, right: 64, bottom: 72, left: 64 },
            info: {
                Title: model.title,
                Author: model.userName || '故事坊',
                Creator: '故事坊',
            },
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.registerFont('main', fontPath);
        doc.font('main');

        doc.moveDown(2);
        doc.fontSize(27).fillColor('#241F1C').text(`《${model.title}》`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(13).fillColor('#6B6257').text('故事坊整理', { align: 'center' });
        const meta = [
            formatDate(model.createdAt) ? `整理时间：${formatDate(model.createdAt)}` : '',
            model.chapterCount ? `章节数：${model.chapterCount} 章` : '',
            model.wordCount ? `约 ${model.wordCount} 字` : '',
        ].filter(Boolean).join('  ·  ');
        if (meta) {
            doc.moveDown(0.8);
            doc.fontSize(11).text(meta, { align: 'center' });
        }
        doc.addPage();

        getExportChapters(model).forEach((chapter, index) => {
            if (index > 0) doc.addPage();
            doc.fontSize(19).fillColor('#241F1C').text(chapter.heading, {
                lineGap: 8,
            });
            doc.moveDown(0.8);
            doc.fontSize(12.5).fillColor('#3C3630').text(chapter.content || '这一章还在整理中。', {
                lineGap: 8,
                paragraphGap: 10,
                align: 'left',
            });
        });

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i += 1) {
            doc.switchToPage(i);
            const footerText = `${i - range.start + 1} / ${range.count}`;
            const footerY = doc.page.height - 42;
            // PDF 页码层：手动居中绘制单行文本，绕开段落排版器，避免自动新增空白页。
            doc.font('main').fontSize(9).fillColor('#8A8174');
            const footerX = (doc.page.width - doc.widthOfString(footerText)) / 2;
            doc.text(
                footerText,
                footerX,
                footerY,
                { lineBreak: false },
            );
        }

        doc.end();
    });
}

async function createBiographyDocxBuffer(model) {
    const {
        AlignmentType,
        Document,
        HeadingLevel,
        Packer,
        Paragraph,
        TextRun,
    } = requireExportDependency('docx');

    const meta = [
        formatDate(model.createdAt) ? `整理时间：${formatDate(model.createdAt)}` : '',
        model.chapterCount ? `${model.chapterCount} 章` : '',
        model.wordCount ? `约 ${model.wordCount} 字` : '',
    ].filter(Boolean).join(' · ');

    const children = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: `《${model.title}》`, bold: true, size: 40 })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
            children: [new TextRun({ text: meta || '故事坊整理', color: '6B6257', size: 22 })],
        }),
    ];

    getExportChapters(model).forEach((chapter) => {
        children.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 180 },
            children: [new TextRun({ text: chapter.heading, bold: true, size: 30 })],
        }));
        const paragraphs = (chapter.content || '这一章还在整理中。').split(/\n+/).map((line) => normalizeText(line)).filter(Boolean);
        paragraphs.forEach((line) => {
            children.push(new Paragraph({
                spacing: { after: 180, line: 360 },
                children: [new TextRun({ text: line, size: 24 })],
            }));
        });
    });

    const document = new Document({
        creator: '故事坊',
        title: model.title,
        description: '故事坊回忆录导出文档',
        sections: [{ children }],
    });

    return Packer.toBuffer(document);
}

async function createBiographyExportBuffer(model, format, options = {}) {
    const normalized = normalizeBiographyExportFormat(format);
    if (normalized === 'pdf') return createBiographyPdfBuffer(model, options);
    if (normalized === 'docx') return createBiographyDocxBuffer(model);
    throw new Error('不支持的回忆录下载格式');
}

module.exports = {
    BIOGRAPHY_EXPORT_FORMATS,
    buildBiographyExportFileName,
    buildBiographyExportModel,
    createBiographyExportBuffer,
    getBiographyExportContentType,
    normalizeBiographyExportFormat,
    resolveChineseFontPath,
};
