# JellyEffext

[English](README.md) | **中文**

一款用于 Obsidian 实时预览模式的浮动式富文本格式化工具栏,灵感来自 Notion 与 Google Docs。

选中任意文本,工具栏会自动浮现——加粗、斜体、下划线、删除线、行内代码、字号、文字颜色、高亮——一切尽在指尖,无需打断写作节奏。

## 功能特性

- **浮动工具栏** — 选中文字时自动浮现,操作体验类似 Notion 和 Google Docs
- **固定工具栏模式** — 可选择将工具栏固定在编辑器顶部或底部
- **文本格式** — 加粗、斜体、下划线、删除线、行内代码
- **字号** — 预设字号(12px–32px),并支持自定义大小对话框
- **文字颜色** — 8 种预设颜色 + 支持自定义颜色选择器(持久化保存自定义颜色)
- **高亮颜色** — 5 种预设颜色 + 完整颜色选择器
- **清除格式** — 一键移除所选文字的全部格式
- **键盘快捷键** — 所有操作均为命令,可在 Obsidian 快捷键设置中自由绑定
- **主题适配** — 自动适配浅色和深色主题
- **零运行时依赖** — 单一 `main.js` 文件,无任何外部依赖库

## 格式存储方式

JellyEffext 尽可能使用**标准 Markdown 语法**存储,以保证笔记的可移植性:

| 格式 | 存储为 | 示例 |
|--------|-----------|---------|
| 加粗 | `**文本**` | `**你好**` |
| 斜体 | `*文本*` | `*你好*` |
| 删除线 | `~~文本~~` | `~~你好~~` |
| 行内代码 | `` `文本` `` | `` `你好` `` |

对于 Markdown 不支持的格式(下划线、字号、颜色),则使用简洁的 CSS class span 存储:

```html
<span class="rt-size-18 rt-color-red rt-bg-yellow rt-underline">文本</span>
```

不会产生冗长的 `style="..."` 内联样式 —— 只使用语义化的短 class 名。

## 安装

### 通过 Obsidian 社区插件市场(即将上线)

1. 打开 **设置 → 第三方插件 → 浏览**
2. 搜索 **JellyEffext**
3. 点击 **安装**,然后 **启用**

### 手动安装

1. 下载最新版本(`main.js`、`manifest.json`、`styles.css`)
2. 将这些文件复制到 `<你的库>/.obsidian/plugins/jellyeffext/`
3. 重新加载 Obsidian,在 **设置 → 第三方插件** 中启用插件

### 从源代码构建

```bash
git clone <仓库地址> jellyeffext
cd jellyeffext
npm install
npm run build
```

然后将生成的 `main.js`、`manifest.json` 和 `styles.css` 复制到 `<你的库>/.obsidian/plugins/jellyeffext/`。

## 设置选项

- **浮动工具栏** — 启用/禁用选中时弹出的工具栏
- **固定工具栏** — 始终显示工具栏(覆盖浮动模式)
- **固定工具栏位置** — 编辑器顶部或底部
- **字号预设** — 下拉菜单中显示的字号列表(逗号分隔)
- **文字颜色预设** — 可编辑的名称/Hex 颜色对,显示为色块
- **高亮颜色预设** — 可编辑的名称/Hex 颜色对,用于高亮
- **主题集成** — 在深色模式下自动调整某些颜色

## 命令与快捷键

所有操作均已注册为 Obsidian 命令,可在 **设置 → 快捷键** 中绑定:

| 操作 | 推荐快捷键 |
|--------|-------------------|
| 切换加粗 | Ctrl+B |
| 切换斜体 | Ctrl+I |
| 切换下划线 | Ctrl+U |
| 切换删除线 | — |
| 切换行内代码 | — |
| 清除格式 | — |
| 设置字号:12px–32px | Ctrl+Alt+1…5 |

## 开发

```bash
npm install       # 安装开发依赖
npm run dev       # 监听模式
npm run build     # 生产构建(tsc + esbuild)
```

### 项目结构

```
jellyeffext/
├── main.ts              # 插件源码
├── styles.css           # 工具栏与格式样式
├── manifest.json        # 插件清单
├── versions.json        # 版本 → 最低 Obsidian 版本映射
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

## 兼容性

- **Obsidian** — v1.5.0 及以上
- **编辑器模式** — 实时预览(Live Preview)与源码模式(Source Mode)。阅读模式(Reading Mode)为只读,因此不适用
- **平台** — 桌面端与移动端

## 许可证

MIT

---

## 编辑小贴士

如果你在实时预览模式下,发现难以选中或编辑被**着色、调整字号或加下划线**的文本,可以按 **`Ctrl+E`**(macOS 上是 **`Cmd+E`**)切换到**源码模式**,编辑完成后再切回实时预览即可。

这不是插件的 bug —— 而是 Obsidian 在实时预览中渲染内联 HTML 控件的固有行为。任何使用内联 `<span>` 元素的插件(如 Highlightr、Style Settings 颜色辅助等)都会有同样的限制。源码模式会显示原始文本,让你拥有完整的光标控制权。
