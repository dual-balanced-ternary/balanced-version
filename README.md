## Balanced Version

用双平衡三进制表达二维软件迭代：功能增加沿 **1** 方向，Bug 修复沿 **3** 方向，不稳定功能沿 **7** 方向引入，成熟后迁入 **1** 方向。小数位提供 1/3、1/9、1/27 的迭代尺度。

页面初始化了六条示例版本记录，提供递归九宫格轨迹、版本生成器、实验版转稳定、数字九宫格、精确解码、复制与 JSON 导出。记录保存在页面内存，刷新会恢复示例。

完整的语法、发布生命周期、兼容性与比较条款见 [0.1.0 规范草案](docs/version-spec.md)。页面提供精确的二维偏序比较及 (F,B) 列表排序。数学与软件版本语义见 [设计约定](docs/version-design.md)。源数学模型参考 [Dual Balanced Ternary](https://github.com/dual-balanced-ternary/dual_balanced_ternary.rs)。版本坐标使用两条轴的偏序比较；channel、目标、记录 ID 与兼容性属于额外元数据，DBT 数值不能独自替代它们。

### Usages

To develop:

```bash
corepack enable && corepack prepare yarn@4.12.0 --activate
yarn install --immutable
caps --strict --ci
caps verify --toolchain

calcit calcit.cirru js
yarn dev # http://127.0.0.1:5173
```

To build:

```bash
yarn compile
yarn test
yarn release
http-server dist/
```

### Workflow

https://github.com/dual-balanced-ternary/balanced-version

页面作为 Web Component 由 Respo/Calcit 入口挂载。`src/dbt.mjs` 实现精确的 BigInt 坐标与平衡三进制进位；`src/version-model.mjs` 定义迭代、实验目标和导出约定；`src/version-page.mjs` 渲染页面并处理交互。Snapshot 的修改仍通过 Calcit CLI 完成。

### COS 静态资源部署实践

本项目的 [上传工作流](.github/workflows/upload.yaml) 是 Calcit/Respo 应用的完整示例；[worktools/cos-upload-action](https://github.com/worktools/cos-upload-action) 负责把已经构建好的目录上传到腾讯云 COS，并可经公开 CDN 对每个文件做字节数与 SHA-256 校验。项目仍保留自己的 Calcit 校验、Vite 构建、CDN 路径选择和原有服务器部署。

1. 在仓库或组织配置 `COS_BUCKET`、`COS_SECRET_ID`、`COS_SECRET_KEY` 三个 Actions secret。当前存储桶地域是 `ap-shanghai`，公开读取入口是 `https://cos-sh.tiye.me/`。COS 凭据仅授予目标桶所需的上传权限；来自 fork 的 PR 不运行需要密钥的步骤。
2. 构建前按目标路径设置 Vite base：生产环境为 `https://cos-sh.tiye.me/<owner>/<repo>/`，本项目的 PR 预览为 `https://cos-sh.tiye.me/<owner>/<repo>/pr/`。`prefix` 与公开 URL 必须对应同一目录，不能只改上传前缀而沿用旧 base。
3. 用固定 commit SHA 引用上传 Action，并传入 `source-dir: dist`、`bucket`、`region`、`prefix`、`public-base-url` 与三个 secret。Action 上传后会从公开 CDN 逐文件下载并比对字节数和 SHA-256，全部通过后才执行原有 rsync；项目不再复制远端验证脚本，COS 上传或公开读取失败也不会更新服务器上的 HTML。
4. 保留生产和 PR 预览的独立路径。固定 `/pr/` 是本项目刻意提供的共享预览地址；并发 PR 可能覆盖这个地址。若只是验证上传能力、无需共享预览地址，改用 `<owner>/<repo>/pr/<pr-number>/<run-id>/` 隔离每次运行，并在 CDN 请求中加入 `?run=<run-id>` 避免缓存影响检查。长期使用运行级前缀时，应给旧对象设置存储桶生命周期清理策略。

验证顺序：先在同仓库 PR 中确认 Calcit 校验、构建、COS 上传和 CDN 读取全部成功，并检查 `dist/index.html` 的资源路径；合并后再检查 `main` 的生产前缀和原有服务器页面。不要仅凭上传命令成功就认为页面可用，也不要把 `dist/`、`js-out/` 等生成物提交到 Git。若出现 `AccessDenied`，先核对组织 secret 是否向该仓库开放、桶名是否包含 APPID、地域与前缀是否正确，再查看 COS 权限；若在上传前失败，应先修复原有构建，不能把失败归因于 COS。

迁移既有站点时可以先采用“影子上传”：保持 Vite base 和服务器部署不变，在原有 rsync **之后**额外上传到隔离的 COS 前缀，避免 COS 故障阻断现有生产部署，并通过 Action 的 `public-base-url` 校验逐文件验证。生产前缀覆盖同名文件时，CDN 可能短暂返回旧内容；Action 会对“下载加比对”整体做有限次数重试，每次使用不同的缓存参数。确认影子上传后再另行切换 Vite base 和页面部署；切换时则应先验证 CDN 资源，再更新服务器 HTML。上传 Action 的参数、校验和错误说明以其[中文文档](https://github.com/worktools/cos-upload-action#readme)为准。

已验证的两种迁移方式：[calcit-viewer 的隔离影子上传](https://github.com/calcit-lang/calcit-viewer/pull/53)保留了原页面部署，[Respo 示例](https://github.com/Respo/respo-example.calcit/pull/13)与 [cirru.org](https://github.com/Cirru/cirru.org/pull/47)也分别验证了其他组织的密钥和公开 CDN；[diary 的共享 Action 迁移](https://github.com/TopixIM/diary/pull/51)则保留已有的 CDN base、`/pr/` 预览与服务器部署，并在 PR 中通过 COS 上传和公开 CDN 检查。

### License

MIT
