# PRD: 基于 Git Commit Hash 的项目知识库系统

## 背景

当前 CLAUDE.md 的 Architecture 节约 45 行详细描述，存在两个问题：

1. **每次会话全量加载**：无论任务是否涉及架构，都要读完整 Architecture 节，消耗 context window
2. **知识过期风险**：代码变更后 Architecture 描述可能过时，但缺乏机制检测和更新

随着项目增长（新增模块、命令、功能），CLAUDE.md 会越来越臃肿，问题会加剧。

## 目标

1. CLAUDE.md 瘦身，只保留概述 + 规则 + 知识库索引
2. 详细架构知识存储在独立文件中，按需读取
3. 基于 git commit hash 追踪知识时效性，自动检测过期
4. 通过 `zcc knowledge` CLI 子命令实现可靠的自动化操作（不依赖自然语言指令）
5. 支持增量更新——只重写变更模块对应的知识章节
6. 系统可随项目增长自然扩展

## 方案设计

### 目录结构

```
.knowledge/
  index.json                          # 主索引（per-section commit tracking）
  2026-04-10-fe7092e.md              # 知识快照（当前）
```

- `.knowledge/` 目录提交到 git，随代码版本控制
- 只保留 2 个快照文件（current + previous），旧的自动删除
- git history 提供完整变更追溯

### 索引文件 (index.json)

```jsonc
{
  "version": 1,
  "baseCommit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
  "updatedAt": "2026-04-10",
  "current": "2026-04-10-fe7092e.md",
  "previous": null,
  "sections": {
    "bin": {
      "commit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
      "paths": ["bin/"]
    },
    "config": {
      "commit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
      "paths": ["src/config/"]
    },
    "commands": {
      "commit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
      "paths": ["src/commands/"]
    },
    "proxy": {
      "commit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
      "paths": ["src/proxy/"]
    },
    "api": {
      "commit": "fe7092e909339f96ac4bc8e0a679d756bc02ef99",
      "paths": ["src/api/"]
    }
  }
}
```

**核心设计：**

- **使用完整 40 字符 commit hash**（不使用 `--short`），避免短 hash 在不同 clone、仓库增长后产生歧义。文件名中保留短 hash 仅作人类可读标识，所有比较逻辑基于完整 hash
- **per-section commit tracking**：每个 section 独立追踪验证 commit，支持增量更新
- **paths 数组**：每个 section 声明对应的源码路径列表，替代硬编码约定。支持多路径（如一个 section 跟踪 `src/config/` 和 `src/utils/`），也支持单文件路径
- **index.json 是唯一真相来源**：不使用 YAML frontmatter 或 HTML 注释存储 commit 信息，避免多源不同步

### 知识文件格式

```markdown
# Project Knowledge — fe7092e

## 入口与 CLI (bin/)

bin/cc.js 是 Commander.js 入口...
（详细描述）

## 配置层 (src/config/)

### loader.js
- 三层解析：custom path > local > global
...

### validator.js
- ID 校验正则：/^[a-zA-Z0-9._-]+$/
...

（每个模块的详细知识）

## 命令层 (src/commands/)

### launch.js
- 不合并 base 的设计原因...
...

## 代理层 (src/proxy/)
...

## API 层 (src/api/)
...

## 跨模块交互
- launch → loader.findProfile (mergeBase: false)
- use → loader.findProfile (mergeBase: true)
- serve → proxy/worker + config/loader
...

## 非显而易见的细节
- add 默认保存到 local config，其他命令默认 global
- settings.source.json 是一次性备份，永不被覆盖
...
```

**关键约定：**

- 每个 `##` 级别章节对应 index.json 中的一个 section key
- `## 跨模块交互` 和 `## 非显而易见的细节` 是特殊章节，无对应源码路径
- 知识文件不存储 commit 标记——index.json 是唯一真相来源

### `zcc knowledge` CLI 子命令

新增 `src/commands/knowledge.js`，提供以下子命令：

#### `zcc knowledge status`

检查知识库时效性，输出报告：

```
Knowledge Base Status
  Base commit: fe7092e  (HEAD matches)
  Knowledge file: .knowledge/2026-04-10-fe7092e.md

  Sections:
    bin       ✅ up to date
    config    ⚠️  stale (3 files changed since abc1234)
    commands  ✅ up to date
    proxy     ✅ up to date
    api       ✅ up to date
```

**实现逻辑：**
1. 读取 index.json
2. 获取完整 HEAD hash：`git rev-parse HEAD`
3. 对每个 section：`git diff <commit>..HEAD --numstat -- <paths>`
4. 按阈值规则分类：minor / significant / unchanged
5. 输出报告，退出码：0=全部最新，1=存在 stale sections

**阈值判断（基于 `git diff --numstat` 输出）：**

`--numstat` 输出格式：`<added>\t<deleted>\t<filename>`

```
totalChanged = sum(added + deleted) 对所有文件求和
changedFiles = 输出行数

分类规则：
  - changedFiles === 0 → unchanged
  - 有文件新增或删除（added=-1 或 deleted=-1 在 numstat 中标记重命名）→ significant
  - changedFiles === 1 且 totalChanged < 5 → minor（只更新 commit，不重写知识）
  - changedFiles >= 1 且 totalChanged >= 5 → significant（触发知识重写）
  - changedFiles >= 3 → significant（文件数阈值，无论行数）
```

#### `zcc knowledge update [--section <name>]`

更新知识库：

- 不带 `--section`：更新所有 significant stale sections
- `--section config`：强制更新指定 section（即使标记为 minor）

**执行流程：**
1. 运行 status 检查获取 stale sections
2. 如果全部 unchanged → 提示"知识库已是最新"，退出
3. 对每个 stale section：
   a. 生成 diff 摘要：`git diff <commit>..HEAD -- <paths>`
   b. 将 diff 摘要输出为结构化信息，供 Claude Code 读取后重写知识
   c. 更新 section 的 commit 为 HEAD hash
4. 以下情况同时标记特殊章节需要审查：
   - **跨模块交互**：≥2 个 section 同时 stale
   - **非显而易见的细节**：仅当涉及 section 的 paths 包含 `src/config/` 时
5. 输出 JSON 报告：

```json
{
  "headCommit": "abc1234...",
  "staleSections": ["config"],
  "specialSections": [],
  "minorSections": [],
  "diffSummary": {
    "config": {
      "files": ["src/config/loader.js"],
      "totalChanged": 12,
      "diff": "..."  // 简化的 diff 输出
    }
  },
  "knowledgeFile": ".knowledge/2026-04-10-fe7092e.md"
}
```

**文件写入策略（原子性保证）：**
1. 写入新知识文件到临时路径 `.knowledge/.tmp-<timestamp>.md`
2. 写入新 index.json 到临时路径 `.knowledge/.tmp-index-<timestamp>.json`
3. `fs.renameSync` 临时 index 为正式 index（原子操作）
4. `fs.renameSync` 临时知识文件为正式文件
5. 删除旧 previous 文件（如存在）
6. 如果任何步骤失败，临时文件在下次运行时自动清理

**知识文件重命名规则：**
- 文件名格式：`YYYY-MM-DD-<short-hash>.md`（短 hash 仅作人类标识）
- 如 HEAD 未变（同一天多次更新），使用序号：`2026-04-10-fe7092e-2.md`
- previous 文件：将原 current 移动为 previous，删除旧 previous

#### `zcc knowledge verify`

验证知识库完整性：

- 检查 index.json 格式正确
- 检查 current 指向的文件存在
- 检查每个 section 的 commit 是有效的 git commit
- 检查知识文件中章节标题与 index.json sections key 对应
- 输出验证结果，退出码：0=通过，1=发现问题

#### `zcc knowledge rebuild`

从零重建知识库（覆盖现有）：

1. 全量扫描 src/ 和 bin/ 下的所有文件
2. 生成新的知识快照
3. 创建新的 index.json
4. 输出新文件路径，由 Claude Code 填充详细内容

### CLAUDE.md 改造

**删除**：整个 Architecture 节（约 45 行详细描述）

**替换为**：

```markdown
## Knowledge Base

项目知识库位于 `.knowledge/`，通过 `zcc knowledge` 管理。

**开始任何开发任务前，执行 `zcc knowledge status`。如果有 stale sections，执行 `zcc knowledge update`。**

- `zcc knowledge status` — 检查知识库时效性
- `zcc knowledge update` — 增量更新过期章节
- `zcc knowledge verify` — 验证知识库完整性
- `zcc knowledge rebuild` — 从零重建（仅在损坏时使用）

Section 到源码路径的映射定义在 `.knowledge/index.json` 的 `sections` 字段中，新增模块时需更新。
```

### 合并冲突处理

**index.json 冲突（最常见场景）：**
```
 ours:   sections.config.commit = "aaa..."
 theirs: sections.config.commit = "bbb..."
```

解决策略：
1. 运行 `zcc knowledge verify` 检查当前状态
2. 对冲突的 section，取双方 commit 的最近公共祖先（`git merge-base aaa bbb`），然后重新验证
3. 如果仍有歧义，运行 `zcc knowledge update --section <name>` 强制重新生成

**知识文件冲突：**
- 知识文件是全文本，冲突概率低
- 如果冲突，运行 `zcc knowledge rebuild` 重建

**在 index.json 中记录冲突处理提示：**
```jsonc
{
  // ... existing fields ...
  "_comment": "合并冲突时运行 zcc knowledge verify 检查完整性"
}
```

### Section 动态管理

当项目结构变化时（新增/删除/移动目录）：

1. **新增模块**：在 index.json 的 sections 中添加新条目，指定 paths，commit 设为当前 HEAD
2. **删除模块**：从 sections 中移除条目，知识文件中删除对应章节
3. **移动文件**：更新对应 section 的 paths 数组
4. `zcc knowledge verify` 会检测 section 路径是否对应实际存在的文件

### 增量更新详细流程

```
zcc knowledge update 执行流程:

1. 读取 index.json
2. git rev-parse HEAD → currentHash (完整 40 字符)
3. 对每个 section (key, {commit, paths}):
   → git diff <commit>..currentHash --numstat -- <paths>
   → 按阈值规则分类: unchanged / minor / significant
4. 收集 significant sections + 需要审查的特殊章节
5. 输出 JSON 报告（staleSections, diffSummary）
6. 等待 Claude Code 基于报告重写知识文件中的 stale 章节
7. Claude Code 完成后，确认更新：
   → 写入新知识文件（原子写入）
   → 更新 index.json：
     - sections[key].commit = currentHash (更新的 sections)
     - baseCommit = currentHash
     - updatedAt = 当前日期
     - previous = 原 current
     - current = 新文件名
   → 删除旧 previous 文件
```

### 初始引导 (Bootstrap)

首次使用时的流程：

1. 运行 `zcc knowledge rebuild`
2. Claude Code 全量分析项目源码，填充知识快照内容
3. 验证：`zcc knowledge verify`
4. 更新 CLAUDE.md，替换 Architecture 节为知识库索引

后续会话按 `status → update` 流程执行。

## 测试计划

### 单元测试：`tests/commands/knowledge.test.js`

| 用例 | 测试内容 |
|------|---------|
| status: no changes | HEAD == baseCommit，所有 section unchanged，退出码 0 |
| status: single section stale | 一个 section 有 significant 变更，退出码 1 |
| status: minor change | 单文件 <5 行变更，分类为 minor |
| status: unchanged | section commit == HEAD，标记 unchanged |
| status: new file added | numstat 中检测到新增文件，分类为 significant |
| status: 3+ files changed | 无论行数，分类为 significant |
| update: all unchanged | 无 stale sections，提示已最新 |
| update: single section | 只重写一个章节，其他保持不变 |
| update: multiple sections | 多个 section 同时 stale |
| update: minor only | 只有 minor sections，只更新 commit 不重写知识 |
| update: --section flag | 强制更新指定 section |
| update: cross-module | ≥2 sections stale 时标记跨模块交互需审查 |
| update: same day rename | 同一天 HEAD 不变时的序号命名 |
| verify: valid index | 完整性检查通过 |
| verify: missing file | current 指向的文件不存在 |
| verify: invalid commit | section commit 不是有效 git hash |
| verify: section mismatch | 知识文件章节与 index sections 不匹配 |
| rebuild: clean | 从零生成 index.json 和知识文件 |
| atomic write | 写入过程中断后临时文件不影响现有文件 |
| merge conflict resolution | 模拟 index.json 冲突后 verify + update 修复 |

### 集成测试

| 用例 | 测试内容 |
|------|---------|
| full lifecycle | rebuild → status(up-to-date) → modify file → status(stale) → update → status(up-to-date) |
| add new section | 添加新 section → rebuild → verify |
| remove section | 删除 section → update → verify |

## 改动范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/commands/knowledge.js` | 新建 | knowledge 子命令实现 |
| `tests/commands/knowledge.test.js` | 新建 | knowledge 命令测试 |
| `.knowledge/index.json` | 新建 | 知识库索引 |
| `.knowledge/2026-04-10-fe7092e.md` | 新建 | 初始知识快照 |
| `bin/cc.js` | 修改 | 注册 knowledge 子命令 |
| `CLAUDE.md` | 修改 | 删除 Architecture 节，替换为 Knowledge Base 索引 |

## 验收标准

1. CLAUDE.md 中不再包含详细架构描述，只有知识库索引
2. `.knowledge/index.json` 包含 per-section commit tracking（完整 40 字符 hash）
3. `.knowledge/` 中有初始知识快照
4. `zcc knowledge status` 能正确检测 stale sections
5. `zcc knowledge update` 能增量更新过期章节
6. `zcc knowledge verify` 能验证知识库完整性
7. `zcc knowledge rebuild` 能从零重建
8. 所有测试用例通过
9. 文件写入使用原子操作，崩溃不会损坏现有文件
