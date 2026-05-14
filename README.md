# BabyTrack · 婴儿照顾活动记录

一款部署在树莓派上的轻量级婴儿照顾记录系统，通过手机浏览器即可随时记录喂奶、睡眠、换尿布等活动；可选配套 GitHub Pages 静态快照，让你在外面也能查看家人记录的情况。

> **本 README 同时是 AI Agent 的复刻规约**：另一个 agent 仅凭本文档即可重建出与本项目 UI、交互、数据模型完全一致的系统。

---

## 目录

1. [产品定位与核心理念](#1-产品定位与核心理念)
2. [技术栈与运行架构](#2-技术栈与运行架构)
3. [项目结构](#3-项目结构)
4. [数据模型](#4-数据模型)
5. [HTTP API 规范](#5-http-api-规范)
6. [UI 设计规范（复刻关键）](#6-ui-设计规范复刻关键)
7. [前端交互逻辑](#7-前端交互逻辑)
8. [关键技术决策与陷阱](#8-关键技术决策与陷阱)
9. [本地开发](#9-本地开发)
10. [树莓派部署（一键脚本）](#10-树莓派部署一键脚本)
11. [GitHub Pages 只读快照](#11-github-pages-只读快照)
12. [运维命令](#12-运维命令)

---

## 1. 产品定位与核心理念

- **极简单页 H5**：一屏内完成"看 + 记"，移动端为主（`max-width: 430px`）
- **"开始 / 结束"二段式记录**：睡眠和洗澡支持只记开始，事后再点结束
- **所有事件均可二次编辑**：点击事件卡片即可修改时间、量级、备注等
- **零写入门槛**：家人不需要学习，按钮一目了然，弹窗只需滑/点即可保存
- **本地优先**：数据全部存在树莓派 SQLite，外部访问通过 GitHub Pages 静态快照（可选）

## 2. 技术栈与运行架构

| 层 | 技术 | 备注 |
|---|---|---|
| 后端 | Python 3 + Flask 3.1 + flask-sqlalchemy 3.1 | App Factory 模式 |
| 数据库 | SQLite | 单表 `events`，文件位于 `data/babytrack.db` |
| 前端 | Vue 3（CDN，无构建） | 直接由 Flask 渲染 `templates/index.html` |
| 样式 | 原生 CSS（手写，无 UI 框架）| 单文件 ~850 行 |
| 生产环境 | Gunicorn (`-w 2 -b 127.0.0.1:5000`) + Nginx 反代 80 端口 | 由 systemd 守护 |
| 局域网访问 | mDNS / Avahi（`http://babytrack.local`） | 不需要记 IP |

```
Mobile Browser ──HTTP──▶ Nginx :80 ──proxy_pass──▶ Gunicorn 127.0.0.1:5000
                                                          │
                                                          ▼
                                                     SQLite (data/babytrack.db)

[可选] cron */5 ──▶ tools/sync_to_github.sh ──▶ docs/data/snapshot.json ──▶ git push ──▶ GitHub Pages
```

## 3. 项目结构

```
babytrack/
├── .venv/                       # Python 虚拟环境（脚本自动创建）
├── docs_internal/               # 项目内部文档（不公开）
│   ├── development.md
│   ├── plan.md
│   └── progress.md
├── server/                      # Flask 应用
│   ├── __init__.py              # create_app 工厂
│   ├── models.py                # Event 模型
│   ├── routes.py                # 主页路由 + REST API
│   ├── static/
│   │   ├── css/main.css         # 单文件样式（~850 行，含滚轮选择器）
│   │   └── js/app.js            # Vue 应用主文件（~650 行）
│   └── templates/
│       └── index.html           # 主页面（~450 行，包含全部弹窗）
├── tools/                       # 工具脚本
│   ├── export_snapshot.py       # 导出最近 14 天快照为 JSON
│   └── sync_to_github.sh        # 自动同步到 GitHub Pages
├── docs/                        # GitHub Pages 根目录（只读静态版本）
│   ├── index.html               # 简化版（去掉所有写按钮）
│   ├── app.js                   # 改为 fetch ./data/snapshot.json
│   ├── main.css                 # 由 sync 脚本从 server/static/css 复制
│   └── data/
│       └── snapshot.json        # 自动生成
├── data/                        # 数据库目录（gitignore）
├── config.py                    # SECRET_KEY + DB URI
├── run.py                       # 入口：app.run(host='0.0.0.0', port=5000, debug=True)
├── install.sh                   # 树莓派一键部署脚本（幂等）
├── deploy.sh                    # 增量更新脚本（cron 调用）
├── requirements.txt             # flask / flask-sqlalchemy / gunicorn
├── .gitignore                   # 排除 .venv/ data/ __pycache__/
└── README.md                    # 本文件
```

## 4. 数据模型

**单表 `events`**（[server/models.py](server/models.py)）：

```python
class Event(db.Model):
    id          = Integer, PK
    type        = String(20)   # feed/sleep/diaper/vitamin/bath/food/checkup/temperature
    start_time  = DateTime, default=now
    end_time    = DateTime, nullable=True   # 仅 sleep/bath 使用
    amount      = Integer, nullable=True    # feed/food: 毫升；temperature: 体温×10
    sub_type    = String(20), nullable=True # diaper: 'pee' | 'poop'
    color       = String(20), nullable=True # diaper: 颜色字符串
    note        = Text, nullable=True       # food/checkup 备注
    created_at  = DateTime, default=now
```

### 8 种事件类型语义

| type | 必填 | 选填 | 卡片显示 |
|---|---|---|---|
| `feed` 喂奶 | start_time, amount | - | `120ml` |
| `sleep` 睡眠 | start_time | end_time | 进行中 → "已睡 1时20分"；结束 → "时长:1时20分" |
| `diaper` 尿布 | start_time, sub_type | color | "嘘嘘 (黄色)" / "便便 (绿色)" |
| `vitamin` 维生素AD | start_time | - | `✓` |
| `bath` 洗澡 | start_time | end_time | 与 sleep 同样的进行中/结束逻辑 |
| `food` 辅食 | start_time | amount, note | "120ml 米糊" |
| `checkup` 体检 | start_time, note | - | 备注内容 |
| `temperature` 体温 | start_time, amount | - | "36.5°C"（amount=365）；>37.5 红色 |

**体温存储约定**：用 `amount` 字段存放 `体温 × 10` 的整数（如 36.5°C 存为 `365`），前端展示时除以 10 保留 1 位小数。

### 颜色主题（事件类型用色）

| type | 圆点色 | 按钮背景 |
|---|---|---|
| feed | `#e87c9e` | `#fde8f0` |
| sleep | `#7eb8e0` | `#e8f0fd` |
| diaper | `#a0d4a0` | `#e8f8fd` |
| vitamin | `#e8c86e` | `#fdf0e8` |
| bath | `#88c8e8` | `#e8f4fd` |
| food | `#f0a860` | `#fdf4e8` |
| checkup | `#b088d0` | `#f0e8fd` |
| temperature | `#e06060` | `#fde8e8` |
| 主题色 | `#d4548a` | `#f8e8f0` |

## 5. HTTP API 规范

### `GET /` → 渲染 `index.html`

### `GET /api/events?date=YYYY-MM-DD` → 该日全部事件

按 `start_time` 倒序返回。无参数则返回今天。

### `POST /api/events` → 创建事件

```json
{
  "type": "feed",
  "start_time": "2025-05-14T16:30:00",
  "amount": 120,
  "sub_type": null,
  "color": null,
  "note": null,
  "end_time": null
}
```

返回 `201` + 新事件 dict。

### `PUT /api/events/<id>` → 更新（部分字段即可）

```json
{ "end_time": "2025-05-14T18:00:00" }
```

后端按 `if 'xxx' in data` 增量更新，`end_time: null` 表示恢复"进行中"。

### `DELETE /api/events/<id>` → 删除

### `GET /api/summary/<date>` → 当日汇总

```json
{
  "feed":        { "count": 6, "total_ml": 720 },
  "sleep":       { "count": 4, "total_minutes": 360 },
  "diaper":      { "count": 8, "pee": 5, "poop": 3 },
  "vitamin":     { "taken": true },
  "bath":        { "count": 1, "total_minutes": 12 },
  "food":        { "count": 0 },
  "checkup":     { "count": 0 },
  "temperature": { "count": 0 }
}
```

## 6. UI 设计规范（复刻关键）

### 6.1 整体布局

整个页面只有一列，分 4 个固定区块：

```
┌─────────────────────────────────────┐
│ ① Header (sticky, 渐变粉)           │
│   [鱼宝 ✎]              [今]        │
│   [周一][周二][周三][周四]...       │
│   5月14日（右下日期）               │
├─────────────────────────────────────┤
│ ② Summary Bar (横向滚动药丸)        │
│  [喂6次][尿布8次][维生素AD][睡眠4次] │
├─────────────────────────────────────┤
│ ③ Timeline (主体，可滚动)            │
│  [● 16:30 喂奶  3分钟前  ×]         │
│  [● 14:00 睡眠  20分钟前    ]       │ ← 进行中 浅蓝底
│  ...                                │
├─────────────────────────────────────┤
│ ④ Bottom Actions (fixed)            │
│ [喂奶][睡觉][尿布][维生素][更多]    │
└─────────────────────────────────────┘
```

**关键尺寸**：
- `body { max-width: 430px; margin: 0 auto; padding-bottom: 120px }`
- `font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', ...`
- `background: #f8f5fa`（淡紫白）

### 6.2 Header

```css
.header { background: linear-gradient(135deg, #f8e8f0, #fff); padding: 12px 16px 0; sticky; }
.baby-name { font-size: 18px; font-weight: 600; color: #d4548a; cursor: pointer; }
.baby-name-edit { font-size: 11px; color: #c8a0b8; opacity: 0.7; }  /* ✎ 小图标 */
```

宝宝昵称从 localStorage 读 `babytrack:babyName`，默认 `鱼宝`，点击弹出改名弹窗。

### 6.3 周视图日期条

7 个日期 + 右侧月日：
```css
.date-item { flex: 1; padding: 6px 0; border-radius: 20px; }
.date-item.active { background: #e8a0c8; color: #fff; }
```
**周一为一周第一天**（不是周日）。

### 6.4 Summary 药丸

```css
.summary-item {
  background: #faf5fa; border: 1px solid #f0e0f0;
  border-radius: 16px; padding: 6px 12px;
  flex-shrink: 0; min-width: 76px;
}
.summary-item .label { font-size: 11px; color: #555; }
.summary-item .value { font-size: 11px; color: #999; }
```
横向 `overflow-x: auto`，隐藏滚动条 (`::-webkit-scrollbar { display: none }`)。

### 6.5 事件卡片

```
┌─────────────────────────────────────┐
│ ● 16:30                3分钟前  [×]│  ← event-header
│ 喂奶                          120ml │  ← event-body
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │  ← (仅进行中)
│                          [记录睡醒] │  ← event-actions (仅进行中)
└─────────────────────────────────────┘
```

```css
.event-card {
  background: #fff; border-radius: 12px; padding: 12px 14px;
  margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  cursor: pointer;  /* 整张卡片可点击进入编辑 */
}
.event-card.sleep-ongoing { background: #eef6ff; border: 1px solid #d0e4f8; }
.event-card:active { transform: scale(0.99); }

.event-dot { width: 8px; height: 8px; border-radius: 50%; }
.event-time span { font-size: 13px; color: #999; }
.event-ago { font-size: 11px; color: #ccc; }

.btn-delete {
  width: 26px; height: 26px; border-radius: 50%;
  background: #f5eef5; color: #c8b0c8; font-size: 18px;
}
.btn-delete:hover { background: #fde0e0; color: #d04848; }

.ongoing-badge { background: #e8f4e8; color: #5a9a5a; padding: 2px 8px; border-radius: 10px; }

.event-actions {
  margin-top: 10px; padding-top: 8px;
  border-top: 1px dashed #efe5ef;
  justify-content: flex-end;
}
```

**关键**：删除按钮放 `event-header-right`（与"3分钟前"同行），不是绝对定位。`@click.stop` 防止冒泡到卡片的 `openEdit`。

### 6.6 底部按钮区

```css
.bottom-actions {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px;
  padding: 12px 16px; background: #fff;
  display: flex; justify-content: space-around;
}
.action-icon {
  width: 44px; height: 44px; border-radius: 50%;
  font-size: 20px; display: flex; align-items: center; justify-content: center;
}
.action-icon:active { transform: scale(0.9); }
```

5 个按钮：喂奶 🍼 / 睡觉 💤 / 尿布 🧷 / 维生素 � / 更多 +

**「更多」**点击弹出 `more-panel`（4 列 grid），含：洗澡 🛁 / 辅食 🍼 / 体检 🏥 / 体温 🌡️

### 6.7 弹窗体系

所有弹窗都从底部向上滑入：

```css
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end; justify-content: center;
}
.modal-content {
  background: #fff; border-radius: 16px 16px 0 0;
  width: 100%; max-width: 430px; padding: 20px;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

**弹窗类型**（`modal` ref 的取值）：

| modal | 触发 | 内容 |
|---|---|---|
| `feed` | 点"喂奶" | 时间滚轮 + 量级（30/60/90/120/150/180/自定义ml）|
| `start` | 点"睡觉"/"洗澡"（无进行中）| 时间滚轮 + 提示「结束后再次点击 ... 即可完成」|
| `diaper` | 点"尿布" | 时间滚轮 + 嘘嘘/便便 + 颜色 |
| `food` | "更多 → 辅食" | 时间滚轮 + 毫升 + 备注 |
| `checkup` | "更多 → 体检" | 时间滚轮 + 备注 |
| `temperature` | "更多 → 体温" | 时间滚轮 + 体温 number input |
| `edit` | 点击事件卡片 | 时间滚轮 + 按 `form.type` 动态显示其他字段 |

`vitamin` 和 `bath`（已有进行中）和 `endSleep/endBath` 都直接调 API 不走弹窗（带二次确认时用 `askConfirm`）。

### 6.8 滚轮时间选择器（自定义组件）

iOS 风格的 3 列滚轮：日期、小时、分钟。

```css
.wheel-picker { height: 180px; display: flex; }
.wheel-column {
  flex: 1; height: 100%; overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}
.wheel-spacer { height: 72px; }       /* 上下各 2 项的留白 */
.wheel-item {
  height: 36px; line-height: 36px;
  scroll-snap-align: center;
  text-align: center; font-size: 16px; color: #999;
}
.wheel-item.active { color: #d4548a; font-weight: 600; font-size: 18px; }

/* 顶/底渐变遮罩制造"模糊感" */
.wheel-mask {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(to bottom,
    rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 30%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.6) 70%, rgba(255,255,255,0.95) 100%);
}
/* 中央高亮线 */
.wheel-highlight {
  position: absolute; top: 50%; height: 36px;
  transform: translateY(-50%);
  border-top: 1px solid #f0d8e8;
  border-bottom: 1px solid #f0d8e8;
  background: rgba(212, 84, 138, 0.04);
}
```

**实现要点**：
- 每列前后各放 `<div class="wheel-spacer">`（72px = 36×2），让首尾项也能滚到中央
- 滚动事件用 `setTimeout` debounce 100ms 后取最近 `scrollTop / 36` 的下标
- 列表挂载时根据 `modelValue` 计算初始 scrollTop

### 6.9 通用确认弹窗（替代浏览器原生 confirm）

```css
.confirm-overlay { z-index: 2000; background: rgba(20,10,25,0.45); backdrop-filter: blur(2px); }
.confirm-card {
  width: 86%; max-width: 320px;
  border-radius: 18px; padding: 24px 20px 18px;
  text-align: center;
  animation: confirmPop 0.18s ease-out;
}
@keyframes confirmPop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.confirm-icon { font-size: 36px; }
.confirm-title { font-size: 17px; font-weight: 600; color: #2a1830; }
.confirm-desc { font-size: 13px; color: #888; }
.confirm-actions .btn-danger {
  background: linear-gradient(135deg, #ff6b8a, #d4548a);
  color: #fff; box-shadow: 0 4px 10px rgba(212, 84, 138, 0.3);
}
```

通过 `askConfirm({ title, desc, okText, icon })` 返回 Promise 调用，删除 / 二次记录维生素都用它。

## 7. 前端交互逻辑

### 7.1 时间格式约定

**全程使用本地时间字符串，不用 UTC，不带 `Z` 后缀**。

- `nowLocalISO()`：返回 `'2025-05-14T16:30'`（精确到分钟，无秒，无 Z）
- `toLocalISO(input)`：把 datetime-local 输入或 Date 对象转为相同格式
- `localDateStr(d)`：返回 `'2025-05-14'`，**不要用 `toISOString().slice(0,10)`**（UTC 边界会跨日）

### 7.2 后端 ISO 解析

```python
def parse_iso(s):
    if not s: return None
    s = s.replace('Z', '+00:00')   # 兼容 Z 后缀
    return datetime.fromisoformat(s)
```

### 7.3 「开始 → 进行中 → 结束」流程

```
用户点「记睡觉」
   │
   ├─ 已存在 type=sleep && !end_time 的事件 ──▶ askConfirm 提示 ──▶ PUT 加 end_time
   │
   └─ 不存在 ──▶ 弹 'start' 弹窗 ──▶ 滚轮调时间 ──▶ 点开始 ──▶ POST 创建（无 end_time）
```

进行中卡片：
- 浅蓝背景（`.sleep-ongoing`）
- 显示绿色 `已睡 X分钟` 徽章
- 卡片底部分隔线下显示 "记录睡醒" 按钮（`btn-end-sleep`）

### 7.4 编辑流程

任何卡片点击 → `openEdit(event)` → 填充 `form` → 弹 `edit` 弹窗。

`edit` 弹窗按 `form.type` 显示不同字段：

```js
// 伪代码
<form-group>开始时间 → 滚轮</form-group>
<form-group v-if="sleep || bath">
  结束时间 → 占位「熟睡中（点击设置结束时间）」点击展开滚轮
  + 「清除（恢复进行中）」按钮
</form-group>
<form-group v-if="feed || food">毫升</form-group>
<form-group v-if="temperature">体温</form-group>
<form-group v-if="diaper">嘘嘘/便便 + 颜色</form-group>
<form-group v-if="food || checkup">备注</form-group>
```

提交时只发送对应字段（增量更新）。

### 7.5 timeAgo 算法

```js
function timeAgo(iso) {
  const ms = new Date() - new Date(iso)
  const min = Math.floor(ms / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h/24)}天前`
}
```

每 60 秒触发 `events.value = [...events.value]` 强制视图刷新（不重新拉数据）。

## 8. 关键技术决策与陷阱

### 8.1 Jinja2 vs Vue 模板冲突

`templates/index.html` 用 `{% raw %} ... {% endraw %}` 包裹 Vue 模板，否则 `{{ }}` 会被 Jinja2 先解析。

`docs/index.html` 不经 Flask，但为了直观，也用了 Vue `delimiters: ['[[', ']]']` 自定义分隔符。

### 8.2 不要使用 `toISOString()`

JavaScript 的 `toISOString()` 返回 UTC 时间。在东八区，凌晨 0~8 点的事件会被 UTC 算成"前一天"，导致：
- 列表里今天看不到刚记的事件
- 周视图日期高亮错位

**解决**：项目中一切日期/时间格式化都走自定义 `localDateStr / toLocalISO / nowLocalISO`。

### 8.3 `datetime.fromisoformat()` 不支持 Z

Python < 3.11 不支持 `'2025-05-14T08:00:00Z'`。统一用 `parse_iso()` 做兼容。

### 8.4 Vue 滚轮选择器初始位置

挂载时直接 `scrollTop = index * 36` 在 iOS Safari 上偶尔不生效，需要：
```js
nextTick(() => {
  requestAnimationFrame(() => {
    columnRef.value.scrollTop = index * ITEM_H
  })
})
```

### 8.5 进行中事件的视觉权重

`.sleep-ongoing` 用浅蓝底 `#eef6ff` + 1px 边框，比已结束事件更显眼，让家人一眼就能看到"宝宝正在睡"。

### 8.6 LocalStorage 持久化

`babytrack:babyName` 存 localStorage，刷新不丢，挂载时同步到 `document.title`。

## 9. 本地开发

```bash
cd babytrack
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

浏览器访问 `http://localhost:5000`。Flask debug 模式自动重载 Python；改 HTML/JS/CSS 直接刷新即可。

## 10. 树莓派部署（一键脚本）

### 10.1 硬件
- 树莓派 5（4GB RAM + 64GB TF 卡）
- Raspberry Pi OS (Debian Bookworm)
- 已联网

### 10.2 上传项目

```bash
# A. git 克隆
cd ~ && git clone <你的仓库地址> babytrack
# B. 或 rsync 上传
rsync -av --exclude '.venv' --exclude 'data/*.db' ./babytrack/ pi@<IP>:~/babytrack/
```

### 10.3 一键部署

```bash
cd ~/babytrack
bash install.sh
```

`install.sh` 干的事（幂等）：
1. `apt install python3-venv nginx avahi-daemon`
2. 创建 `.venv` + `pip install -r requirements.txt`
3. 写 systemd 服务 `/etc/systemd/system/babytrack.service`（Gunicorn 跑在 127.0.0.1:5000）
4. 写 Nginx 配置反代 80→5000
5. `hostnamectl set-hostname babytrack` + 启用 avahi
6. 启动并 enable 所有服务

完成后局域网访问：
```
http://babytrack.local
```

### 10.4 自定义参数

```bash
BABYTRACK_HOSTNAME=mybaby bash install.sh   # → http://mybaby.local
BABYTRACK_NO_NGINX=1     bash install.sh    # 退回 :5000 直出
BABYTRACK_WORKERS=4      bash install.sh    # 改 gunicorn worker 数
```

### 10.5 增量更新

```bash
cd ~/babytrack && bash deploy.sh
```

`deploy.sh` 干的事：
- `git pull` 检测变化
- 仅当 `requirements.txt` 变化时才 `pip install`
- 仅当代码变化时才 `systemctl restart babytrack`

可设 cron 自动更新：
```cron
*/5 * * * * /home/pi/babytrack/deploy.sh >> /home/pi/babytrack/data/deploy.log 2>&1
```

### 10.6 数据备份

```bash
0 2 * * * cp /home/pi/babytrack/data/babytrack.db \
            /home/pi/babytrack/data/backup_$(date +\%Y\%m\%d).db
```

## 11. GitHub Pages 只读快照

让你在外网（移动网络/外地）也能查看记录。

### 11.1 工作原理

```
Pi 上 cron */5 ──▶ tools/sync_to_github.sh
                       │
                       ├─ python tools/export_snapshot.py
                       │     └─ 读 SQLite，生成 docs/data/snapshot.json（最近 14 天）
                       ├─ cp server/static/css/main.css docs/main.css
                       └─ git diff docs/  →  有变化则 commit + push
                                                    │
                                                    ▼
                                          GitHub Pages (main / docs)
                                                    │
                                          https://你.github.io/<repo>/
```

### 11.2 一次性配置

```bash
# 1. GitHub 创建公开仓库（建议起个无关名字，如 fish-log）
# 2. Pi 配置 SSH key
ssh-keygen -t ed25519 -C "pi"
cat ~/.ssh/id_ed25519.pub  # 贴到 GitHub → Settings → SSH keys

# 3. 推送代码
cd ~/babytrack
git remote add origin git@github.com:你/fish-log.git
git add . && git commit -m "init"
git push -u origin main

# 4. GitHub 仓库 → Settings → Pages → Source: main /docs
# 5. 加 cron
crontab -e
# 添加：
*/5 * * * * /home/pi/babytrack/tools/sync_to_github.sh >> /home/pi/babytrack/data/sync.log 2>&1
```

### 11.3 静态版与主版的差异

`docs/` 下文件是简化版：
- 没有底部 5 个按钮
- 没有"+"号 / 编辑 / 删除
- 卡片不可点击
- 顶部多一条「只读快照 · 更新于 X 分钟前」横幅
- 数据来源：`fetch('./data/snapshot.json')`，**不调任何 API**
- 复用相同的 `main.css`，UI 视觉一致

### 11.4 隐私权衡

- 快照是 JSON，包含时间/毫升数/嘘嘘便便等，**不含个人身份信息**
- 建议：仓库名取个无关名字 + 昵称用「鱼宝」「豆豆」
- 想完全私密：改用 Tailscale / Cloudflare Tunnel 方案（不用 GitHub）

### 11.5 配置变量

```bash
SNAPSHOT_DAYS=30 python tools/export_snapshot.py    # 改导出天数
SNAPSHOT_OUTPUT=/path/to/x.json python tools/export_snapshot.py
```

## 12. 运维命令

```bash
# 服务状态
sudo systemctl status babytrack

# 重启 / 停止
sudo systemctl restart babytrack
sudo systemctl stop babytrack

# 实时日志（应用）
sudo journalctl -u babytrack -f

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 自动更新日志
tail -20 ~/babytrack/data/deploy.log

# 同步快照日志
tail -20 ~/babytrack/data/sync.log

# 手动跑一次快照同步（调试）
~/babytrack/tools/sync_to_github.sh

# 数据库简单查询
sqlite3 ~/babytrack/data/babytrack.db "SELECT * FROM events ORDER BY id DESC LIMIT 20;"
```

---

## 给 AI Agent 的复刻 Checklist

1. ✅ 创建目录结构（节 3）
2. ✅ 实现 `Event` 模型 + 8 种类型（节 4）
3. ✅ 实现 5 个 REST 端点（节 5）
4. ✅ 按照颜色 / 尺寸 / 字体规范写 `main.css`（节 6）
5. ✅ 用 Vue 3 CDN + `{% raw %}` 写 `index.html`（节 6.1, 8.1）
6. ✅ 写 `app.js`：本地时间工具 + 滚轮组件 + 7 种弹窗（节 7, 节 6.7）
7. ✅ 处理 4 大陷阱（节 8）
8. ✅ 写 `install.sh / deploy.sh`（节 10）
9. ✅ 写 `tools/export_snapshot.py + sync_to_github.sh + docs/`（节 11）

完成后用以下方式验收：
- 移动端宽度（Chrome DevTools iPhone 模拟）查看主页面，要求与节 6 描述完全一致
- 点击睡觉 → 弹起 + 滚轮 + 默认当前时间
- 列表中睡眠卡片浅蓝底 + 绿色"已睡 X 分钟"徽章
- 点击卡片可编辑、点 × 可删除（确认弹窗带 emoji 图标）
- 改宝宝昵称为"鱼宝"，刷新页面保持
