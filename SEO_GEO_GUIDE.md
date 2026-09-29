# BeBeauty SEO / GEO 优化与运营指南

检查日期：2026-09-30。生产站：https://bebeauty.top/ 。

## 1. 先说结论

SEO 是帮助搜索引擎发现、理解并展示真实页面；这里的 GEO 指生成式搜索优化，不是地理位置优化。两者共同的基础是可访问、可信、具体、有用的内容。没有一种设置能保证排名、流量、订单或 AI 引用。

本轮不改商品、价格、订单、图片原文件，也不批量改写商品名称。不制造虚假评价、销量、正品保证或品牌授权。不恢复大横幅，保持商品优先的紧凑布局。

## 2. 实际发现与对应改动

| 发现的问题 | 处理 |
| --- | --- |
| 首页原始 HTML 只有空容器，依赖浏览器运行 JS 才能看到商品 | Python 输出真实商品、价格、图片及链接；Nginx 首页改走应用 |
| 品牌/类别只有按钮，爬虫难以顺着链接发现商品 | 改为真实链接，同时保留无刷新筛选与新标签打开 |
| 品牌筛选没有独立标题和规范地址 | 单品牌、单类别有独立标题、H1、描述、canonical 和站点地图入口 |
| 筛选组合容易制造大量重复页面 | 组合筛选、站内搜索、NEW ARRIVALS 不进入索引；真实单品牌/类别可以进入 |
| 商品切换后 JSON-LD 和分享图片可能残留上一个商品 | 切换时重建元数据；后台、购物车不保留商品结构化数据 |
| 商品 SSR 缺少色号与实际 FAQ 回答 | 加入真实色号、可见问答和相关商品，结构化内容与页面一致 |
| 已删除/未知商品可能在浏览器内显示另一件商品 | 删除“找不到就显示第一件”的回退，显示不可用状态；服务器保持 404 |
| 地图只有商品和主图，发现路径较少 | 加入品牌、类别、订购说明及详情图片，使用实际修改时间 |
| 商品 HTML 可短期缓存旧价格/状态 | HTML 与地图要求重新校验，不长期缓存商品信息；图片长缓存不变 |
| 订购规则只有详情页问答 | 增加 `/ordering`，无需 JS 即可阅读，链接置于页底 |
| 商品更新只能等爬虫自行发现 | IndexNow 每日只提交新增、修改、删除的公开 URL |
| HTTPS 手动证书即将到期 | 改由现有 Certbot 管理根域名和 www，部署钩子自动安装和重载 |
| 维护文档可能被直接访问 | 禁止通过站点访问 Markdown、部署目录等内部文件 |

首页与筛选页给所有访客、所有爬虫提供相同内容，不做按爬虫身份展示不同商品的处理。图像原始分辨率保持不变；首屏优先加载，其余延迟加载。

## 3. 哪些方法明确不采用

- 不购买外链、不刷搜索、不做隐藏关键词、城市门页或成千上万篇重复 AI 文案。
- 不把未知库存标记为 InStock，不制造评分、评论、退货天数、认证或品牌授权。
- 不把 `llms.txt` 当成排名开关。保留它作为事实导航，但 Google 明确不要求这类特殊文件。
- 不承诺 FAQ 富结果。Google 的更新说明已宣布该展示功能停用；可见问答本身仍有客户服务价值。
- 不将所有筛选排列都放入站点地图，不索引购物车、后台或客户订单。
- 不为了 SEO 降低防火墙、登录鉴权和限流保护；不能只凭 User-Agent 给所谓爬虫免限流。
- 不额外部署 Redis 或更换网站框架。当前问题主要在内容可读性和链接，而非缓存缺失。

## 4. 产品真实性与平台资格：必须先确认

站点原有 Q/A 明确写着产品为 replica，不作为品牌正品销售。本轮保留该说明，机器可读资料也与之保持一致。

Google Merchant Center 禁止仿冒商品。不能通过增加“正品”描述、删掉披露、伪造授权或商品 Feed 绕过资格要求，因此本轮不创建 Shopping/广告商品 Feed。是否拥有商标使用、销售或品牌授权，需要商户依据真实文件确认，不能由代码猜测。若经营方向和供货资质改变，再同步调整页面事实与平台申请。

## 5. 还需要商户账号配合的事项

以下尚不能仅凭服务器权限完成，不要把“已部署代码”理解为“已在站长平台验证/收录”。不要把账号密码发送给开发者；优先使用站长平台授权。

1. Google Search Console：添加 `bebeauty.top` 域名资源，在域名 DNS 添加平台给出的 TXT 验证记录；提交 `https://bebeauty.top/sitemap.xml`。
2. Bing Webmaster Tools：验证站点并提交同一地图；查看抓取、索引和 AI Performance 报告。可以使用平台提供的 Google 资源导入方式。
3. 验证后抽查首页、一个品牌页和几个商品页，使用 URL 检查。提交是发现信号，不代表立即收录。
4. 定期查看安全问题、人工措施、抓取错误、重复 canonical 和排除原因，不要只看“总页面数”。
5. 要分析成交漏斗，可再接入经商户批准的分析工具和适当的隐私/同意机制。当前未擅自安装广告像素或客户追踪脚本。

## 6. 内容建设：不占商品首屏的做法

优先补充后台的真实商品信息：容量/规格、色号名称、包装内容、清晰实拍、可核实的产品说明。不能仅复制竞争对手文案，也不能猜成分、功效、安全认证。相似规格仍是独立产品，不能为了 SEO 合并数据库记录。

在获得真实业务资料后，可以完善以下独立页面并从页底链接：

| 内容 | 需要商户提供什么 |
| --- | --- |
| 关于商户 / 联系方式 | 真实主体名称、有效联系渠道，允许公开的经营信息 |
| 支付与订单确认 | 实际支付流程、什么时候确认库存、取消订单的真实规则 |
| 运送范围与费用说明 | 明确的国家覆盖、税费由谁承担、真实物流限制 |
| 售后 / 隐私政策 | 实际售后条件、收集哪些客户信息及用途，不套用虚假模板 |
| 常见选购问题 | 客户真实反复咨询的问题与有依据的回答 |
| 品牌或类别购买指南 | 原创对比、实际规格信息，不伪装为品牌官方站 |

这些内容的价值在于回答买家的问题，不是机械增加字数。新增语言必须有人维护真实译文，再设置对应语言 URL 与 hreflang；不要为没有翻译的页面添加虚假多语言标记。只有真实线下经营地点且符合平台条件时，才考虑本地商家资料。

## 7. 如何判断有没有改善

建议以发布前后各 28 天作为初步观察窗口，剔除广告、节假日、价格与库存变化等影响；这是观察建议，不是见效保证。

- Google/Bing：有效收录的商品和品牌页、非品牌查询曝光、点击、点击率、真实搜索词。
- AI 搜索：Bing AI Performance 的引用页面与次数，以及实际带来的访问；不能用一次手工提问排名代替长期数据。
- 用户体验：真实用户第 75 百分位 LCP、INP、CLS，目标分别不高于 2.5 秒、200 毫秒、0.1。一次浏览器测试不等于线上真实用户达标。
- 生意指标：访问商品、加购、创建需求订单、商家确认、实际付款。当前订单是需求单，不是已付款销售，不可混为成交率。
- 维护质量：失效图片、404、5xx、证书到期、搜索通知失败、站点地图与公开商品数量不一致。

发布后仍需商户提供可信内容和外部真实提及，例如客户允许公开的合作案例、真实行业目录和合作方链接。不要购买批量外链或假评价。

## 8. 给后续 Agent 的操作说明

先读 `AGENTS.md`。只部署代码到腾讯云，生产数据库/图片以腾讯云为准，阿里云只接受既有复制流程。

重点文件：`server.py`、`src/app.js`、`src/styles.css`、`scripts/test_seo.py`、`scripts/test_seo_browser.cjs`、`scripts/submit_indexnow.py`、`deployment/seo/`。

验证命令：

```text
python -m py_compile server.py scripts/submit_indexnow.py
python scripts/test_seo.py
python scripts/test_merchandising.py
python -m scripts.test_sales_report
node --check src/app.js
node scripts/test_seo_browser.cjs https://bebeauty.top OUTPUT_DIRECTORY_OUTSIDE_REPO
```

浏览器脚本需要 Playwright 和本机 Edge；不提交订单，不修改产品，只在隔离浏览器会话中测试加购。截图放在仓库之外。

生产部署必须同步更新 Nginx 首页代理，否则新 HTML 渲染不会生效。`deployment/seo/configure_nginx.py` 仅用于腾讯云当前已核实布局，自动备份配置并在重载前验证；不要对未知服务器直接执行。

证书：Certbot 的 `bebeauty.top` 配置覆盖根域名和 www。钩子源码 `deployment/seo/renew-luxe-certificate`，安装为 `/etc/letsencrypt/renewal-hooks/deploy/30-luxe-certificate`，模式 0755。不要将证书私钥复制到 Git 或应用 rsync。

IndexNow：腾讯云 `luxe-indexnow.timer` 每日运行，状态目录 `/var/lib/luxe-search` 属于 luxe。`indexnow.key` 是公开所有权验证令牌，不是账号密码，但仍在运行时生成、不写入 Git。`submitted.json` 仅记公开 URL 和修改时间。失败不会推进记录，下次重试；HTTP 200/202 仅表示受理。

```text
sudo systemctl status luxe-indexnow.timer
sudo systemctl start luxe-indexnow.service
sudo journalctl -u luxe-indexnow.service -n 20 --no-pager
sudo certbot certificates
sudo certbot renew --cert-name bebeauty.top --dry-run
```

备份检查发现：现网备份脚本的保留规则为“最新一份 + 周备一份”，与旧指南的最近三份不一致。本轮没有覆盖这个外部修订；已先完成发布前完整备份。证书/密钥沿用原路径，原完整备份仍包含它们；灾难恢复时还需恢复/重建 Certbot 注册及续期钩子。

## 9. 官方资料与适用结论

1. [Google AI 搜索功能](https://developers.google.com/search/docs/appearance/ai-features)：可抓取、可索引、有用内容是基础，没有专用 GEO 神奇标签。
2. [Google 生成式搜索优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)：常规 SEO 与准确内容仍适用，不把特殊 AI 文件视为必要条件。
3. [电商网站结构](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure)：通过真实链接形成首页、分类、产品发现路径。
4. [电商 URL 设计](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites)：稳定 URL、规范地址与内部链接保持一致。
5. [筛选导航管理](https://developers.google.com/crawling/docs/faceted-navigation)：避免无限筛选组合消耗抓取资源。
6. [Product 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)：使用真实、可见的商品数据，不保证富结果。
7. [Google 图片最佳实践](https://developers.google.com/search/docs/appearance/google-images)：可访问图片、描述性替代文字、上下文与图片发现。
8. [站点地图](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)：列出希望索引的规范 URL，修改时间必须真实。
9. [Robots 与 noindex](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)：不索引和不允许抓取不同，私有内容仍须鉴权。
10. [以人为本的有用内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)：服务真实用户需求，而非为排名批量堆文。
11. [Google 搜索文档更新](https://developers.google.com/search/updates)：FAQ 富结果停用，不应承诺旧功能。
12. [IndexNow 协议](https://www.indexnow.org/documentation)：提交更改 URL，所有权验证与受理状态不等于索引保证。
13. [OpenAI 爬虫说明](https://developers.openai.com/api/docs/bots)：OAI-SearchBot 用于搜索发现，和 GPTBot 的用途/控制不同。
14. [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)：在已验证站点中观察 AI 引用，而不是猜测是否被引用。
15. [Core Web Vitals](https://web.dev/articles/vitals)：用真实用户的加载、交互、稳定性指标衡量体验。
16. [Google 仿冒商品政策](https://support.google.com/merchants/answer/6149993)：商品推广资格不能由技术优化替代。
