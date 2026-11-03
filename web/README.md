# 旦卷 · 复旦往年试卷索引

为 [Annan-lyn/fudan-exam-paper](https://github.com/Annan-lyn/fudan-exam-paper) 编写的独立静态前端。把本目录作为 `web/` 放进仓库即可使用，不需要复制试卷正文或安装 npm 依赖。

## 本地使用

需要 Node.js 22、Python 3：

```sh
cd web
npm run build
npm test
python3 -B -m unittest discover -s tests -p "test_*.py"
npm run preview
```

打开 http://127.0.0.1:4377 。`dist/` 可以放在静态文件服务器或 GitHub Pages 的子路径下，所有站内资源均用相对地址。不能用 `file://` 直接打开，因为浏览器需要读取同站点的本地 JSON 索引。

## 已实现

- 课程简称与老师姓名 / 拼音首字母 / 文件名搜索，课程精确命中优先；ICS 不会命中 physics、ethics 等无关词。
- 课程建议可用上下方向键、Enter 和 Tab 操作；课程目录可直达文件列表。
- 学科、课程、任课老师、年份、期中 / 期末 / 阶段考、格式、答案标记组合筛选。
- 文件分页，每页最多 20 条；URL 保存条件、排序、页码，支持复制分享与浏览器前进后退。
- 本机收藏和最近打开；收藏只保存文件路径，不需要登录。清空浏览器数据会丢失，禁用存储时仅在当前页面保留。
- 来源详情保留完整路径、推测归属与 PDF 密码。原仓库的 `[猜]` 不作为已确认老师信息展示。
- 手机筛选面板、响应式文件卡片、键盘焦点、对话框 Escape 关闭、加载错误与无结果状态。

## 数据来源与更新

`data/tree.json` 是原仓库 Git tree 的完整元数据快照，仅含提交 SHA、文件路径、类型和大小，没有试卷正文。构建脚本生成 `data/catalog.json`，浏览器只读取本站的 JSON，不会调用 GitHub API。统计是文件数，图片按张计数，并不等同于独立试卷份数。

索引链接固定到该次提交版本。配套 Pages 工作流在每次 main 推送时重新抓取该提交的目录元数据，并构建与发布。因此新增或移除试卷会进入下一次部署；手动使用本地副本时，需要自行更新快照。

从完整源仓库的当前提交生成新快照（在仓库根目录运行，需要 Python 3 和 Git）：

```sh
python3 web/scripts/snapshot-local.py
cd web
npm run build
```

本地脚本只读取 Git 追踪的树，排除 `web/`、`.github/`；应在完整本地 checkout 中使用。Fork 仓库需加 `--repository 你的账号/仓库名`，保证提交链接属于正确仓库。

CI 使用 `snapshot-remote.py`，通过提交 SHA 取得 Git tree，只获取路径、类型、大小等元数据；提交 SHA 和 tree SHA 分开记录。截断响应、空索引和重复路径会被拒绝。令牌只通过 CI 环境变量传递，不写入产物。

年份、期中期末、答案等由文件名推断；没有明确证据时显示“未注明”。年份筛选保留文件名中列出的完整四位年份，类似 `23秋` 的明确短年份按 2023 处理。课程别名在 `scripts/build-data.mjs` 维护。索引全部课程文件，包括原目录中少量源码或说明文件，不擅自删除。

网站使用无依赖 HTML / CSS / JavaScript，数据来自仓库自身的科目与老师目录。

## 边界与许可

本站是非官方资料索引，不使用官方校徽、外部字体、图片或统计脚本。试卷版权及使用边界以原仓库 README、LICENSE 和原作者说明为准；仅供学习交流，禁止商用和售卖。反馈与移除入口直接链接原仓库 Issues。

“打开文件”进入 GitHub 文件页；“打开原始文件”由浏览器直接访问原仓库的 raw 地址，能否预览或下载取决于文件格式、GitHub 与本地网络。网站没有代理、缓存或解密正文。

## GitHub Pages 部署

把交付包里的 `web/` 和 `.github/workflows/web-*.yml` 一起加入仓库。详细步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

1. 合并代码后，在 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
2. 进入 Actions → Deploy exam website → Run workflow，选择 main。此后推送 main 会自动更新。
3. 成功后，网站地址显示在部署任务和 Settings → Pages 中。

PR 的 `Check exam website` 只测试、构建；发布由 main 上的独立工作流执行。无需个人访问令牌或额外 Secrets。仅将 `web/dist` 上传到 Pages，原始试卷不进入网站部署包。
