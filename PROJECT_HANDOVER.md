# Luxe Trade Catalog 项目交接必读

> 接手本项目的 AI 或开发者，请先完整阅读本文件，再阅读 `AGENTS.md`。  
> 本文件负责快速理解项目全貌和常规操作；`AGENTS.md` 是更严格的工程规则和发布约束。

## 1. 项目是什么

这是一个面向外贸批发场景的化妆品商品目录网站。

客户侧主要流程：

1. 访问网站浏览商品。
2. 按品牌、分类、关键词搜索商品。
3. 进入商品详情页选择色号/类型和数量。
4. 加入购物车。
5. 在购物车选择运费国家：`Europe` 或 `United States`。
6. 创建订单号。
7. 网站通过 WhatsApp 向商家发送订单号文本，不直接把购物车明细塞进聊天内容。

商家侧主要流程：

1. 登录后台 Admin。
2. 新增、编辑、发布、归档商品。
3. 上传商品主图和多张详情图。
4. 输入订单号下载订单 Excel。
5. 使用订单 Excel 给仓库配货、核价、出单。

核心业务目标是：客户少操作、商家好维护、订单信息准确、图片展示快。

## 2. 重要地址和角色

| 类型 | 信息 |
| --- | --- |
| 生产主站 | `https://bebeauty.top/` |
| 生产主机 | 腾讯云 `43.166.137.208` |
| 备用主机 | 阿里云 `101.132.36.115` |
| GitHub 仓库 | `xie666888/mandy_fisrt_website` |
| GitHub SSH | `git@github.com:xie666888/mandy_fisrt_website.git` |
| 当前主要工作分支 | `codex/tencent-primary-replication` |
| 最近一次已推送提交 | `7ff2bd1 Fix admin shade persistence and order total formula` |

注意：

- 腾讯云是唯一生产主机。
- 阿里云是热备机，不要直接在阿里云改代码、商品、数据库或图片。
- 正常流向是：`本地开发 -> GitHub -> 腾讯云 -> rsync 同步到阿里云`。
- 不要把阿里云数据反向同步回腾讯云，除非明确进入灾备恢复流程。
- 本文档不会记录任何密码、私钥、Session Secret 或 `.env` 内容。

## 3. 本地目录说明

当前机器上常见两个目录：

| 用途 | 路径 |
| --- | --- |
| 用户工作目录，可能包含数据文件、Excel、数据库副本 | `C:\Users\Administrator\Documents\Codex\2026-05-17\files-mentioned-by-the-user-2026` |
| GitHub 源代码工作副本 | `C:\Users\Administrator\Documents\Codex\2026-05-17\github-publish\mandy_fisrt_website` |

建议：

- 改代码、提交 GitHub 时，优先使用 Git 工作副本目录。
- 不要把本地的 `catalog.sqlite3`、商品图片、Excel 原始表、订单文件提交到 GitHub。
- 如果从生产同步了数据/图片到本地，只能作为开发和备份使用，不要随意覆盖线上。

## 4. 服务器运行目录

腾讯云和阿里云采用相同目录结构：

| 用途 | 路径 |
| --- | --- |
| 应用源码 | `/opt/luxe-catalog` |
| Python 虚拟环境 | `/opt/luxe-catalog/.venv` |
| SQLite 数据库 | `/var/lib/luxe-catalog/catalog.sqlite3` |
| 上传图片和缩略图 | `/var/lib/luxe-catalog/uploads` |
| 环境变量文件 | `/etc/luxe-catalog.env` |
| systemd 服务 | `luxe-catalog.service` |
| Nginx 配置 | `/etc/nginx/conf.d/luxe-catalog.conf` |
| HTTPS 证书 | `/etc/nginx/ssl/bebeauty.top/` |
| 每日备份 | `/var/backups/luxe-catalog` |

服务关系：

- Python 应用只监听 `127.0.0.1:4173`。
- 公网入口是 Nginx，不要对公网暴露 `4173`。
- HTTPS 要保持开启，否则后台 Session Cookie 的 Secure 策略可能失效。

## 5. SSH 和同步方式

推荐本地 SSH 别名：

```bash
ssh luxe-tencent
ssh luxe-alibaba
```

腾讯云同步到阿里云：

```bash
ssh luxe-tencent "sudo systemctl start luxe-replication.service"
ssh luxe-tencent "sudo systemctl --no-pager --full status luxe-replication.service"
```

同步原则：

- 只从腾讯云同步到阿里云。
- SQLite 不能直接 `rsync` 活文件，必须通过一致性备份再安装。
- 不要使用未确认路径的 `rsync --delete`。
- 不要为了方便部署而打开 SSH 密码登录、关闭 Fail2ban、关闭防火墙或放宽 Nginx 限速。

## 6. 技术架构

| 层 | 技术 |
| --- | --- |
| 后端 | Python 标准库 HTTP Server，入口 `server.py` |
| 数据库 | SQLite |
| 前端 | `index.html` + `src/app.js` + `src/styles.css` |
| Excel | `openpyxl` |
| 图片 | Nginx 直接服务原图和上传图，后台缩略图走 `/api/thumb` |
| 鉴权 | 服务端 Session Cookie |
| 反向代理 | Nginx |
| 进程管理 | systemd |

重要文件：

| 文件 | 作用 |
| --- | --- |
| `server.py` | API、鉴权、SQLite、订单创建、订单 Excel、SEO 页面 |
| `src/app.js` | 前台交互、购物车、后台管理页面 |
| `src/styles.css` | 全站样式 |
| `index.html` | SPA 入口 |
| `AGENTS.md` | 项目硬规则，任何 AI 修改前必须阅读 |
| `PROJECT_HANDOVER.md` | 本交接文档 |

## 7. 不要恢复的旧功能

以下功能已明确废弃，不要重新加回来：

- 后台商品 Excel 导入。
- 后台商品 Excel 导出。
- Reset to original Excel data。
- 批量清空商品并导入 Excel 的后台入口。

仍要保留：

- 后台订单 Excel 下载。
- 通过订单号下载对应订单 Excel。

## 8. 商品和后台管理规则

- 商品删除是“归档”，不是物理删除数据库行。
- 已归档商品不出现在前台列表和 sitemap。
- 商品即使名称类似、SKU 类似、图片类似，也不能自动去重。
- 必填字段：`SKU`、`Brand`、`Item Name`、`Price`、`Colors / shade options`。
- `Price (USD)` 和 `Weight (kg)` 必须是大于 0 的整数或小数。
- 图片文件名可以包含中文或其他 Unicode 字符。
- 主图和详情图必须可以单独删除，删除一张不能清空全部图片。
- 后台图片预览应显示缩略图，不显示路径输入框给用户看。
- 后台保存成功提示要在用户当前编辑区域附近可见。
- 后台列表必须保留搜索和分页。

## 9. 色号规则

这是非常容易改错的地方：

- 色号只用 `/` 分隔。
- 空格不分隔。
- `-` 不分隔。

例子：

```text
1/2/3   -> 3 个色号：1、2、3
1 2 3   -> 1 个色号：1 2 3
1-2-3   -> 1 个色号：1-2-3
```

后台保存时：

- `Colors / shade options` 输入框是权威数据。
- `Product information` 里的 `Colors:` 只允许作为旧数据兜底展示。
- 不能让 `Product information` 覆盖后台颜色框的显式输入。

最近修复过的相关问题：

- 商品 `DC-YPG-GG-01` 曾被存成 `["1 2 3 4 5 6"]`，导致无法显示成 6 个独立色号。
- 已修复为 `["1", "2", "3", "4", "5", "6"]`。
- 对应代码提交：`7ff2bd1 Fix admin shade persistence and order total formula`。

## 10. 运费规则

客户和后台可见汇总只展示 `Shipping weight`，不展示汇总区的 `Product weight`。

Europe 运费规则：

| Shipping weight | Cost |
| --- | --- |
| `weight <= 0.7kg` | `$31.20` |
| `0.7kg < weight <= 1.5kg` | `$35.20` |
| `1.5kg < weight <= 2kg` | `$43.80` |
| `2kg < weight <= 3kg` | `$52.30` |
| `3kg < weight <= 4kg` | `$61.80` |
| `4kg < weight <= 5kg` | `$72.30` |
| `5kg < weight <= 6kg` | `$81.40` |
| `weight > 6kg` | 先加 `2kg` 包装重量，再按 `0.5kg` 向上取整，最后 `$10.80/kg` |

示例：

```text
7.23kg 商品重量 -> 7.23 + 2 = 9.23 -> 向上取整到 9.5kg
7.68kg 商品重量 -> 7.68 + 2 = 9.68 -> 向上取整到 10kg
```

要求：

- 浏览器购物车估算、服务端订单计算、数据库订单、订单 Excel 汇总必须一致。
- 美国运费不使用 Europe 的加 2kg 包装规则。

## 11. 订单 Excel 规则

订单 Excel 是商家给仓库使用的关键文件，改动要非常谨慎。

当前商品明细列：

| 列 | 名称 |
| --- | --- |
| A | `NO` |
| B | `Brand` |
| C | `Item Name` |
| D | `Picture` |
| E | `Shade/Type` |
| F | `Unit Price` |
| G | `QTY` |
| H | `Product weight(kg)` |
| I | `Extended price` |
| J | `Informations` |
| K | `Unit weight helper`，隐藏列 |

合并规则：

- 按 `Brand + Item Name + Unit Price + Picture` 合并。
- 同一商品不同色号合并到一行。
- `QTY` 是合计数量。
- `Shade/Type` 每个色号一行。
- `Informations` 格式为：`Shade * QTY PCS`，多个色号换行。
- 如果同一色号出现多次，先合并数量再显示一次。

图片规则：

- Excel 图片放在 `Picture` 列。
- 宽度约 `119px`。
- 保持原图高宽比例。
- 目标是普通 Excel 视图一屏能看到约 6-7 条订单。

公式规则：

- `Product weight(kg)` 行内用公式计算。
- `Extended price` 行内用公式计算。
- 汇总区必须用公式，不要写死静态值。
- 汇总区不显示 `Product weight`。
- `TOTAL` 必须等于 `Total product cost + SHIPPING COST`。

最近修复过的相关问题：

- `TOTAL` 曾因空白行导致引用错位。
- 已修复为明确引用 `Total product cost` 行和 `SHIPPING COST` 行。
- 临时测试应看到类似：`TOTAL = J8 + J10`。
- 对应代码提交：`7ff2bd1 Fix admin shade persistence and order total formula`。

## 12. 前台体验规则

- 商品图片点击进入详情页，并滚动到页面顶部。
- 推荐商品点击后也要到详情页顶部。
- 加入购物车后不跳转购物车，只给动画/提示。
- 只有点击顶部购物车才进入购物车页。
- 商品卡片必须有 Quick Add。
- 商品图片要固定展示框，保持比例，不溢出。
- 首页和商品页尽量紧凑，把空间留给商品。
- 不要恢复大 Hero 图、价格筛选组件、顶部右侧装饰商品区。
- 桌面端品牌侧边栏和顶部搜索/购物车区域要保持滚动时可用。
- 全站英文界面字体使用 Arial。

## 13. SEO 和 GEO 规则

- 标准域名：`https://bebeauty.top`。
- 每个发布商品都有稳定 URL：`/product/<percent-encoded-product-id>`。
- 商品 ID 要稳定，不要随便改。
- `/sitemap.xml` 包含首页和所有已发布未归档商品。
- `/robots.txt` 指向 sitemap，并禁止 `/api/`。
- `/llms.txt` 给生成式搜索系统读取业务说明。
- 商品页需要保留：title、description、canonical、Open Graph、Product JSON-LD、Breadcrumb JSON-LD、FAQ JSON-LD、H1、图片 alt、相关商品链接。
- 不要编造评价、评分、库存承诺、认证、地址或物流保证。
- 归档或未发布商品应返回 404，并从 sitemap 移除。

## 14. 安全规则

- 后台必须是服务端鉴权，不能退回浏览器硬编码密码。
- Session Secret、管理员密码、私钥、`.env` 不进 Git。
- API 返回 `X-Robots-Tag: noindex, nofollow`。
- 后端只绑定 `127.0.0.1:4173`。
- Nginx、Fail2ban、firewalld、systemd hardening 不要随便放松。
- 不要把 `/etc/luxe-catalog.env` 覆盖掉。
- 不要把生产数据库、图片、订单 Excel、备份归档提交 GitHub。

## 15. 性能规则

- 保持 Nginx 直接服务图片。
- 保持 gzip、open-file cache、图片长缓存、安全响应头。
- 不要降低原图分辨率来提速。
- 后台用缩略图降低传输和渲染压力。
- API 不返回图片二进制，只返回路径。
- 当前规模不需要 Redis，除非有真实性能数据证明 SQLite/Nginx 缓存不够。

## 16. 常规代码修改流程

接手后每次改代码，建议按这个顺序：

1. 读 `PROJECT_HANDOVER.md` 和 `AGENTS.md`。
2. 到 Git 工作副本查看状态：

```bash
cd "C:\Users\Administrator\Documents\Codex\2026-05-17\github-publish\mandy_fisrt_website"
git status --short --branch
```

3. 确认远端分支：

```bash
git fetch git@github.com:xie666888/mandy_fisrt_website.git codex/tencent-primary-replication
git log -3 --oneline
```

4. 只修改必要文件，不碰数据库、图片、`.env`、备份。
5. 本地检查：

```bash
python -m py_compile server.py
node --check src/app.js
```

6. 如果改了订单 Excel，必须构造临时订单验证公式和列结构。
7. 检查 diff：

```bash
git diff --stat
git diff --check
```

8. 提交代码：

```bash
git add <changed-files>
git commit -m "简短说明本次变更"
```

9. 推送 GitHub：

```bash
git push git@github.com:xie666888/mandy_fisrt_website.git HEAD:codex/tencent-primary-replication
```

10. 部署到腾讯云。
11. 验证腾讯云。
12. 触发腾讯云同步阿里云。
13. 验证阿里云。

## 17. 腾讯云部署流程

只部署代码，不覆盖数据、图片、环境文件或虚拟环境。

示例：

```bash
scp server.py index.html AGENTS.md PROJECT_HANDOVER.md luxe-tencent:/tmp/
scp src/app.js src/styles.css luxe-tencent:/tmp/
```

安装文件：

```bash
ssh luxe-tencent "set -e
sudo install -o luxe -g luxe -m 0644 /tmp/server.py /opt/luxe-catalog/server.py
sudo install -o luxe -g luxe -m 0644 /tmp/index.html /opt/luxe-catalog/index.html
sudo install -o luxe -g luxe -m 0644 /tmp/AGENTS.md /opt/luxe-catalog/AGENTS.md
sudo install -o luxe -g luxe -m 0644 /tmp/PROJECT_HANDOVER.md /opt/luxe-catalog/PROJECT_HANDOVER.md
sudo install -o luxe -g luxe -m 0644 /tmp/app.js /opt/luxe-catalog/src/app.js
sudo install -o luxe -g luxe -m 0644 /tmp/styles.css /opt/luxe-catalog/src/styles.css
cd /opt/luxe-catalog
sudo -u luxe .venv/bin/python - <<'PY'
source = open('server.py', encoding='utf-8').read()
compile(source, 'server.py', 'exec')
print('server.py syntax ok')
PY
sudo systemctl restart luxe-catalog
sudo nginx -t
systemctl is-active luxe-catalog nginx firewalld fail2ban
"
```

说明：

- 如果服务器没有 `node`，JS 语法检查在本地做即可。
- 服务器上 `__pycache__` 可能权限不适合 `py_compile` 写缓存，所以用 `compile(...)` 方式检查语法更稳。
- 如果只改了部分文件，只上传和安装对应文件。

## 18. 发布后验证清单

腾讯云至少验证：

```bash
ssh luxe-tencent "systemctl is-active luxe-catalog nginx firewalld fail2ban"
ssh luxe-tencent "sudo nginx -t"
```

公网验证：

```bash
python - <<'PY'
import urllib.request
for url in [
    'https://bebeauty.top/',
    'https://bebeauty.top/api/products',
    'https://bebeauty.top/robots.txt',
    'https://bebeauty.top/sitemap.xml',
    'https://bebeauty.top/llms.txt',
]:
    with urllib.request.urlopen(url, timeout=20) as r:
        print(url, r.status)
PY
```

如改了商品页/SEO：

- 抽查一个 `/product/<id>` 页面。
- 检查 canonical、JSON-LD、H1、图片是否正常。

如改了后台：

- 登录 Admin。
- 搜索商品。
- 编辑保存商品。
- 上传/删除主图和详情图。
- 归档商品后列表应消失。

如改了订单：

- 用真实或测试订单号下载 Excel。
- 检查 Arial 字体。
- 检查图片大小。
- 检查同名商品合并。
- 检查 `Product weight(kg)` 明细列存在。
- 检查汇总区不显示 `Product weight`。
- 检查 `TOTAL = Total product cost + SHIPPING COST`。

## 19. 同步阿里云流程

腾讯云验证无误后，同步阿里云：

```bash
ssh luxe-tencent "sudo systemctl start luxe-replication.service && sleep 8 && sudo systemctl --no-pager --full status luxe-replication.service | tail -n 30"
```

阿里云验证：

```bash
ssh luxe-alibaba "sha256sum /opt/luxe-catalog/server.py /opt/luxe-catalog/src/app.js /opt/luxe-catalog/index.html /opt/luxe-catalog/AGENTS.md /opt/luxe-catalog/PROJECT_HANDOVER.md; systemctl is-active luxe-catalog nginx"
```

如果有数据库变更或商品数据修复，还要检查：

```bash
ssh luxe-alibaba "sudo -u luxe python3 - <<'PY'
import sqlite3
conn = sqlite3.connect('/var/lib/luxe-catalog/catalog.sqlite3')
print(conn.execute('PRAGMA integrity_check').fetchone()[0])
print('products', conn.execute('SELECT COUNT(*) FROM products').fetchone()[0])
print('orders', conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0])
conn.close()
PY"
```

## 20. 备份和恢复

- 腾讯云每日自动备份，保留最近 3 份。
- 备份包含源码、上传图、SQLite 一致性快照、环境和服务配置、Nginx 配置、TLS 证书、Fail2ban 配置、同步单元等。
- 阿里云是热备，不等同于版本化备份。
- 恢复前必须先校验归档和 SQLite 完整性。
- 灾备切换必须明确声明“阿里云被提升为主机”，并停掉腾讯到阿里的正常同步。

## 21. 最近一次已知发布状态

最近一次修复内容：

- 修复后台色号保存被 Product information 覆盖的问题。
- 修复 `DC-YPG-GG-01` 色号数据为 6 个独立值。
- 修复订单 Excel `TOTAL` 公式错位。

已验证状态：

- 腾讯云 `luxe-catalog`、`nginx`、`firewalld`、`fail2ban` 正常。
- 阿里云 `luxe-catalog`、`nginx` 正常。
- 腾讯云和阿里云关键代码文件哈希一致。
- GitHub 远端分支 `codex/tencent-primary-replication` 已推送到提交 `7ff2bd1`。

## 22. 新 AI 接手时的第一句话

建议新 AI 接手后先执行：

```text
我会先阅读 PROJECT_HANDOVER.md 和 AGENTS.md，确认 Git 状态、腾讯云/阿里云同步状态，再开始修改。不会提交密码、数据库、图片或订单文件。
```

然后按本文件第 16-19 节执行。

