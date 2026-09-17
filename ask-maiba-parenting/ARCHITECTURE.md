# 问问麦爸育儿 · MVP 架构

## 当前可用架构（v0.1）

```text
H5 UI
  ↓
Question + Age
  ↓
Local Retriever（关键词/年龄打分）
  ↓
Curated Parenting Knowledge Base
  ↓
Answer Composer
  ↓
理解 → 行动 → 可直接说的话 → 来源
  ↓
LocalStorage Conversation Memory
```

当前版本不需要 API Key、数据库或后端，打开即用；聊天只保存在用户自己的浏览器 LocalStorage。

## 与正式版保持一致的分层

```text
Channel Layer
Web H5 / 微信小程序 / 企业微信
        ↓
Identity & Session
用户 / 会员 / 会话 / 权限
        ↓
Agent Router
问问麦爸 / 情绪助手 / 作业助手 / 青春期助手 ...
        ↓
Skill Layer
场景识别 / 追问 / 回答结构 / 风险分流
        ↓
Knowledge Hub
麦爸原创内容 + 公开循证资料 + 案例库
        ↓
Retrieval Layer
全文检索 / embedding / rerank / metadata filter
        ↓
Model Gateway
GPT / Claude / Gemini / DeepSeek
        ↓
Memory
conversation / child_profile / family_context / summary
```

## 下一阶段替换点

`app.js` 中只有这一行需要升级：

```js
const answerProvider = async (question) => localRagProvider(question);
```

替换为：

```js
const answerProvider = async (question) => {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({question, age: selectedAge})
  });
  return res.json();
};
```

后端再接：FastAPI + PostgreSQL/pgvector + Qdrant（可选）+ Model Gateway。

## 第一版知识来源

- CDC Child Development / Essentials for Parenting
- American Academy of Pediatrics / HealthyChildren.org
- UNICEF Parenting / Asia Pacific
- WHO Helping Adolescents Thrive（后续正式知识库扩充）

所有条目均为重新归纳的知识卡，不复制原文；前端回答附公开来源链接。
