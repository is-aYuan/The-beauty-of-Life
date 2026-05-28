# 字体目录

PDF 导出需要中文字体，否则中文内容可能显示为空白或方块。

推荐放置开源字体：

```text
assets/fonts/NotoSansCJKsc-Regular.otf
```

也可以通过环境变量指定服务器字体：

```env
BIOGRAPHY_EXPORT_FONT_PATH=/absolute/path/to/chinese-font.otf
```

后端会按以下顺序查找字体：

1. `assets/fonts/NotoSansCJKsc-Regular.otf`
2. `BIOGRAPHY_EXPORT_FONT_PATH`
3. 常见 macOS / Linux 系统中文字体路径

