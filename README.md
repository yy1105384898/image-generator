# YANGYANGAPI Image Workspace

一个 Flask + Docker 的本地生图工作台，包含首页、工作台、管理后台、模型接入配置、账号号池、图片管理和日志管理。

## 快速启动

```bash
cp .env.example .env
docker compose up -d --build
```

默认服务地址：

```text
http://localhost:3012
```

默认后台账号密码：

```text
root / root
```

首次登录后建议在后台设置里修改管理员账号密码。

## 配置

主要环境变量见 `.env.example`：

- `SECRET_KEY`: Flask session 密钥，生产环境请改成随机值。
- `NEW_API_BASE`: 默认 New API 地址。
- `NEW_API_TOKEN`: 可选默认 API Token，也可以在页面里填写。
- `DEFAULT_MODEL` / `AVAILABLE_MODELS`: 默认模型和可选模型列表。

运行数据保存在 `data/`，该目录不会提交到 Git。
