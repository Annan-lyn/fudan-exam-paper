# 维护者部署说明

此 PR 提供静态文件浏览器和 GitHub Pages 工作流。使用者可按课程、老师、年份、考试类型查找文件，文件内容仍从原仓库打开。

## 首次启用

1. 合并 `web/`、`.github/workflows/web-check.yml`、`.github/workflows/web-pages.yml`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions → Deploy exam website → Run workflow** 选择 `main` 运行。
4. 任务成功后，在部署任务的 `github-pages` 环境或 Settings → Pages 打开网站地址。

上游默认项目地址为 `https://annan-lyn.github.io/fudan-exam-paper/`。这是预期地址，实际地址以 Pages 部署结果为准；当前交付没有启用远程 Pages。

不需要设置个人 Token 或新增 Secrets。若仓库限制可用 Actions，需要允许工作流中的官方 `actions/*`。若环境保护要求审批，按仓库规则审批 `github-pages` 部署。

## 更新机制

- PR：`Check exam website` 使用包内目录快照运行 JavaScript、Python 测试并构建，不部署。
- main 推送或手动运行：通过当前提交 SHA 读取 GitHub 目录元数据，重新生成索引，测试、构建，再上传 `web/dist` 并部署。
- 所有 main 推送均会触发，因此仅新增或删除试卷也会更新网站。
- sparse checkout 只检出前端和配置；索引从 GitHub API 获取元数据，不下载整个试卷库。
- 目录过大导致 GitHub 返回 `truncated` 时，构建明确失败，不会发布不完整索引。
- Fork 部署自动使用 Fork 的仓库名和提交 SHA，文件链接与对应提交一致。

`main` 是此仓库当前默认分支。如果更改默认分支，需要同时调整 `web-pages.yml` 的 `on.push.branches` 和 build job 的分支条件。

## 常见问题

- **Pages 尚未启用**：配置好 Source 后，重新运行部署工作流。构建成功不等于部署成功。
- **未出现 Actions 工作流**：确认 `.github/` 放在仓库根目录；它是隐藏目录，不在 `web/` 里。
- **双击 HTML 卡在加载中**：使用 `cd web && npm run build && npm run preview`，再访问 `http://127.0.0.1:4377`。
- **部署成功但文件打不开**：站点不代理正文，远程文件可用性取决于 GitHub、原文件和访问者网络。
- **不需要托管网站**：保留 `web/` 本地使用即可；可省略 `web-pages.yml`。

工作流遵循 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。发布权限只授予部署 job（`pages: write`、`id-token: write`），构建与 PR 检查仅有 `contents: read`。
