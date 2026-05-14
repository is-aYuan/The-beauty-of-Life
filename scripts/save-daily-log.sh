#!/bin/bash
# 每日开发日志保存脚本
# 自动收集当天修改过的项目文件，写入/追加开发日志

PROJECT_DIR="/Users/ayuan/Documents/cc- The beauty of Life"
TODAY=$(date +%Y%m%d)
NOW=$(date +%H:%M)
LOG_FILE="$PROJECT_DIR/开发日志_${TODAY}.md"

# 扫描今天修改过的文件（排除 node_modules、.git、data、scripts）
CHANGED_FILES=$(find "$PROJECT_DIR" -maxdepth 2 \
    -newermt "$(date +%Y-%m-%d)" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.claude/*" \
    -not -path "*/data/*" \
    -not -path "*/scripts/*" \
    -not -name "开发日志_*" \
    -type f \
    2>/dev/null | sort)

# 无变更则静默退出
if [ -z "$CHANGED_FILES" ]; then
    exit 0
fi

# 统计文件列表
FILE_LIST=""
while IFS= read -r file; do
    REL_PATH="${file#$PROJECT_DIR/}"
    SIZE=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
    FILE_LIST="$FILE_LIST\n- \`$REL_PATH\` (${SIZE} bytes)"
done <<< "$CHANGED_FILES"

# 判断是新建还是追加
if [ -f "$LOG_FILE" ]; then
    # 追加
    {
        echo ""
        echo "---"
        echo "### $NOW 更新"
        echo -e "$FILE_LIST"
    } >> "$LOG_FILE"
else
    # 新建
    {
        echo "# 故事坊项目开发日志"
        echo ""
        echo "**日期：** $(date +%Y年%m月%d日)"
        echo ""
        echo "---"
        echo ""
        echo "### $NOW 更新"
        echo -e "$FILE_LIST"
    } > "$LOG_FILE"
fi
