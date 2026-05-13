import base64
import hashlib
import ipaddress
import json
import mimetypes
import os
import queue
import random
import re
import struct
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests
from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

try:
    from curl_cffi import requests as browser_requests
except ImportError:  # pragma: no cover - fallback for lightweight local runs
    browser_requests = None


APP_USERNAME = os.getenv("APP_USERNAME", "root")
APP_PASSWORD = os.getenv("APP_PASSWORD", "root")
NEW_API_BASE = os.getenv("NEW_API_BASE", "http://127.0.0.1:3004").rstrip("/")
NEW_API_TOKEN = os.getenv("NEW_API_TOKEN", "")


DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-image-2")
DEFAULT_TEXT_MODEL = os.getenv("AGENT_TEXT_MODEL", "gpt-4.1-mini")
AVAILABLE_MODELS = [m.strip() for m in os.getenv("AVAILABLE_MODELS", DEFAULT_MODEL).split(",") if m.strip()]
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "200"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "600"))
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
MEDIA_DIR = DATA_DIR / "media"
REFERENCE_DIR = DATA_DIR / "references"
JOBS_FILE = DATA_DIR / "jobs.json"
MEDIA_FILE = DATA_DIR / "media.json"
SUBJECTS_FILE = DATA_DIR / "subjects.json"
PRESETS_FILE = DATA_DIR / "presets.json"
REFERENCES_FILE = DATA_DIR / "references.json"
MODEL_CONFIG_FILE = DATA_DIR / "model_config.json"
ACCOUNT_POOL_FILE = DATA_DIR / "account_pool.json"
POOL_USERS_FILE = DATA_DIR / "pool_users.json"
INTEGRATION_CONFIG_FILE = DATA_DIR / "integration_config.json"
ADMIN_LOGS_FILE = DATA_DIR / "admin_logs.json"
ADMIN_AUTH_FILE = DATA_DIR / "admin_auth.json"

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret")

state_lock = threading.RLock()
job_queue: "queue.Queue[str]" = queue.Queue()
worker_started = False


def now_ts() -> int:
    return int(time.time())


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default):
    ensure_data_dir()
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, value) -> None:
    ensure_data_dir()
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def default_model_config() -> dict:
    model_ids = AVAILABLE_MODELS or [DEFAULT_MODEL]
    return {
        "default_connection_mode": "custom",
        "auto_order": [],
        "connections": {
            "custom": {
                "label": "自定义 API",
                "badge": "云端",
                "url": "",
                "description": "使用云端服务器的 OpenAI 兼容 API，需要填写 API URL 和 API Key。",
                "enabled": True,
            },
            "pool": {
                "label": "本地号池",
                "badge": "OAuth",
                "url": "",
                "description": "不填写 API Key，直接使用管理员号池里已导入并可用的 OpenAI OAuth 账号生成图片。",
                "enabled": True,
            },
        },
        "model_profiles": [
            {
                "id": model,
                "title": model,
                "description": "后台可维护模型说明，用于工作台选择模型时快速判断用途。",
                "tag": "生图",
            }
            for model in model_ids
        ],
        "agent_text": {
            "default_model": DEFAULT_TEXT_MODEL,
            "reuse_custom_api": True,
            "reuse_custom_key": True,
        },
    }


def normalize_model_config(raw: dict | None = None) -> dict:
    base = default_model_config()
    raw = raw if isinstance(raw, dict) else {}
    connections = base["connections"]
    for key, value in (raw.get("connections") or {}).items():
        if key not in connections or not isinstance(value, dict):
            continue
        merged = {**connections[key], **value}
        merged["enabled"] = bool(merged.get("enabled", True))
        connections[key] = merged
    profiles = raw.get("model_profiles")
    if isinstance(profiles, list) and profiles:
        cleaned = []
        for item in profiles:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("id") or "").strip()
            if not model_id:
                continue
            cleaned.append({
                "id": model_id,
                "title": str(item.get("title") or model_id).strip(),
                "description": str(item.get("description") or "后台可维护模型说明。").strip(),
                "tag": str(item.get("tag") or "生图").strip(),
            })
        if cleaned:
            base["model_profiles"] = cleaned
    base["auto_order"] = []
    agent_text = raw.get("agent_text") if isinstance(raw.get("agent_text"), dict) else {}
    base["agent_text"] = {
        **base["agent_text"],
        "default_model": str(agent_text.get("default_model") or base["agent_text"]["default_model"]).strip(),
        "reuse_custom_api": bool(agent_text.get("reuse_custom_api", True)),
        "reuse_custom_key": bool(agent_text.get("reuse_custom_key", True)),
    }
    default_mode = str(raw.get("default_connection_mode") or base["default_connection_mode"]).strip()
    if default_mode in base["connections"]:
        base["default_connection_mode"] = default_mode
    else:
        base["default_connection_mode"] = "custom"
    return base


def read_model_config() -> dict:
    return normalize_model_config(read_json(MODEL_CONFIG_FILE, {}))


def write_model_config(config: dict) -> None:
    write_json(MODEL_CONFIG_FILE, normalize_model_config(config))


def read_admin_auth() -> dict:
    raw = read_json(ADMIN_AUTH_FILE, {})
    username = str(raw.get("username") or APP_USERNAME or "root").strip() or "root"
    password = str(raw.get("password") or APP_PASSWORD or "root").strip() or "root"
    if not ADMIN_AUTH_FILE.exists() and username == APP_USERNAME and password == APP_PASSWORD:
        username, password = "root", "root"
    return {"username": username, "password": password}


def write_admin_auth(username: str, password: str) -> None:
    username = str(username or "").strip() or "root"
    password = str(password or "").strip() or "root"
    write_json(ADMIN_AUTH_FILE, {"username": username, "password": password, "updated_at": now_ts()})


def normalize_pool_user(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    username = str(item.get("username") or "").strip()
    if not username:
        return None
    password_hash = str(item.get("password_hash") or "").strip()
    raw_password = str(item.get("password") or "").strip()
    if not password_hash and raw_password:
        password_hash = generate_password_hash(raw_password)
    return {
        "id": str(item.get("id") or uuid.uuid4().hex),
        "username": username,
        "display_name": str(item.get("display_name") or username).strip() or username,
        "password_hash": password_hash,
        "enabled": bool(item.get("enabled", True)),
        "note": str(item.get("note") or "").strip(),
        "created_at": int(item.get("created_at") or now_ts()),
        "updated_at": int(item.get("updated_at") or now_ts()),
        "last_login_at": int(item.get("last_login_at") or 0),
    }


def read_pool_users() -> list[dict]:
    items = read_json(POOL_USERS_FILE, [])
    users = [user for item in items if (user := normalize_pool_user(item))]
    return sorted(users, key=lambda item: item.get("created_at", 0))


def write_pool_users(users: list[dict]) -> None:
    unique = {}
    for item in users:
        user = normalize_pool_user(item)
        if user:
            unique[user["username"].lower()] = user
    write_json(POOL_USERS_FILE, list(unique.values()))


def public_pool_user(user: dict | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "display_name": user.get("display_name") or user.get("username"),
        "enabled": bool(user.get("enabled", True)),
        "last_login_at": int(user.get("last_login_at") or 0),
    }


def pool_user_stats(users: list[dict]) -> dict:
    return {
        "total": len(users),
        "enabled": sum(1 for item in users if item.get("enabled", True)),
        "disabled": sum(1 for item in users if not item.get("enabled", True)),
    }


def verify_pool_user_password(user: dict, password: str) -> bool:
    password = str(password or "")
    password_hash = str(user.get("password_hash") or "")
    if password_hash:
        try:
            return check_password_hash(password_hash, password)
        except ValueError:
            return False
    legacy_password = str(user.get("password") or "")
    return bool(legacy_password) and legacy_password == password


def current_pool_user() -> dict | None:
    user_id = str(session.get("pool_user_id") or "")
    if not user_id:
        return None
    for user in read_pool_users():
        if user.get("id") == user_id and user.get("enabled", True):
            return user
    session.pop("pool_user_id", None)
    return None


def require_pool_user_json():
    user = current_pool_user()
    if user:
        return user, None
    return None, (jsonify({"error": "请先登录号池账号"}), 401)


def connection_endpoints() -> dict[str, str]:
    config = read_model_config()
    return {
        key: str(value.get("url") or "").strip()
        for key, value in config["connections"].items()
        if key == "custom" and value.get("enabled", True)
    }


def available_model_ids() -> list[str]:
    ids = [str(item.get("id") or "").strip() for item in read_model_config().get("model_profiles", [])]
    ids = [item for item in ids if item]
    return ids or AVAILABLE_MODELS or [DEFAULT_MODEL]


def mask_secret(value: str, left: int = 8, right: int = 4) -> str:
    value = str(value or "").strip()
    if len(value) <= left + right:
        return value[:2] + "***" if value else ""
    return f"{value[:left]}...{value[-right:]}"


def admin_log(action: str, detail: dict | None = None) -> None:
    logs = read_json(ADMIN_LOGS_FILE, [])
    logs.append({"id": uuid.uuid4().hex, "action": action, "detail": detail or {}, "created_at": now_ts()})
    write_json(ADMIN_LOGS_FILE, logs[-300:])


def normalize_account_status(value) -> str:
    raw = str(value or "").strip()
    lowered = raw.lower()
    if lowered in {"active", "enabled", "enable", "ok", "valid", "normal", "success", "true", "1", "正常"}:
        return "正常"
    if lowered in {"disabled", "disable", "inactive", "blocked", "banned", "false", "0", "禁用", "停用"}:
        return "禁用"
    if lowered in {"limited", "rate_limited", "quota_exceeded", "quota_empty", "限流"}:
        return "限流"
    if lowered in {"error", "invalid", "expired", "unauthorized", "异常", "失效"}:
        return "异常"
    return raw or "正常"


def normalize_account(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    token = str(
        item.get("access_token")
        or item.get("accessToken")
        or item.get("token")
        or item.get("key")
        or ""
    ).strip()
    if not token:
        return None
    return {
        "id": str(item.get("id") or uuid.uuid4().hex),
        "access_token": token,
        "token_mask": mask_secret(token),
        "email": str(item.get("email") or item.get("account") or item.get("username") or "").strip(),
        "user_id": str(item.get("user_id") or "").strip(),
        "type": str(item.get("type") or item.get("account_type") or item.get("source_type") or "openai").strip(),
        "source": str(item.get("source") or "manual").strip(),
        "status": normalize_account_status(item.get("status")),
        "quota": max(0, int(item.get("quota") or item.get("available_quota") or 0)),
        "image_quota_unknown": bool(item.get("image_quota_unknown")),
        "restore_at": str(item.get("restore_at") or "").strip(),
        "default_model_slug": str(item.get("default_model_slug") or "").strip(),
        "success": max(0, int(item.get("success") or 0)),
        "fail": max(0, int(item.get("fail") or 0)),
        "last_error": str(item.get("last_error") or "").strip(),
        "last_checked_at": int(item.get("last_checked_at") or 0),
        "note": str(item.get("note") or item.get("remark") or "").strip(),
        "created_at": int(item.get("created_at") or now_ts()),
        "updated_at": now_ts(),
    }


def read_account_pool() -> list[dict]:
    items = read_json(ACCOUNT_POOL_FILE, [])
    accounts = [account for item in items if (account := normalize_account(item))]
    return sorted(accounts, key=lambda item: item.get("updated_at", 0), reverse=True)


def write_account_pool(accounts: list[dict]) -> None:
    unique = {}
    for item in accounts:
        account = normalize_account(item)
        if account:
            unique[account["access_token"]] = account
    write_json(ACCOUNT_POOL_FILE, list(unique.values()))


def account_stats(accounts: list[dict]) -> dict:
    return {
        "total": len(accounts),
        "ok": sum(1 for item in accounts if item.get("status") == "正常"),
        "limited": sum(1 for item in accounts if item.get("status") == "限流"),
        "error": sum(1 for item in accounts if item.get("status") == "异常"),
        "disabled": sum(1 for item in accounts if item.get("status") == "禁用"),
        "quota": sum(int(item.get("quota") or 0) for item in accounts),
    }


def extract_accounts_from_payload(payload, source: str = "json") -> list[dict]:
    found = []
    if isinstance(payload, list):
        for item in payload:
            found.extend(extract_accounts_from_payload(item, source))
        return found
    if not isinstance(payload, dict):
        return found
    account = normalize_account({**payload, "source": payload.get("source") or source})
    if account:
        found.append(account)
    for key in ("accounts", "items", "data", "tokens", "users"):
        value = payload.get(key)
        if isinstance(value, (list, dict)):
            found.extend(extract_accounts_from_payload(value, source))
    return found


def parse_account_import(raw: str, source: str) -> list[dict]:
    raw = str(raw or "").strip()
    if not raw:
        return []
    if raw[0] in "[{":
        payload = json.loads(raw)
        return extract_accounts_from_payload(payload, source)
    accounts = []
    for token in [line.strip() for line in raw.splitlines() if line.strip()]:
        account = normalize_account({"access_token": token, "source": source})
        if account:
            accounts.append(account)
    return accounts


def read_integration_config() -> dict:
    raw = read_json(INTEGRATION_CONFIG_FILE, {})
    sub2api_raw = raw.get("sub2api", {})
    sub2api_auth_method = str(sub2api_raw.get("auth_method") or "").strip()
    if sub2api_auth_method not in {"password", "api_key"}:
        sub2api_auth_method = "api_key" if str(sub2api_raw.get("api_key") or "").strip() else "password"
    return {
        "sub2api": {
            "name": str(sub2api_raw.get("name") or "本地 sub2api").strip(),
            "base_url": str(sub2api_raw.get("base_url") or "").strip(),
            "auth_method": sub2api_auth_method,
            "username": str(sub2api_raw.get("username") or "").strip(),
            "password": str(sub2api_raw.get("password") or "").strip(),
            "api_key": str(sub2api_raw.get("api_key") or "").strip(),
            "group_id": str(sub2api_raw.get("group_id") or "").strip(),
        },
        "cpa": {
            "name": str(raw.get("cpa", {}).get("name") or "CPA 账号池").strip(),
            "base_url": str(raw.get("cpa", {}).get("base_url") or "").strip(),
            "secret_key": str(raw.get("cpa", {}).get("secret_key") or "").strip(),
        },
    }


def write_integration_config(config: dict) -> None:
    write_json(INTEGRATION_CONFIG_FILE, read_integration_config() | config)


def unwrap_remote_payload(payload):
    if isinstance(payload, dict) and "data" in payload and ("code" in payload or "message" in payload):
        return payload.get("data")
    return payload


def paged_items(payload) -> tuple[list, int]:
    body = unwrap_remote_payload(payload)
    if isinstance(body, list):
        return body, len(body)
    if isinstance(body, dict):
        for key in ("items", "data", "list", "accounts", "files"):
            value = body.get(key)
            if isinstance(value, list):
                return value, int(body.get("total") or len(value))
    return [], 0


def url_with_host(base_url: str, host: str) -> str:
    parts = urlsplit(base_url)
    if not parts.scheme or not parts.hostname:
        return base_url
    netloc = host
    if parts.port:
        netloc = f"{netloc}:{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path.rstrip("/"), "", ""))


def integration_base_candidates(base_url: str) -> list[str]:
    base = str(base_url or "").strip().rstrip("/")
    if not base:
        return []
    candidates = [base]
    parts = urlsplit(base)
    host = parts.hostname or ""
    fallback_env = os.getenv("SUB2API_BASE_URL_FALLBACKS", "")
    candidates.extend([item.strip().rstrip("/") for item in fallback_env.split(",") if item.strip()])
    try:
        host_is_private = bool(ipaddress.ip_address(host).is_private)
    except ValueError:
        host_is_private = False
    if host in {"127.0.0.1", "localhost"} or host_is_private:
        candidates.append(url_with_host(base, "host.docker.internal"))
        candidates.append(url_with_host(base, "172.17.0.1"))
    unique = []
    for item in candidates:
        if item and item not in unique:
            unique.append(item)
    return unique


def sub2api_headers_for_base(conf: dict, base_url: str) -> dict[str, str]:
    auth_method = str(conf.get("auth_method") or "password").strip()
    api_key = str(conf.get("api_key") or "").strip()
    if auth_method == "api_key":
        if not api_key:
            raise RuntimeError("请先填写 Sub2API Admin API Key")
        return {"x-api-key": api_key, "Accept": "application/json"}
    email = str(conf.get("username") or "").strip()
    password = str(conf.get("password") or "").strip()
    if not base_url or not email or not password:
        raise RuntimeError("请先填写 Sub2API 地址、管理员邮箱和管理员密码")
    resp = requests.post(
        f"{base_url}/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f"Sub2API 登录失败：HTTP {resp.status_code} {resp.text[:160]}")
    body = unwrap_remote_payload(resp.json())
    token = str((body or {}).get("access_token") or "").strip() if isinstance(body, dict) else ""
    if not token:
        raise RuntimeError("Sub2API 登录成功但没有返回 access_token")
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def sub2api_request(conf: dict, method: str, path: str, **kwargs) -> tuple[requests.Response, str]:
    errors = []
    extra_headers = kwargs.pop("headers", {}) or {}
    for base_url in integration_base_candidates(conf.get("base_url")):
        try:
            headers = sub2api_headers_for_base(conf, base_url)
            headers.update(extra_headers)
            resp = requests.request(method, f"{base_url}{path}", headers=headers, timeout=30, **kwargs)
            if resp.ok:
                return resp, base_url
            errors.append(f"{base_url}: HTTP {resp.status_code} {resp.text[:160]}")
        except requests.RequestException as exc:
            errors.append(f"{base_url}: 网络不可达 {exc}")
        except Exception as exc:
            errors.append(f"{base_url}: {exc}")
    hint = "；".join(errors) if errors else "未配置可用地址"
    raise RuntimeError(
        "Sub2API 连接失败。Docker 部署在 NAS 上访问宿主机服务时，建议服务地址填 "
        "http://host.docker.internal:8091，或把两个容器加入同一个 Docker 网络。"
        f" 尝试结果：{hint}"
    )


def extract_access_token_from_remote(item: dict) -> str:
    if not isinstance(item, dict):
        return ""
    credentials = item.get("credentials") if isinstance(item.get("credentials"), dict) else {}
    for source in (credentials, item):
        for key in ("access_token", "accessToken", "token", "key"):
            value = str(source.get(key) or "").strip()
            if value:
                return value
    return ""


def list_sub2api_remote_accounts(conf: dict) -> list[dict]:
    if not str(conf.get("base_url") or "").strip():
        raise RuntimeError("请先填写 Sub2API 地址")
    group_id = str(conf.get("group_id") or "").strip()
    accounts = []
    page = 1
    while True:
        params = {"platform": "openai", "type": "oauth", "page": page, "page_size": 200}
        if group_id:
            params["group"] = group_id
        resp, _ = sub2api_request(conf, "GET", "/api/v1/admin/accounts", params=params)
        items, total = paged_items(resp.json())
        if not items:
            break
        for item in items:
            if not isinstance(item, dict):
                continue
            credentials = item.get("credentials") if isinstance(item.get("credentials"), dict) else {}
            account_id = str(item.get("id") or credentials.get("chatgpt_account_id") or "").strip()
            if not account_id:
                continue
            accounts.append({
                "id": account_id,
                "name": str(item.get("name") or "").strip(),
                "email": str(credentials.get("email") or item.get("email") or item.get("name") or "").strip(),
                "plan_type": str(credentials.get("plan_type") or item.get("type") or "").strip(),
                "status": normalize_account_status(item.get("status")),
                "expires_at": str(credentials.get("expires_at") or "").strip(),
                "has_refresh_token": bool(str(credentials.get("refresh_token") or "").strip()),
            })
        if page * 200 >= total or len(items) < 200:
            break
        page += 1
    return accounts


def fetch_sub2api_account_token(conf: dict, account_id: str) -> dict:
    resp, base_url = sub2api_request(conf, "GET", f"/api/v1/admin/accounts/{account_id}")
    detail_body = unwrap_remote_payload(resp.json())
    detail = detail_body if isinstance(detail_body, dict) else {}
    token = extract_access_token_from_remote(detail)
    if not token:
        raise RuntimeError(f"{account_id}: missing access_token")
    credentials = detail.get("credentials") if isinstance(detail.get("credentials"), dict) else {}
    account = normalize_account({
        "access_token": token,
        "email": credentials.get("email") or detail.get("email") or detail.get("name"),
        "type": credentials.get("plan_type") or detail.get("type") or "openai-oauth",
        "status": normalize_account_status(detail.get("status")),
        "source": "sub2api",
        "note": f"Sub2API: {conf.get('name') or base_url}",
    })
    if not account:
        raise RuntimeError(f"{account_id}: normalize failed")
    return account


def import_sub2api_accounts(conf: dict, account_ids: list[str]) -> tuple[list[dict], list[dict]]:
    ids = list(dict.fromkeys(str(item or "").strip() for item in account_ids if str(item or "").strip()))
    imported = []
    errors = []
    for account_id in ids:
        try:
            imported.append(fetch_sub2api_account_token(conf, account_id))
        except Exception as exc:
            errors.append({"name": account_id, "error": str(exc)})
    return imported, errors


def sync_sub2api_accounts(conf: dict) -> list[dict]:
    remote_accounts = list_sub2api_remote_accounts(conf)
    imported, errors = import_sub2api_accounts(conf, [item["id"] for item in remote_accounts])
    if errors and not imported:
        raise RuntimeError(f"Sub2API 同步失败：{errors[0]['error']}")
    return imported


def list_cpa_remote_files(conf: dict) -> list[dict]:
    base_url = str(conf.get("base_url") or "").strip().rstrip("/")
    secret_key = str(conf.get("secret_key") or "").strip()
    if not base_url or not secret_key:
        raise RuntimeError("请先填写 CPA 地址和 Secret Key")
    headers = {"Authorization": f"Bearer {secret_key}", "Accept": "application/json"}
    resp = requests.get(f"{base_url}/v0/management/auth-files", headers=headers, timeout=30)
    if not resp.ok:
        raise RuntimeError(f"读取 CPA 文件失败：HTTP {resp.status_code} {resp.text[:160]}")
    files, _ = paged_items(resp.json())
    result = []
    for item in files:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        result.append({
            "name": name,
            "email": str(item.get("email") or item.get("account") or "").strip(),
        })
    return result


def import_cpa_files(conf: dict, file_names: list[str]) -> tuple[list[dict], list[dict]]:
    base_url = str(conf.get("base_url") or "").strip().rstrip("/")
    secret_key = str(conf.get("secret_key") or "").strip()
    if not base_url or not secret_key:
        raise RuntimeError("请先填写 CPA 地址和 Secret Key")
    headers = {"Authorization": f"Bearer {secret_key}", "Accept": "application/json"}
    synced = []
    errors = []
    for name in list(dict.fromkeys(str(item or "").strip() for item in file_names if str(item or "").strip())):
        detail_resp = requests.get(
            f"{base_url}/v0/management/auth-files/download",
            headers=headers,
            params={"name": name},
            timeout=30,
        )
        if not detail_resp.ok:
            errors.append({"name": name, "error": f"HTTP {detail_resp.status_code}"})
            continue
        try:
            payload = detail_resp.json()
            token = extract_access_token_from_remote(payload)
            if not token:
                raise RuntimeError("missing access_token")
            account = normalize_account({
                "access_token": token,
                "email": payload.get("email") or payload.get("account"),
                "type": payload.get("plan_type") or "openai-oauth",
                "source": "cpa",
                "status": "正常",
                "note": f"CPA: {name}",
            })
            if account:
                synced.append(account)
        except Exception as exc:
            errors.append({"name": name, "error": str(exc)})
    return synced, errors


def sync_cpa_accounts(conf: dict) -> list[dict]:
    files = list_cpa_remote_files(conf)
    synced, errors = import_cpa_files(conf, [item["name"] for item in files])
    if errors and not synced:
        raise RuntimeError(f"CPA 同步失败：{errors[0]['error']}")
    return synced


def openai_backend_headers(access_token: str, path: str, extra: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
        ),
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Origin": "https://chatgpt.com",
        "Referer": "https://chatgpt.com/",
        "OAI-Language": "zh-CN",
        "X-OpenAI-Target-Path": path,
        "X-OpenAI-Target-Route": path,
    }
    if extra:
        headers.update(extra)
    return headers


def extract_image_quota(limits_progress) -> tuple[int, str, bool]:
    if isinstance(limits_progress, list):
        for item in limits_progress:
            if isinstance(item, dict) and item.get("feature_name") == "image_gen":
                return max(0, int(item.get("remaining") or 0)), str(item.get("reset_after") or "").strip(), False
    return 0, "", True


def fetch_openai_account_info(access_token: str) -> dict:
    base_url = "https://chatgpt.com"
    if browser_requests:
        session_client = browser_requests.Session(impersonate="edge101", verify=True)
    else:
        session_client = requests.Session()
    me_path = "/backend-api/me"
    me_resp = session_client.get(
        base_url + me_path,
        headers=openai_backend_headers(access_token, me_path),
        timeout=30,
    )
    if me_resp.status_code == 401:
        raise RuntimeError("access_token 已失效或未授权")
    if not me_resp.ok:
        raise RuntimeError(f"读取账号信息失败: HTTP {me_resp.status_code}")
    me_payload = me_resp.json()

    init_path = "/backend-api/conversation/init"
    init_resp = session_client.post(
        base_url + init_path,
        headers=openai_backend_headers(access_token, init_path, {"Content-Type": "application/json"}),
        json={
            "gizmo_id": None,
            "requested_default_model": None,
            "conversation_id": None,
            "timezone_offset_min": -480,
        },
        timeout=30,
    )
    if init_resp.status_code == 401:
        raise RuntimeError("access_token 已失效或未授权")
    if not init_resp.ok:
        raise RuntimeError(f"读取额度失败: HTTP {init_resp.status_code}")
    init_payload = init_resp.json()

    account_path = "/backend-api/accounts/check/v4-2023-04-27"
    account_resp = session_client.get(
        base_url + account_path + "?timezone_offset_min=-480",
        headers=openai_backend_headers(access_token, account_path),
        timeout=30,
    )
    plan_type = "free"
    if account_resp.ok:
        account_payload = account_resp.json()
        account = ((account_payload.get("accounts") or {}).get("default") or {}).get("account") or {}
        plan_type = str(account.get("plan_type") or "free")

    quota, restore_at, unknown = extract_image_quota(init_payload.get("limits_progress"))
    return {
        "email": me_payload.get("email") or "",
        "user_id": me_payload.get("id") or "",
        "type": plan_type,
        "quota": quota,
        "image_quota_unknown": unknown,
        "restore_at": restore_at,
        "default_model_slug": init_payload.get("default_model_slug") or "",
        "status": "正常" if unknown and plan_type.lower() != "free" else ("限流" if quota == 0 else "正常"),
        "last_error": "",
        "last_checked_at": now_ts(),
    }


def refresh_account_pool(target_tokens: list[str] | None = None) -> dict:
    accounts = read_account_pool()
    target_set = {str(token or "").strip() for token in (target_tokens or []) if str(token or "").strip()}
    candidates = [item for item in accounts if not target_set or item.get("access_token") in target_set]
    if not candidates:
        return {"refreshed": 0, "errors": [], "items": accounts}

    updates = {}
    errors = []
    max_workers = min(6, len(candidates))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(fetch_openai_account_info, item["access_token"]): item["access_token"]
            for item in candidates
            if item.get("access_token")
        }
        for future in as_completed(futures):
            token = futures[future]
            try:
                updates[token] = future.result()
            except Exception as exc:
                updates[token] = {
                    "status": "异常",
                    "quota": 0,
                    "fail": 1,
                    "last_error": str(exc),
                    "last_checked_at": now_ts(),
                }
                errors.append({"token": mask_secret(token), "error": str(exc)})

    refreshed = 0
    next_accounts = []
    for item in accounts:
        token = item.get("access_token")
        if token in updates:
            patch = updates[token]
            if patch.get("fail"):
                item["fail"] = int(item.get("fail") or 0) + int(patch.pop("fail") or 0)
            else:
                item["success"] = int(item.get("success") or 0) + 1
                refreshed += 1
            item.update(patch)
            item["updated_at"] = now_ts()
        next_accounts.append(item)
    write_account_pool(next_accounts)
    return {"refreshed": refreshed, "errors": errors, "items": read_account_pool()}


def is_pool_account_available(account: dict) -> bool:
    status = str(account.get("status") or "正常").strip()
    if status in {"禁用", "限流", "异常"}:
        return False
    if bool(account.get("image_quota_unknown")):
        return True
    return int(account.get("quota") or 0) > 0


def pool_available_accounts() -> list[dict]:
    return [item for item in read_account_pool() if is_pool_account_available(item)]


def pick_pool_account() -> dict:
    accounts = pool_available_accounts()
    if not accounts:
        raise RuntimeError("本地号池没有可用账号，请先在管理员里导入账号、刷新额度或启用账号")
    accounts.sort(key=lambda item: (int(item.get("fail") or 0), -int(item.get("success") or 0), int(item.get("updated_at") or 0)))
    return accounts[0]


def mark_pool_account_result(access_token: str, success: bool, error: str = "") -> None:
    token = str(access_token or "").strip()
    if not token:
        return
    with state_lock:
        accounts = read_account_pool()
        next_accounts = []
        for item in accounts:
            if item.get("access_token") != token:
                next_accounts.append(item)
                continue
            if success:
                item["success"] = int(item.get("success") or 0) + 1
                item["last_error"] = ""
                if not item.get("image_quota_unknown"):
                    item["quota"] = max(0, int(item.get("quota") or 0) - 1)
                    if item["quota"] == 0:
                        item["status"] = "限流"
                    else:
                        item["status"] = "正常"
                else:
                    item["status"] = "正常"
            else:
                item["fail"] = int(item.get("fail") or 0) + 1
                item["last_error"] = str(error or "生成失败")[:500]
                lowered = item["last_error"].lower()
                if "401" in lowered or "invalid access token" in lowered or "access_token" in lowered:
                    item["status"] = "异常"
            item["updated_at"] = now_ts()
            next_accounts.append(item)
        write_account_pool(next_accounts)


class PowScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.script_sources: list[str] = []
        self.data_build = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        attrs_dict = dict(attrs)
        src = attrs_dict.get("src")
        if not src:
            return
        self.script_sources.append(src)
        match = re.search(r"c/[^/]*/_", src)
        if match:
            self.data_build = match.group(0)


def parse_pow_resources(html: str) -> tuple[list[str], str]:
    parser = PowScriptParser()
    parser.feed(html or "")
    data_build = parser.data_build
    if not data_build:
        match = re.search(r'<html[^>]*data-build="([^"]*)"', html or "")
        if match:
            data_build = match.group(1)
    return parser.script_sources or ["https://chatgpt.com/backend-api/sentinel/sdk.js"], data_build


def build_pow_config(user_agent: str, script_sources: list[str], data_build: str) -> list:
    script_source = random.choice(script_sources or ["https://chatgpt.com/backend-api/sentinel/sdk.js"])
    return [
        random.choice([3000, 4000, 5000]),
        time.strftime("%a %b %d %Y %H:%M:%S GMT-0500 (Eastern Standard Time)", time.gmtime(time.time() - 5 * 3600)),
        4294705152,
        0,
        user_agent,
        script_source,
        data_build,
        "en-US",
        "en-US,en",
        0,
        random.choice(["webdriver∭false", "language∭zh-CN", "hardwareConcurrency∭12"]),
        "location",
        random.choice(["window", "document", "navigator", "performance"]),
        time.perf_counter() * 1000,
        str(uuid.uuid4()),
        "",
        random.choice([8, 16, 24, 32]),
        time.time() * 1000 - (time.perf_counter() * 1000),
    ]


def pow_generate(seed: str, difficulty: str, config: list, limit: int = 500000) -> tuple[str, bool]:
    target = bytes.fromhex(difficulty)
    diff_len = len(difficulty) // 2
    seed_bytes = seed.encode()
    static_1 = (json.dumps(config[:3], separators=(",", ":"), ensure_ascii=False)[:-1] + ",").encode()
    static_2 = ("," + json.dumps(config[4:9], separators=(",", ":"), ensure_ascii=False)[1:-1] + ",").encode()
    static_3 = ("," + json.dumps(config[10:], separators=(",", ":"), ensure_ascii=False)[1:]).encode()
    for i in range(limit):
        final_json = static_1 + str(i).encode() + static_2 + str(i >> 1).encode() + static_3
        encoded = base64.b64encode(final_json)
        digest = hashlib.sha3_512(seed_bytes + encoded).digest()
        if digest[:diff_len] <= target:
            return encoded.decode(), True
    fallback = "wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D" + base64.b64encode(f'"{seed}"'.encode()).decode()
    return fallback, False


def build_legacy_requirements_token(user_agent: str, script_sources: list[str], data_build: str) -> str:
    seed = format(random.random())
    answer, _ = pow_generate(seed, "0fffff", build_pow_config(user_agent, script_sources, data_build))
    return "gAAAAAC" + answer


def build_proof_token(seed: str, difficulty: str, user_agent: str, script_sources: list[str], data_build: str) -> str:
    answer, solved = pow_generate(seed, difficulty, build_pow_config(user_agent, script_sources, data_build))
    if not solved:
        raise RuntimeError(f"failed to solve proof token: difficulty={difficulty}")
    return "gAAAAAB" + answer


def response_ok(resp) -> bool:
    return 200 <= int(getattr(resp, "status_code", 0) or 0) < 300


def ensure_response_ok(resp, context: str) -> None:
    if response_ok(resp):
        return
    body = getattr(resp, "text", "")
    try:
        body = resp.json()
    except Exception:
        pass
    raise RuntimeError(f"{context} failed: HTTP {resp.status_code} {str(body)[:500]}")


def iter_sse_payloads(resp):
    for raw_line in resp.iter_lines():
        if not raw_line:
            continue
        line = raw_line.decode("utf-8", errors="ignore") if isinstance(raw_line, bytes) else str(raw_line)
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload:
            yield payload


def unique_extend(values: list[str], candidates: list[str]) -> None:
    for item in candidates:
        if item and item not in values:
            values.append(item)


def extract_pool_image_ids(text: str) -> tuple[list[str], list[str]]:
    file_ids = re.findall(r"(file[-_][A-Za-z0-9_-]+)", text or "")
    sediment_ids = re.findall(r"sediment://([A-Za-z0-9_-]+)", text or "")
    return file_ids, sediment_ids


def build_pool_image_prompt(prompt: str, ratio: str) -> str:
    ratio = str(ratio or "").strip()
    hints = {
        "1:1": "输出 1:1 正方形构图。",
        "16:9": "输出 16:9 横屏构图。",
        "9:16": "输出 9:16 竖屏构图。",
        "4:3": "输出 4:3 横向构图。",
        "3:4": "输出 3:4 纵向构图。",
        "4:5": "输出 4:5 竖向构图。",
        "5:4": "输出 5:4 横向构图。",
        "2:3": "输出 2:3 竖向构图。",
        "3:2": "输出 3:2 横向构图。",
    }
    hint = hints.get(ratio)
    return f"{prompt.strip()}\n\n{hint}" if hint else prompt.strip()


class ChatGptImageClient:
    def __init__(self, access_token: str) -> None:
        self.base_url = "https://chatgpt.com"
        self.access_token = access_token
        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
        )
        self.device_id = str(uuid.uuid4())
        self.session_id = str(uuid.uuid4())
        self.pow_script_sources: list[str] = []
        self.pow_data_build = ""
        self.session = browser_requests.Session(impersonate="edge101", verify=True) if browser_requests else requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "User-Agent": self.user_agent,
            "Origin": self.base_url,
            "Referer": self.base_url + "/",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "OAI-Device-Id": self.device_id,
            "OAI-Session-Id": self.session_id,
            "OAI-Language": "zh-CN",
            "Sec-Ch-Ua": '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        })

    def headers(self, path: str, extra: dict | None = None) -> dict:
        headers = dict(self.session.headers)
        headers["X-OpenAI-Target-Path"] = path
        headers["X-OpenAI-Target-Route"] = path
        if extra:
            headers.update(extra)
        return headers

    def bootstrap(self) -> None:
        resp = self.session.get(
            self.base_url + "/",
            headers={
                "User-Agent": self.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            timeout=30,
        )
        ensure_response_ok(resp, "chatgpt bootstrap")
        self.pow_script_sources, self.pow_data_build = parse_pow_resources(resp.text)

    def chat_requirements(self) -> dict:
        path = "/backend-api/sentinel/chat-requirements"
        body = {"p": build_legacy_requirements_token(self.user_agent, self.pow_script_sources, self.pow_data_build)}
        resp = self.session.post(
            self.base_url + path,
            headers=self.headers(path, {"Content-Type": "application/json", "Accept": "application/json"}),
            json=body,
            timeout=30,
        )
        ensure_response_ok(resp, "chat requirements")
        data = resp.json()
        proof_token = ""
        proof = data.get("proofofwork") or {}
        if proof.get("required"):
            proof_token = build_proof_token(
                str(proof.get("seed") or ""),
                str(proof.get("difficulty") or ""),
                self.user_agent,
                self.pow_script_sources,
                self.pow_data_build,
            )
        if (data.get("arkose") or {}).get("required") or (data.get("turnstile") or {}).get("required"):
            raise RuntimeError("ChatGPT 要求额外人机验证，当前号池账号暂时不能直连生成")
        token = str(data.get("token") or "")
        if not token:
            raise RuntimeError("ChatGPT 没有返回 chat requirements token")
        return {"token": token, "proof_token": proof_token}

    @staticmethod
    def image_model_slug(model: str) -> str:
        model = str(model or "").strip()
        if model == "gpt-image-2":
            return "gpt-5-3"
        if model == "codex-gpt-image-2":
            return model
        return "auto"

    def image_headers(self, path: str, requirements: dict, conduit_token: str = "", accept: str = "*/*") -> dict:
        extra = {
            "Content-Type": "application/json",
            "Accept": accept,
            "OpenAI-Sentinel-Chat-Requirements-Token": requirements["token"],
        }
        if requirements.get("proof_token"):
            extra["OpenAI-Sentinel-Proof-Token"] = requirements["proof_token"]
        if conduit_token:
            extra["X-Conduit-Token"] = conduit_token
        if accept == "text/event-stream":
            extra["X-Oai-Turn-Trace-Id"] = str(uuid.uuid4())
        return self.headers(path, extra)

    def prepare_image_conversation(self, prompt: str, requirements: dict, model: str) -> str:
        path = "/backend-api/f/conversation/prepare"
        payload = {
            "action": "next",
            "fork_from_shared_post": False,
            "parent_message_id": str(uuid.uuid4()),
            "model": self.image_model_slug(model),
            "client_prepare_state": "success",
            "timezone_offset_min": -480,
            "timezone": "Asia/Shanghai",
            "conversation_mode": {"kind": "primary_assistant"},
            "system_hints": ["picture_v2"],
            "partial_query": {
                "id": str(uuid.uuid4()),
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": [prompt]},
            },
            "supports_buffering": True,
            "supported_encodings": ["v1"],
            "client_contextual_info": {"app_name": "chatgpt.com"},
        }
        resp = self.session.post(self.base_url + path, headers=self.image_headers(path, requirements), json=payload, timeout=60)
        ensure_response_ok(resp, "image prepare")
        return str(resp.json().get("conduit_token") or "")

    def upload_reference(self, path: Path, mime: str) -> dict:
        data = path.read_bytes()
        width, height = image_dimensions(path)
        width, height = width or 1024, height or 1024
        api_path = "/backend-api/files"
        resp = self.session.post(
            self.base_url + api_path,
            headers=self.headers(api_path, {"Content-Type": "application/json", "Accept": "application/json"}),
            json={"file_name": path.name, "file_size": len(data), "use_case": "multimodal", "width": width, "height": height},
            timeout=60,
        )
        ensure_response_ok(resp, "reference create")
        meta = resp.json()
        upload_url = meta.get("upload_url")
        file_id = meta.get("file_id")
        if not upload_url or not file_id:
            raise RuntimeError("参考图上传地址缺失")
        put_resp = self.session.put(
            upload_url,
            headers={
                "Content-Type": mime or "image/png",
                "x-ms-blob-type": "BlockBlob",
                "x-ms-version": "2020-04-08",
                "Origin": self.base_url,
                "Referer": self.base_url + "/",
                "User-Agent": self.user_agent,
            },
            data=data,
            timeout=120,
        )
        ensure_response_ok(put_resp, "reference upload")
        done_path = f"/backend-api/files/{file_id}/uploaded"
        done_resp = self.session.post(
            self.base_url + done_path,
            headers=self.headers(done_path, {"Content-Type": "application/json", "Accept": "application/json"}),
            data="{}",
            timeout=60,
        )
        ensure_response_ok(done_resp, "reference uploaded")
        return {
            "file_id": file_id,
            "file_name": path.name,
            "file_size": len(data),
            "mime_type": mime or "image/png",
            "width": width,
            "height": height,
        }

    def start_image_generation(self, prompt: str, requirements: dict, conduit_token: str, model: str, references: list[dict]):
        parts = [{
            "content_type": "image_asset_pointer",
            "asset_pointer": f"file-service://{item['file_id']}",
            "width": item["width"],
            "height": item["height"],
            "size_bytes": item["file_size"],
        } for item in references]
        parts.append(prompt)
        content = {"content_type": "multimodal_text", "parts": parts} if references else {"content_type": "text", "parts": [prompt]}
        metadata = {
            "developer_mode_connector_ids": [],
            "selected_github_repos": [],
            "selected_all_github_repos": False,
            "system_hints": ["picture_v2"],
            "serialization_metadata": {"custom_symbol_offsets": []},
        }
        if references:
            metadata["attachments"] = [{
                "id": item["file_id"],
                "mimeType": item["mime_type"],
                "name": item["file_name"],
                "size": item["file_size"],
                "width": item["width"],
                "height": item["height"],
            } for item in references]
        payload = {
            "action": "next",
            "messages": [{
                "id": str(uuid.uuid4()),
                "author": {"role": "user"},
                "create_time": time.time(),
                "content": content,
                "metadata": metadata,
            }],
            "parent_message_id": str(uuid.uuid4()),
            "model": self.image_model_slug(model),
            "client_prepare_state": "sent",
            "timezone_offset_min": -480,
            "timezone": "Asia/Shanghai",
            "conversation_mode": {"kind": "primary_assistant"},
            "enable_message_followups": True,
            "system_hints": ["picture_v2"],
            "supports_buffering": True,
            "supported_encodings": ["v1"],
            "client_contextual_info": {
                "is_dark_mode": False,
                "time_since_loaded": 1200,
                "page_height": 1072,
                "page_width": 1724,
                "pixel_ratio": 1.2,
                "screen_height": 1440,
                "screen_width": 2560,
                "app_name": "chatgpt.com",
            },
            "paragen_cot_summary_display_override": "allow",
            "force_parallel_switch": "auto",
        }
        path = "/backend-api/f/conversation"
        resp = self.session.post(
            self.base_url + path,
            headers=self.image_headers(path, requirements, conduit_token, "text/event-stream"),
            json=payload,
            timeout=300,
            stream=True,
        )
        ensure_response_ok(resp, "image conversation")
        return resp

    def get_conversation(self, conversation_id: str) -> dict:
        path = f"/backend-api/conversation/{conversation_id}"
        resp = self.session.get(self.base_url + path, headers=self.headers(path, {"Accept": "application/json"}), timeout=60)
        ensure_response_ok(resp, "conversation detail")
        return resp.json()

    @staticmethod
    def extract_image_records(conversation: dict) -> tuple[list[str], list[str]]:
        file_ids: list[str] = []
        sediment_ids: list[str] = []
        for node in (conversation.get("mapping") or {}).values():
            message = (node or {}).get("message") or {}
            author = message.get("author") or {}
            metadata = message.get("metadata") or {}
            if author.get("role") != "tool" or metadata.get("async_task_type") != "image_gen":
                continue
            content = message.get("content") or {}
            for part in content.get("parts") or []:
                text = json.dumps(part, ensure_ascii=False) if isinstance(part, dict) else str(part or "")
                file_hits, sediment_hits = extract_pool_image_ids(text)
                unique_extend(file_ids, file_hits)
                unique_extend(sediment_ids, sediment_hits)
        return file_ids, sediment_ids

    def poll_image_ids(self, conversation_id: str, timeout_secs: int = 120) -> tuple[list[str], list[str]]:
        start = time.time()
        while time.time() - start < timeout_secs:
            file_ids, sediment_ids = self.extract_image_records(self.get_conversation(conversation_id))
            if file_ids or sediment_ids:
                return file_ids, sediment_ids
            time.sleep(4)
        return [], []

    def download_url_for_file(self, file_id: str) -> str:
        path = f"/backend-api/files/{file_id}/download"
        resp = self.session.get(self.base_url + path, headers=self.headers(path, {"Accept": "application/json"}), timeout=60)
        ensure_response_ok(resp, "file download url")
        body = resp.json()
        return str(body.get("download_url") or body.get("url") or "")

    def download_url_for_attachment(self, conversation_id: str, attachment_id: str) -> str:
        path = f"/backend-api/conversation/{conversation_id}/attachment/{attachment_id}/download"
        resp = self.session.get(self.base_url + path, headers=self.headers(path, {"Accept": "application/json"}), timeout=60)
        ensure_response_ok(resp, "attachment download url")
        body = resp.json()
        return str(body.get("download_url") or body.get("url") or "")

    def resolve_image_urls(self, conversation_id: str, file_ids: list[str], sediment_ids: list[str]) -> list[str]:
        urls: list[str] = []
        for file_id in [item for item in file_ids if item != "file_upload"]:
            try:
                url = self.download_url_for_file(file_id)
            except Exception:
                url = ""
            if url:
                urls.append(url)
        if urls:
            return urls
        for sediment_id in sediment_ids:
            try:
                url = self.download_url_for_attachment(conversation_id, sediment_id)
            except Exception:
                url = ""
            if url:
                urls.append(url)
        return urls

    def download_images(self, urls: list[str]) -> list[bytes]:
        images = []
        for url in urls:
            resp = self.session.get(url, timeout=120)
            ensure_response_ok(resp, "image download")
            images.append(resp.content)
        return images

    def generate(self, prompt: str, model: str, ratio: str, references: list[dict]) -> list[dict]:
        final_prompt = build_pool_image_prompt(prompt, ratio)
        uploaded = []
        for ref in references[:4]:
            filename = str(ref.get("url") or "").split("/references/", 1)[-1]
            path = REFERENCE_DIR / filename
            if path.exists():
                uploaded.append(self.upload_reference(path, ref.get("mime") or "image/png"))
        self.bootstrap()
        requirements = self.chat_requirements()
        conduit_token = self.prepare_image_conversation(final_prompt, requirements, model)
        resp = self.start_image_generation(final_prompt, requirements, conduit_token, model, uploaded)
        conversation_id = ""
        file_ids: list[str] = []
        sediment_ids: list[str] = []
        message = ""
        blocked = False
        tool_invoked = None
        try:
            for payload in iter_sse_payloads(resp):
                if payload == "[DONE]":
                    break
                unique_extend(file_ids, extract_pool_image_ids(payload)[0])
                unique_extend(sediment_ids, extract_pool_image_ids(payload)[1])
                try:
                    event = json.loads(payload)
                except Exception:
                    continue
                if not isinstance(event, dict):
                    continue
                conversation_id = str(event.get("conversation_id") or conversation_id)
                value = event.get("v")
                if isinstance(value, dict):
                    conversation_id = str(value.get("conversation_id") or conversation_id)
                    raw_message = value.get("message")
                else:
                    raw_message = event.get("message")
                if isinstance(raw_message, dict):
                    content = raw_message.get("content") or {}
                    parts = content.get("parts") or []
                    text_parts = [str(part) for part in parts if isinstance(part, str)]
                    if text_parts and (raw_message.get("author") or {}).get("role") == "assistant":
                        message = "".join(text_parts)
                if event.get("type") == "moderation":
                    moderation = event.get("moderation_response") or {}
                    blocked = blocked or bool(isinstance(moderation, dict) and moderation.get("blocked") is True)
                if event.get("type") == "server_ste_metadata":
                    metadata = event.get("metadata") or {}
                    if isinstance(metadata, dict) and isinstance(metadata.get("tool_invoked"), bool):
                        tool_invoked = metadata["tool_invoked"]
        finally:
            resp.close()
        if conversation_id and not file_ids and not sediment_ids:
            polled_file_ids, polled_sediment_ids = self.poll_image_ids(conversation_id)
            unique_extend(file_ids, polled_file_ids)
            unique_extend(sediment_ids, polled_sediment_ids)
        urls = self.resolve_image_urls(conversation_id, file_ids, sediment_ids)
        images = self.download_images(urls)
        if not images:
            if message and (blocked or tool_invoked is False):
                raise RuntimeError(message)
            raise RuntimeError(message or "号池生成没有返回图片")
        return [{"b64_json": base64.b64encode(item).decode("ascii")} for item in images]


def generate_one_with_pool(job: dict, prompt: str, index: int) -> list[dict]:
    account = pick_pool_account()
    token = account["access_token"]
    try:
        reference_ids = job.get("reference_ids") or []
        references = [r for r in read_references() if r.get("id") in reference_ids]
        client = ChatGptImageClient(token)
        data = client.generate(prompt, job.get("model") or DEFAULT_MODEL, job.get("aspect_ratio") or "1:1", references)
        mark_pool_account_result(token, True)
        update_job(job["id"], {"usage": {"source": "local_account_pool"}, "revised_prompt": prompt})
        return [save_image_payload(job["id"], index + i, normalize_image(item), prompt) for i, item in enumerate(data)]
    except Exception as exc:
        mark_pool_account_result(token, False, str(exc))
        raise


def read_jobs():
    return read_json(JOBS_FILE, [])


def write_jobs(items):
    write_json(JOBS_FILE, items[-MAX_HISTORY:])


def read_media():
    return read_json(MEDIA_FILE, [])


def write_media(items):
    write_json(MEDIA_FILE, items[-MAX_HISTORY * 4:])


def read_subjects():
    return read_json(SUBJECTS_FILE, [])


def write_subjects(items):
    write_json(SUBJECTS_FILE, items)


def read_references():
    return read_json(REFERENCES_FILE, [])


def write_references(items):
    write_json(REFERENCES_FILE, items[-MAX_HISTORY * 2:])


def current_client_id() -> str:
    value = str(request.headers.get("X-YY-Client-ID") or "").strip()
    value = re.sub(r"[^a-zA-Z0-9_-]", "", value)[:80]
    if value:
        session["client_id"] = value
        return value
    value = str(session.get("client_id") or "").strip()
    value = re.sub(r"[^a-zA-Z0-9_-]", "", value)[:80]
    if not value:
        value = f"sess-{uuid.uuid4().hex}"[:80]
        session["client_id"] = value
    return value


def matches_client(item: dict, client_id: str) -> bool:
    if not client_id:
        return False
    item_client_id = str(item.get("client_id") or "").strip()
    # Keep pre-client-isolation records visible instead of hiding tasks that were
    # created by a browser still running a cached older script.
    return item_client_id == client_id or not item_client_id


def client_jobs(client_id: str | None = None) -> list[dict]:
    cid = client_id if client_id is not None else current_client_id()
    return [job for job in read_jobs() if matches_client(job, cid)]


def client_media(client_id: str | None = None) -> list[dict]:
    cid = client_id if client_id is not None else current_client_id()
    if not cid:
        return []
    job_ids = {str(job.get("id") or "") for job in client_jobs(cid)}
    return [
        item for item in read_media()
        if str(item.get("client_id") or "") == cid or str(item.get("job_id") or "") in job_ids
    ]


def client_references(client_id: str | None = None) -> list[dict]:
    cid = client_id if client_id is not None else current_client_id()
    return [item for item in read_references() if matches_client(item, cid)]


def image_dimensions(path: Path) -> tuple[int, int]:
    try:
        with path.open("rb") as fh:
            head = fh.read(32)
            if head.startswith(b"\x89PNG\r\n\x1a\n") and len(head) >= 24:
                return struct.unpack(">II", head[16:24])
            if head.startswith(b"\xff\xd8"):
                fh.seek(2)
                while True:
                    marker_start = fh.read(1)
                    if not marker_start:
                        break
                    if marker_start != b"\xff":
                        continue
                    marker = fh.read(1)
                    while marker == b"\xff":
                        marker = fh.read(1)
                    if marker in [b"\xc0", b"\xc1", b"\xc2", b"\xc3", b"\xc5", b"\xc6", b"\xc7", b"\xc9", b"\xca", b"\xcb", b"\xcd", b"\xce", b"\xcf"]:
                        fh.read(3)
                        height, width = struct.unpack(">HH", fh.read(4))
                        return width, height
                    length = struct.unpack(">H", fh.read(2))[0]
                    fh.seek(max(0, length - 2), 1)
    except Exception:
        return 0, 0
    return 0, 0


def read_presets():
    presets = read_json(PRESETS_FILE, [])
    if presets:
        return presets
    return [
        {
            "id": "xhs-cover",
            "name": "小红书封面",
            "mode": "cover",
            "prompt": "小红书封面图，醒目标题区域，强对比配色，干净构图，适合手机竖屏浏览",
            "size": "1024x1536",
            "quality": "auto",
        },
        {
            "id": "product-suite",
            "name": "产品套图",
            "mode": "suite",
            "prompt": "产品商业摄影，统一背景，真实光影，细节清晰，适合电商展示",
            "size": "1024x1024",
            "quality": "auto",
        },
        {
            "id": "poster",
            "name": "海报主视觉",
            "mode": "single",
            "prompt": "高级海报设计，明确视觉中心，精致排版，电影级光影",
            "size": "1024x1536",
            "quality": "auto",
        },
    ]


def require_login():
    return True


def login_required_json():
    return None


def build_prompt(payload: dict) -> str:
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        return ""
    subject_id = str(payload.get("subject_id") or "").strip()
    subject_block = ""
    if subject_id:
        subject = next((s for s in read_subjects() if s.get("id") == subject_id), None)
        if subject:
            attrs = "，".join(
                f"{a.get('key')}：{a.get('value')}"
                for a in subject.get("attributes", [])
                if a.get("key") and a.get("value")
            )
            subject_block = f"主体：{subject.get('name', '')}。{subject.get('description', '')}。{attrs}"
    style = str(payload.get("style") or "").strip()
    negative = str(payload.get("negative") or "").strip()
    parts = [prompt]
    if subject_block:
        parts.append(subject_block)
    if style:
        parts.append(f"风格要求：{style}")
    if negative:
        parts.append(f"避免：{negative}")
    seed = str(payload.get("seed") or "").strip()
    if seed:
        parts.append(f"Seed：{seed}")
    return "\n".join(parts)


def estimate_cost(model: str, image_count: int) -> dict:
    rates = {
        "gpt-image-2": 0.25,
        "gpt-image-1.5": 0.28,
        "gpt-image-1": 0.34,
        "nano-banana-pro": 0.12,
        "nano-banana-2": 0.08,
    }
    cny = round(rates.get(model, 0.1) * max(1, image_count), 4)
    return {
        "estimated_cny": cny,
        "site_cny_per_image": 0.05,
        "site_value_images_per_cny": 20,
        "note": "估算值，用于任务规划；实际以 New API 用量日志为准。",
    }


def normalize_image(item):
    if item.get("url"):
        return {"kind": "url", "value": item["url"], "mime": "image/png"}
    b64 = item.get("b64_json")
    if b64:
        return {"kind": "base64", "value": b64, "mime": "image/png"}
    return None


def save_image_payload(job_id: str, index: int, image_payload: dict, prompt: str) -> dict:
    ensure_data_dir()
    media_id = uuid.uuid4().hex
    job = get_job(job_id) or {}
    mime = image_payload.get("mime") or "image/png"
    ext = mimetypes.guess_extension(mime) or ".png"
    filename = f"{media_id}{ext}"
    path = MEDIA_DIR / filename
    source_url = ""
    if image_payload["kind"] == "base64":
        path.write_bytes(base64.b64decode(image_payload["value"]))
    else:
        source_url = image_payload["value"]
        resp = requests.get(source_url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        mime = resp.headers.get("Content-Type", mime).split(";")[0] or mime
    return {
        "id": media_id,
        "job_id": job_id,
        "client_id": str(job.get("client_id") or ""),
        "index": index,
        "url": f"/media/{filename}",
        "source_url": source_url,
        "mime": mime,
        "prompt": prompt,
        "created_at": now_ts(),
    }


def reference_to_data_url(ref: dict) -> str:
    url = str(ref.get("url") or "")
    if not url.startswith("/references/"):
        return ""
    filename = url.split("/references/", 1)[1]
    path = REFERENCE_DIR / filename
    if not path.exists():
        return ""
    mime = ref.get("mime") or mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def reference_paths(references: list[dict]) -> list[tuple[Path, str]]:
    items: list[tuple[Path, str]] = []
    for ref in references[:4]:
        filename = str(ref.get("url") or "").split("/references/", 1)[-1]
        path = REFERENCE_DIR / filename
        if path.exists():
            items.append((path, ref.get("mime") or mimetypes.guess_type(path.name)[0] or "image/png"))
    return items


def post_image_edit(api_base: str, headers: dict, job: dict, prompt: str, references: list[dict]):
    ref_paths = reference_paths(references)
    if not ref_paths:
        raise RuntimeError("参考图文件不存在，请重新上传参考图")
    data = {"model": job["model"], "prompt": prompt, "size": job["size"], "n": "1"}
    if job.get("quality") and job["quality"] != "auto":
        data["quality"] = job["quality"]
    if job.get("output_format"):
        data["output_format"] = job["output_format"]

    last_resp = None
    for field_name in ("image", "image[]"):
        opened = []
        try:
            files = []
            for path, mime in ref_paths:
                fh = path.open("rb")
                opened.append(fh)
                files.append((field_name, (path.name, fh, mime)))
            resp = requests.post(
                urljoin(api_base + "/", "v1/images/edits"),
                headers=headers,
                data=data,
                files=files,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code < 400:
                return resp
            last_resp = resp
            if resp.status_code not in {400, 404, 422}:
                return resp
        finally:
            for fh in opened:
                fh.close()
    return last_resp


def update_job(job_id: str, patch: dict) -> dict | None:
    with state_lock:
        jobs = read_jobs()
        for job in jobs:
            if job.get("id") == job_id:
                job.update(patch)
                job["updated_at"] = now_ts()
                write_jobs(jobs)
                return job
    return None


def get_job(job_id: str) -> dict | None:
    with state_lock:
        return next((j for j in read_jobs() if j.get("id") == job_id), None)


def normalize_api_base(api_url: str) -> str:
    base = (api_url or NEW_API_BASE).strip().rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3].rstrip("/")
    return base


def bearer_token(token: str) -> str:
    value = (token or NEW_API_TOKEN).strip()
    if not value:
        return ""
    return "Bearer " + ("sk-" + value.removeprefix("sk-"))


def job_api_base(job: dict) -> str:
    return normalize_api_base(str(job.get("resolved_api_url") or job.get("api_url") or ""))


def candidate_api_urls(connection_mode: str, api_url: str) -> list[str]:
    mode = (connection_mode or "custom").strip()
    if mode == "custom":
        custom_url = api_url.strip() or connection_endpoints().get("custom", "")
        return [custom_url] if custom_url else []
    return []


def fetch_models(api_url: str, api_key: str) -> list[str]:
    headers = {}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    resp = requests.get(
        urljoin(normalize_api_base(api_url) + "/", "v1/models"),
        headers=headers,
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    models = []
    for item in data.get("data", []):
        model_id = item.get("id") if isinstance(item, dict) else str(item)
        if model_id:
            models.append(str(model_id))
    return models


def is_image_model_id(model: str) -> bool:
    value = str(model or "").lower()
    return any(token in value for token in (
        "dall-e",
        "dalle",
        "gpt-image",
        "image",
        "imagen",
        "banana",
        "flux",
        "stable",
        "stability",
        "sdxl",
        "midjourney",
        "mj-",
    ))


def is_text_model_id(model: str) -> bool:
    value = str(model or "").lower()
    if not value or is_image_model_id(value):
        return False
    return any(token in value for token in (
        "gpt-",
        "gpt4",
        "gpt5",
        "o3",
        "o4",
        "o5",
        "chat",
        "claude",
        "deepseek",
        "qwen",
        "glm",
        "moonshot",
        "kimi",
        "yi-",
        "llama",
        "mistral",
        "gemini",
    ))


def split_model_ids(models: list[str]) -> tuple[list[str], list[str]]:
    image_models = [model for model in models if is_image_model_id(model)]
    text_models = [model for model in models if is_text_model_id(model)]
    return image_models, text_models


def resolve_api_url(connection_mode: str, api_url: str, api_key: str) -> tuple[str, list[str]]:
    errors = []
    for candidate in candidate_api_urls(connection_mode, api_url):
        try:
            fetch_models(candidate, api_key)
            return candidate.rstrip("/"), errors
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    fallback = (api_url.strip() or connection_endpoints().get("custom", NEW_API_BASE)).rstrip("/")
    return fallback, errors


def extract_json_object(text: str) -> dict:
    value = str(text or "").strip()
    if not value:
        raise ValueError("empty response")
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        pass
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", value, re.S)
    if fenced:
        return json.loads(fenced.group(1))
    start = value.find("{")
    end = value.rfind("}")
    if start >= 0 and end > start:
        return json.loads(value[start:end + 1])
    raise ValueError("response does not contain JSON")


def normalize_agent_plan(plan: dict, fallback_values: dict) -> dict:
    if not isinstance(plan, dict):
        raise ValueError("agent plan must be an object")
    variants = plan.get("variants")
    if not isinstance(variants, list):
        variants = []
    normalized_variants = []
    for item in variants:
        if not isinstance(item, dict):
            continue
        variant_id = str(item.get("id") or "").strip().lower()
        if variant_id not in {"stable", "creative", "commercial"}:
            continue
        prompt = str(item.get("prompt") or "").strip()
        if not prompt:
            continue
        normalized_variants.append({
            "id": variant_id,
            "title": str(item.get("title") or {"stable": "稳定版", "creative": "创意版", "commercial": "商业版"}[variant_id]).strip(),
            "prompt": prompt,
        })
    seen = {item["id"] for item in normalized_variants}
    if not {"stable", "creative", "commercial"}.issubset(seen):
        raise ValueError("agent plan missing required variants")
    order = {"stable": 0, "creative": 1, "commercial": 2}
    normalized_variants = sorted(normalized_variants, key=lambda item: order[item["id"]])
    brief = str(plan.get("brief") or "").strip()
    if not brief:
        brief = "已根据行业、平台、主体、卖点和留白要求生成三套差异化提示词方案。"
    values = plan.get("values") if isinstance(plan.get("values"), dict) else {}
    return {
        "brief": brief[:2400],
        "variants": normalized_variants,
        "values": {**fallback_values, **values},
        "negative": str(plan.get("negative") or "").strip(),
        "params": plan.get("params") if isinstance(plan.get("params"), dict) else {},
    }


def build_agent_plan_messages(payload: dict) -> list[dict]:
    agent = payload.get("agent") if isinstance(payload.get("agent"), dict) else {}
    values = payload.get("values") if isinstance(payload.get("values"), dict) else {}
    revision = int(payload.get("revision") or 1)
    return [
        {
            "role": "system",
            "content": (
                "你是商业生图工作台的行业创意总监和提示词工程师。"
                "只输出严格 JSON，不要 Markdown。"
                "你要为同一个业务 brief 生成 stable、creative、commercial 三套明显不同的中文生图提示词。"
                "三套方案必须在场景、构图、光线、镜头、道具或视觉隐喻上有实质差异；"
                "creative 不能只写更有创意，必须给出可执行画面方案。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "output_schema": {
                    "brief": "string",
                    "values": "object",
                    "variants": [
                        {"id": "stable", "title": "稳定版", "prompt": "string"},
                        {"id": "creative", "title": "创意版", "prompt": "string"},
                        {"id": "commercial", "title": "商业版", "prompt": "string"},
                    ],
                    "negative": "string",
                    "params": {"aspect_ratio": "string", "count": "number"},
                },
                "requirements": [
                    "stable: 主体完整、棚拍或干净场景、交付稳定",
                    "creative: 场景叙事、视觉隐喻、非常规构图或情绪光线，仍保持主体真实可识别",
                    "commercial: 广告 KV、卖点可视化、品牌页面可用、文案安全区明确",
                    "每个 prompt 必须包含主体、材质/颜色、场景、构图、光线、镜头、背景、平台约束、交付标准、负面控制",
                    "不要生成真实品牌 Logo、不要要求画中文字，除非用户明确要求",
                ],
                "revision": revision,
                "agent": agent,
                "values": values,
            }, ensure_ascii=False),
        },
    ]


def call_agent_text_model(api_url: str, api_key: str, model: str, payload: dict) -> dict:
    api_base = normalize_api_base(api_url)
    headers = {"Content-Type": "application/json"}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    body = {
        "model": model,
        "messages": build_agent_plan_messages(payload),
        "temperature": 0.75,
        "response_format": {"type": "json_object"},
    }
    resp = requests.post(
        urljoin(api_base + "/", "v1/chat/completions"),
        headers=headers,
        json=body,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    return normalize_agent_plan(extract_json_object(content), payload.get("values") if isinstance(payload.get("values"), dict) else {})


def generate_one(job: dict, prompt: str, index: int) -> list[dict]:
    if str(job.get("connection_mode") or "").strip() == "pool":
        return generate_one_with_pool(job, prompt, index)
    headers = {"Authorization": bearer_token(str(job.get("api_key") or ""))}
    api_base = job_api_base(job)
    reference_ids = job.get("reference_ids") or []
    references = [r for r in read_references() if r.get("id") in reference_ids]
    use_edit = job.get("edit_mode") and references
    if use_edit:
        resp = post_image_edit(api_base, headers, job, prompt, references)
    else:
        upstream_payload = {
            "model": job["model"],
            "prompt": prompt,
            "n": 1,
            "size": job["size"],
        }
        if references:
            upstream_payload["reference_images"] = [reference_to_data_url(ref) for ref in references[:4]]
            upstream_payload["reference_images"] = [item for item in upstream_payload["reference_images"] if item]
        if job.get("quality") and job["quality"] != "auto":
            upstream_payload["quality"] = job["quality"]
        if job.get("output_format"):
            upstream_payload["output_format"] = job["output_format"]
        resp = requests.post(
            urljoin(api_base + "/", "v1/images/generations"),
            headers={**headers, "Content-Type": "application/json"},
            json=upstream_payload,
            timeout=REQUEST_TIMEOUT,
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"New API {resp.status_code}: {resp.text[:1000]}")
    data = resp.json()
    update_job(job["id"], {"usage": data.get("usage"), "revised_prompt": data.get("revised_prompt")})
    images = [normalize_image(item) for item in data.get("data", [])]
    images = [img for img in images if img]
    return [save_image_payload(job["id"], index + i, img, prompt) for i, img in enumerate(images)]


def run_job(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return
    update_job(job_id, {"status": "running", "started_at": now_ts(), "error": ""})
    created_media = []
    try:
        base_prompt = build_prompt(job)
        if not base_prompt:
            raise RuntimeError("提示词为空")
        count = max(1, min(int(job.get("count") or 1), 20))
        variants = job.get("variants") or []
        estimate = estimate_cost(job.get("model", ""), count)
        update_job(job_id, {"cost": estimate})
        prompts: list[str] = []
        if variants:
            for variant in variants[:count]:
                prompts.append(f"{base_prompt}\n画面分镜：{variant}")
        else:
            prompts = [base_prompt for _ in range(count)]
        retry_limit = max(0, min(int(job.get("retry_limit") or 0), 5))
        for idx, prompt in enumerate(prompts):
            last_error = ""
            for attempt in range(retry_limit + 1):
                attempt_text = f" · 重试 {attempt}/{retry_limit}" if attempt else ""
                update_job(job_id, {
                    "progress": {
                        "done": idx,
                        "total": len(prompts),
                        "message": f"生成第 {idx + 1}/{len(prompts)} 张{attempt_text}",
                    },
                    "last_attempt": attempt + 1,
                })
                try:
                    created_media.extend(generate_one(job, prompt, idx))
                    last_error = ""
                    break
                except Exception as exc:
                    last_error = str(exc)
                    update_job(job_id, {"error": last_error})
                    if attempt >= retry_limit:
                        raise
                    time.sleep(min(10, 1.6 * (attempt + 1)))
            with state_lock:
                media = read_media()
                media.extend(created_media)
                unique = {item["id"]: item for item in media}
                write_media(list(unique.values()))
        update_job(
            job_id,
            {
                "status": "success",
                "completed_at": now_ts(),
                "progress": {"done": len(prompts), "total": len(prompts), "message": "完成"},
                "media_ids": [m["id"] for m in created_media],
            },
        )
    except Exception as exc:
        update_job(job_id, {"status": "error", "error": str(exc), "completed_at": now_ts()})


def worker_loop() -> None:
    while True:
        job_id = job_queue.get()
        try:
            run_job(job_id)
        finally:
            job_queue.task_done()


def ensure_worker() -> None:
    global worker_started
    if worker_started:
        return
    worker_started = True
    threading.Thread(target=worker_loop, daemon=True).start()


@app.before_request
def boot_worker():
    ensure_worker()


@app.get("/")
def index():
    model_config = read_model_config()
    models = available_model_ids()
    default_model = DEFAULT_MODEL if DEFAULT_MODEL in models else models[0]
    return render_template(
        "index.html",
        username=read_admin_auth()["username"],
        models=models,
        default_model=default_model,
        model_config=model_config,
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    error = ""
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        admin_auth = read_admin_auth()
        if username == admin_auth["username"] and password == admin_auth["password"]:
            session["admin"] = True
            session["user"] = username
            return redirect(request.args.get("next") or url_for("admin"))
        error = "账号或密码错误"
    return render_template("login.html", error=error)


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


def require_admin():
    if session.get("admin") is True:
        return None
    return redirect(url_for("login", next=request.path))


@app.route("/admin", methods=["GET", "POST"])
def admin():
    auth = require_admin()
    if auth:
        return auth
    saved = False
    message = ""
    sub2api_remote_accounts = []
    cpa_remote_files = []
    sync_errors = []
    if request.method == "POST":
        action = request.form.get("action", "save_model_config")
        accounts = read_account_pool()
        pool_users = read_pool_users()
        if action == "save_admin_auth":
            username = request.form.get("admin_username", "").strip()
            password = request.form.get("admin_password", "").strip()
            write_admin_auth(username, password)
            session["user"] = username or "root"
            admin_log("修改管理员账号")
            message = "管理员账号密码已保存。"
            saved = True
        elif action == "add_pool_user":
            username = request.form.get("pool_username", "").strip()
            password = request.form.get("pool_password", "").strip()
            display_name = request.form.get("pool_display_name", "").strip()
            note = request.form.get("pool_note", "").strip()
            if not username or not password:
                message = "号池登录用户和密码不能为空。"
            elif any(item.get("username", "").lower() == username.lower() for item in pool_users):
                message = "号池登录用户已存在。"
            else:
                user = normalize_pool_user({
                    "username": username,
                    "password": password,
                    "display_name": display_name or username,
                    "note": note,
                    "enabled": True,
                    "created_at": now_ts(),
                    "updated_at": now_ts(),
                })
                if user:
                    write_pool_users(pool_users + [user])
                    admin_log("创建号池登录用户", {"username": username})
                    message = "号池登录用户已创建。"
            saved = True
        elif action == "update_pool_user":
            target = request.form.get("target_pool_user_id", "").strip()
            username = request.form.get("pool_username", "").strip()
            password = request.form.get("pool_password", "").strip()
            display_name = request.form.get("pool_display_name", "").strip()
            note = request.form.get("pool_note", "").strip()
            enabled = request.form.get("pool_enabled") == "on"
            if not target:
                message = "没有选择要更新的号池登录用户。"
            elif not username:
                message = "号池登录用户名不能为空。"
            elif any(item.get("id") != target and item.get("username", "").lower() == username.lower() for item in pool_users):
                message = "号池登录用户已存在。"
            else:
                updated = []
                for item in pool_users:
                    if item.get("id") == target:
                        item = {
                            **item,
                            "username": username,
                            "display_name": display_name or username,
                            "note": note,
                            "enabled": enabled,
                            "updated_at": now_ts(),
                        }
                        if password:
                            item["password_hash"] = generate_password_hash(password)
                    updated.append(item)
                write_pool_users(updated)
                if session.get("pool_user_id") == target and not enabled:
                    session.pop("pool_user_id", None)
                admin_log("更新号池登录用户", {"username": username, "enabled": enabled})
                message = "号池登录用户已更新。"
            saved = True
        elif action == "delete_pool_user":
            target = request.form.get("target_pool_user_id", "").strip()
            write_pool_users([item for item in pool_users if item.get("id") != target])
            if session.get("pool_user_id") == target:
                session.pop("pool_user_id", None)
            admin_log("删除号池登录用户", {"id": target})
            message = "号池登录用户已删除。"
            saved = True
        elif action == "save_model_config":
            current = read_model_config()
            connections = {}
            for key in ("custom", "pool"):
                existing = current["connections"].get(key, {})
                connections[key] = {
                    "label": request.form.get(f"{key}_label", existing.get("label", key)).strip(),
                    "badge": request.form.get(f"{key}_badge", existing.get("badge", "")).strip(),
                    "url": request.form.get(f"{key}_url", existing.get("url", "")).strip(),
                    "description": request.form.get(f"{key}_description", existing.get("description", "")).strip(),
                    "enabled": True,
                }
            profiles = []
            for line in request.form.get("model_profiles", "").splitlines():
                parts = [part.strip() for part in line.split("|")]
                if not parts or not parts[0]:
                    continue
                profiles.append({
                    "id": parts[0],
                    "title": parts[1] if len(parts) > 1 and parts[1] else parts[0],
                    "description": parts[2] if len(parts) > 2 and parts[2] else "后台可维护模型说明。",
                    "tag": parts[3] if len(parts) > 3 and parts[3] else "生图",
                })
            config = {
                "default_connection_mode": request.form.get("default_connection_mode", "custom"),
                "auto_order": [],
                "connections": connections,
                "model_profiles": profiles,
            }
            write_model_config(config)
            admin_log("保存模型接入配置")
            message = "模型接入配置已保存。"
            saved = True
        elif action == "add_account":
            account = normalize_account({
                "access_token": request.form.get("access_token", ""),
                "email": request.form.get("email", ""),
                "type": request.form.get("type", "openai"),
                "status": request.form.get("status", "正常"),
                "quota": request.form.get("quota", "0"),
                "source": "manual",
                "note": request.form.get("note", ""),
            })
            if account:
                write_account_pool(accounts + [account])
                admin_log("手动添加账号", {"token": account["token_mask"], "email": account["email"]})
                message = "账号已添加到号池。"
                saved = True
        elif action == "import_accounts":
            source = request.form.get("import_source", "json")
            try:
                imported = parse_account_import(request.form.get("account_import", ""), source)
                write_account_pool(accounts + imported)
                admin_log("导入账号", {"source": source, "count": len(imported)})
                message = f"已导入 {len(imported)} 个账号，重复 Token 会自动覆盖。"
            except Exception as exc:
                admin_log("导入账号失败", {"source": source, "error": str(exc)})
                message = f"导入失败：{exc}"
            saved = True
        elif action == "update_account":
            target = request.form.get("target_token", "")
            updated = []
            for item in accounts:
                if item.get("access_token") == target:
                    item = {
                        **item,
                        "status": request.form.get("status", item.get("status", "正常")),
                        "type": request.form.get("type", item.get("type", "openai")),
                        "quota": request.form.get("quota", item.get("quota", 0)),
                        "note": request.form.get("note", item.get("note", "")),
                    }
                updated.append(item)
            write_account_pool(updated)
            admin_log("更新账号状态", {"token": mask_secret(target)})
            message = "账号状态已更新。"
            saved = True
        elif action == "delete_accounts":
            targets = set(request.form.getlist("account_token"))
            write_account_pool([item for item in accounts if item.get("access_token") not in targets])
            admin_log("删除账号", {"count": len(targets)})
            message = f"已删除 {len(targets)} 个账号。"
            saved = True
        elif action == "refresh_selected_accounts":
            targets = request.form.getlist("account_token") or [request.form.get("target_token", "")]
            result = refresh_account_pool(targets)
            admin_log("刷新账号信息和额度", {"count": len(targets), "errors": len(result["errors"])})
            message = f"已刷新 {result['refreshed']} 个账号，失败 {len(result['errors'])} 个。"
            saved = True
        elif action == "refresh_all_accounts":
            result = refresh_account_pool()
            admin_log("刷新全部账号信息和额度", {"errors": len(result["errors"])})
            message = f"已刷新 {result['refreshed']} 个账号，失败 {len(result['errors'])} 个。"
            saved = True
        elif action in {"save_sub2api_config", "browse_sub2api_accounts", "import_sub2api_selected"}:
            current = read_integration_config()
            next_integrations = {
                **current,
                "sub2api": {
                    "name": request.form.get("sub2api_name", ""),
                    "base_url": request.form.get("sub2api_base_url", ""),
                    "auth_method": request.form.get("sub2api_auth_method", "password"),
                    "username": request.form.get("sub2api_username", ""),
                    "password": request.form.get("sub2api_password", ""),
                    "api_key": request.form.get("sub2api_api_key", ""),
                    "group_id": request.form.get("sub2api_group_id", ""),
                },
            }
            write_integration_config(next_integrations)
            conf = read_integration_config()["sub2api"]
            if action == "save_sub2api_config":
                admin_log("保存 Sub2API 连接")
                message = "Sub2API 连接已保存。"
            elif action == "browse_sub2api_accounts":
                try:
                    sub2api_remote_accounts = list_sub2api_remote_accounts(conf)
                    admin_log("读取 Sub2API 远端账号", {"count": len(sub2api_remote_accounts), "base_url": conf.get("base_url")})
                    message = f"已读取 Sub2API 远端账号 {len(sub2api_remote_accounts)} 个，请勾选后导入。"
                except Exception as exc:
                    admin_log("读取 Sub2API 远端账号失败", {"error": str(exc)})
                    message = f"读取 Sub2API 失败：{exc}"
            elif action == "import_sub2api_selected":
                selected_ids = request.form.getlist("sub2api_account_id")
                imported, sync_errors = import_sub2api_accounts(conf, selected_ids)
                write_account_pool(accounts + imported)
                admin_log("导入 Sub2API 账号", {"count": len(imported), "failed": len(sync_errors)})
                message = f"已从 Sub2API 导入 {len(imported)} 个账号，失败 {len(sync_errors)} 个。"
                try:
                    sub2api_remote_accounts = list_sub2api_remote_accounts(conf)
                except Exception:
                    sub2api_remote_accounts = []
            saved = True
        elif action in {"save_cpa_config", "browse_cpa_files", "import_cpa_selected"}:
            current = read_integration_config()
            next_integrations = {
                **current,
                "cpa": {
                    "name": request.form.get("cpa_name", ""),
                    "base_url": request.form.get("cpa_base_url", ""),
                    "secret_key": request.form.get("cpa_secret_key", ""),
                },
            }
            write_integration_config(next_integrations)
            conf = read_integration_config()["cpa"]
            if action == "save_cpa_config":
                admin_log("保存 CPA 连接")
                message = "CPA 连接已保存。"
            elif action == "browse_cpa_files":
                try:
                    cpa_remote_files = list_cpa_remote_files(conf)
                    admin_log("读取 CPA 远端文件", {"count": len(cpa_remote_files), "base_url": conf.get("base_url")})
                    message = f"已读取 CPA 远端文件 {len(cpa_remote_files)} 个，请勾选后导入。"
                except Exception as exc:
                    admin_log("读取 CPA 远端文件失败", {"error": str(exc)})
                    message = f"读取 CPA 失败：{exc}"
            elif action == "import_cpa_selected":
                selected_files = request.form.getlist("cpa_file_name")
                imported, sync_errors = import_cpa_files(conf, selected_files)
                write_account_pool(accounts + imported)
                admin_log("导入 CPA 账号", {"count": len(imported), "failed": len(sync_errors)})
                message = f"已从 CPA 导入 {len(imported)} 个账号，失败 {len(sync_errors)} 个。"
                try:
                    cpa_remote_files = list_cpa_remote_files(conf)
                except Exception:
                    cpa_remote_files = []
            saved = True
        elif action == "save_integrations":
            next_integrations = {
                "sub2api": {
                    "name": request.form.get("sub2api_name", ""),
                    "base_url": request.form.get("sub2api_base_url", ""),
                    "auth_method": request.form.get("sub2api_auth_method", "password"),
                    "username": request.form.get("sub2api_username", ""),
                    "password": request.form.get("sub2api_password", ""),
                    "api_key": request.form.get("sub2api_api_key", ""),
                    "group_id": request.form.get("sub2api_group_id", ""),
                },
                "cpa": {
                    "name": request.form.get("cpa_name", ""),
                    "base_url": request.form.get("cpa_base_url", ""),
                    "secret_key": request.form.get("cpa_secret_key", ""),
                },
            }
            write_integration_config(next_integrations)
            admin_log("保存 sub2api/CPA 设置")
            message = "导入源设置已保存。"
            saved = True
        elif action == "sync_sub2api":
            integrations = read_integration_config()
            try:
                synced = sync_sub2api_accounts(integrations["sub2api"])
                write_account_pool(accounts + synced)
                admin_log("同步 Sub2API 账号", {"count": len(synced), "base_url": integrations["sub2api"].get("base_url")})
                message = f"已从 Sub2API 同步 {len(synced)} 个账号到号池。"
            except Exception as exc:
                admin_log("同步 Sub2API 失败", {"error": str(exc)})
                message = f"Sub2API 同步失败：{exc}"
            saved = True
        elif action == "sync_cpa":
            integrations = read_integration_config()
            try:
                synced = sync_cpa_accounts(integrations["cpa"])
                write_account_pool(accounts + synced)
                admin_log("同步 CPA 账号", {"count": len(synced), "base_url": integrations["cpa"].get("base_url")})
                message = f"已从 CPA 同步 {len(synced)} 个账号到号池。"
            except Exception as exc:
                admin_log("同步 CPA 失败", {"error": str(exc)})
                message = f"CPA 同步失败：{exc}"
            saved = True
        elif action == "delete_media":
            media_ids = set(request.form.getlist("media_id"))
            media_items = read_media()
            for item in media_items:
                if item.get("id") in media_ids:
                    filename = str(item.get("url") or "").split("/media/", 1)[-1]
                    target = (MEDIA_DIR / filename).resolve()
                    try:
                        if filename and str(target).startswith(str(MEDIA_DIR.resolve())) and target.exists():
                            target.unlink()
                    except OSError:
                        pass
            write_media([item for item in media_items if item.get("id") not in media_ids])
            admin_log("删除图片", {"count": len(media_ids)})
            message = f"已删除 {len(media_ids)} 张图片。"
            saved = True
    config = read_model_config()
    profile_lines = "\n".join(
        f"{item.get('id','')} | {item.get('title','')} | {item.get('description','')} | {item.get('tag','')}"
        for item in config.get("model_profiles", [])
    )
    accounts = read_account_pool()
    pool_users = read_pool_users()
    media_items = sorted(read_media(), key=lambda x: x.get("created_at", 0), reverse=True)
    jobs = sorted(read_jobs(), key=lambda x: x.get("created_at", 0), reverse=True)
    logs = sorted(read_json(ADMIN_LOGS_FILE, []), key=lambda x: x.get("created_at", 0), reverse=True)
    return render_template(
        "admin.html",
        config=config,
        profile_lines=profile_lines,
        saved=saved,
        message=message,
        admin_auth=read_admin_auth(),
        accounts=accounts,
        account_stats=account_stats(accounts),
        pool_users=pool_users,
        pool_user_stats=pool_user_stats(pool_users),
        integrations=read_integration_config(),
        media_items=media_items,
        jobs=jobs[:80],
        logs=logs[:120],
        sub2api_remote_accounts=sub2api_remote_accounts,
        cpa_remote_files=cpa_remote_files,
        sync_errors=sync_errors,
    )


@app.get("/media/<path:filename>")
def media_file(filename):
    return send_from_directory(MEDIA_DIR, filename)


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "models": available_model_ids(), "new_api_base": NEW_API_BASE, "model_config": read_model_config()})


@app.get("/api/pool/session")
def pool_session():
    auth = login_required_json()
    if auth:
        return auth
    return jsonify({"user": public_pool_user(current_pool_user()), "account_pool": account_stats(read_account_pool())})


@app.post("/api/pool/login")
def pool_login():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    for user in read_pool_users():
        if user.get("username", "").lower() != username.lower():
            continue
        if not user.get("enabled", True):
            return jsonify({"error": "该号池用户已停用"}), 403
        if not verify_pool_user_password(user, password):
            break
        user["last_login_at"] = now_ts()
        user["updated_at"] = now_ts()
        write_pool_users([item if item.get("id") != user.get("id") else user for item in read_pool_users()])
        session["pool_user_id"] = user["id"]
        admin_log("号池用户登录", {"username": user["username"]})
        return jsonify({"user": public_pool_user(user), "account_pool": account_stats(read_account_pool())})
    return jsonify({"error": "号池用户名或密码错误"}), 401


@app.post("/api/pool/logout")
def pool_logout():
    auth = login_required_json()
    if auth:
        return auth
    session.pop("pool_user_id", None)
    return jsonify({"ok": True, "user": None})


@app.get("/api/state")
def state():
    auth = login_required_json()
    if auth:
        return auth
    client_id = current_client_id()
    return jsonify({
        "jobs": sorted(client_jobs(client_id), key=lambda x: x.get("created_at", 0), reverse=True),
        "media": sorted(client_media(client_id), key=lambda x: x.get("created_at", 0), reverse=True),
        "subjects": sorted(read_subjects(), key=lambda x: x.get("updated_at", 0), reverse=True),
        "references": sorted(client_references(client_id), key=lambda x: x.get("created_at", 0), reverse=True),
        "presets": read_presets(),
        "models": available_model_ids(),
        "default_model": DEFAULT_MODEL,
        "model_config": read_model_config(),
        "account_pool": account_stats(read_account_pool()),
        "pool_user": public_pool_user(current_pool_user()),
        "pool_users": pool_user_stats(read_pool_users()),
    })


@app.post("/api/models")
def models():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    api_key = str(payload.get("api_key") or "").strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    pool_user = None
    api_url = str(payload.get("api_url") or "").strip()
    if connection_mode == "custom" and not api_url:
        return jsonify({"error": "请先填写自定义 API URL"}), 400
    if connection_mode == "pool":
        pool_user, pool_error = require_pool_user_json()
        if pool_error:
            return pool_error
        stats = account_stats(read_account_pool())
        return jsonify({
            "ok": True,
            "models": available_model_ids(),
            "api_url": "local-account-pool",
            "account_pool": stats,
            "pool_user": public_pool_user(pool_user),
        })
    errors = []
    for candidate in candidate_api_urls(connection_mode, api_url):
        try:
            model_list = fetch_models(candidate, api_key)
            image_models, text_models = split_model_ids(model_list)
            return jsonify({
                "ok": True,
                "models": model_list,
                "image_models": image_models,
                "text_models": text_models,
                "api_url": candidate.rstrip("/"),
            })
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    return jsonify({"error": "模型读取失败", "detail": " | ".join(errors)}), 502


@app.post("/api/agent-plan")
def agent_plan():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    if not model:
        return jsonify({"error": "请先选择或填写 Agent 文本模型"}), 400
    if not api_url:
        return jsonify({"error": "请先填写文本模型 API URL"}), 400
    if not api_key:
        return jsonify({"error": "请先填写文本模型 API Key"}), 400
    try:
        plan = call_agent_text_model(api_url, api_key, model, payload)
        return jsonify({"ok": True, "plan": plan, "model": model})
    except Exception as exc:
        return jsonify({"error": "Agent 文本模型生成失败", "detail": str(exc)}), 502


@app.post("/api/jobs")
def create_job():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "请输入提示词"}), 400
    api_key = str(payload.get("api_key") or "").strip()
    mode = str(payload.get("mode") or "single")
    count = max(1, min(int(payload.get("count") or 1), 20))
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    pool_user = None
    if connection_mode != "pool" and not (api_key or NEW_API_TOKEN):
        return jsonify({"error": "请先填写 API Key"}), 400
    if connection_mode == "pool":
        pool_user, pool_error = require_pool_user_json()
        if pool_error:
            return pool_error
    if connection_mode == "pool" and not pool_available_accounts():
        return jsonify({"error": "本地号池没有可用账号，请先到管理员号池导入账号并刷新额度"}), 400
    api_url = str(payload.get("api_url") or "").strip()
    if connection_mode == "custom" and not api_url:
        return jsonify({"error": "请先填写自定义 API URL"}), 400
    if connection_mode == "pool":
        resolved_api_url, resolve_errors = "local-account-pool", []
    else:
        resolved_api_url, resolve_errors = resolve_api_url(connection_mode, api_url, api_key)
    client_id = current_client_id()
    job = {
        "id": uuid.uuid4().hex,
        "client_id": client_id,
        "mode": mode,
        "protocol": str(payload.get("protocol") or "custom-openai").strip(),
        "connection_mode": connection_mode,
        "api_url": api_url.rstrip("/") if api_url else resolved_api_url,
        "resolved_api_url": resolved_api_url,
        "api_key": api_key,
        "connection_errors": resolve_errors,
        "pool_user_id": pool_user.get("id") if pool_user else "",
        "pool_username": pool_user.get("username") if pool_user else "",
        "pool_display_name": pool_user.get("display_name") if pool_user else "",
        "agent_id": str(payload.get("agent_id") or "").strip(),
        "agent_name": str(payload.get("agent_name") or "").strip(),
        "agent_variant": str(payload.get("agent_variant") or "").strip(),
        "agent_enabled": bool(payload.get("agent_enabled")),
        "title": str(payload.get("title") or "").strip() or prompt[:36],
        "prompt": prompt,
        "style": str(payload.get("style") or "").strip(),
        "negative": str(payload.get("negative") or "").strip(),
        "subject_id": str(payload.get("subject_id") or "").strip(),
        "model": str(payload.get("model") or DEFAULT_MODEL).strip(),
        "aspect_ratio": str(payload.get("aspect_ratio") or "1:1").strip(),
        "resolution": str(payload.get("resolution") or "1K").strip(),
        "size": str(payload.get("size") or "1024x1024").strip(),
        "quality": str(payload.get("quality") or "auto").strip(),
        "output_format": str(payload.get("output_format") or "png").strip(),
        "count": count,
        "concurrency": max(1, min(int(payload.get("concurrency") or 2), 6)),
        "retry_limit": max(0, min(int(payload.get("retry_limit") or 2), 5)),
        "seed": str(payload.get("seed") or "").strip(),
        "variants": [str(v).strip() for v in payload.get("variants", []) if str(v).strip()],
        "reference_ids": [str(v).strip() for v in payload.get("reference_ids", []) if str(v).strip()][:4],
        "edit_mode": bool(payload.get("edit_mode")),
        "status": "queued",
        "progress": {"done": 0, "total": count, "message": "排队中"},
        "media_ids": [],
        "error": "",
        "created_at": now_ts(),
        "updated_at": now_ts(),
    }
    with state_lock:
        jobs = read_jobs()
        jobs.append(job)
        write_jobs(jobs)
    job_queue.put(job["id"])
    return jsonify({"job": job})


@app.post("/api/jobs/<job_id>/retry")
def retry_job(job_id):
    auth = login_required_json()
    if auth:
        return auth
    client_id = current_client_id()
    source = get_job(job_id)
    if not source or not matches_client(source, client_id):
        return jsonify({"error": "任务不存在"}), 404
    payload = request.get_json(silent=True) or {}
    api_key = str(payload.get("api_key") or source.get("api_key") or "").strip()
    connection_mode = str(payload.get("connection_mode") or source.get("connection_mode") or "custom").strip()
    pool_user = None
    if connection_mode != "pool" and not (api_key or NEW_API_TOKEN):
        return jsonify({"error": "请先填写 API Key"}), 400
    if connection_mode == "pool":
        pool_user, pool_error = require_pool_user_json()
        if pool_error:
            return pool_error
    if connection_mode == "pool" and not pool_available_accounts():
        return jsonify({"error": "本地号池没有可用账号，请先到管理员号池导入账号并刷新额度"}), 400
    api_url = str(payload.get("api_url") or source.get("api_url") or "").strip()
    if connection_mode == "custom" and not api_url:
        return jsonify({"error": "请先填写自定义 API URL"}), 400
    if connection_mode == "pool":
        resolved_api_url, resolve_errors = "local-account-pool", []
    else:
        resolved_api_url, resolve_errors = resolve_api_url(connection_mode, api_url, api_key)
    retry_count = int(source.get("retry_count") or 0) + 1
    job = {
        "id": uuid.uuid4().hex,
        "client_id": client_id,
        "mode": str(source.get("mode") or "single"),
        "protocol": str(source.get("protocol") or "custom-openai").strip(),
        "connection_mode": connection_mode,
        "api_url": api_url.rstrip("/") if api_url else resolved_api_url,
        "resolved_api_url": resolved_api_url,
        "api_key": api_key,
        "connection_errors": resolve_errors,
        "pool_user_id": pool_user.get("id") if pool_user else "",
        "pool_username": pool_user.get("username") if pool_user else "",
        "pool_display_name": pool_user.get("display_name") if pool_user else "",
        "agent_id": str(source.get("agent_id") or "").strip(),
        "agent_name": str(source.get("agent_name") or "").strip(),
        "agent_variant": str(source.get("agent_variant") or "").strip(),
        "agent_enabled": bool(source.get("agent_enabled")),
        "title": f"重试 {retry_count} · {str(source.get('title') or source.get('prompt') or '未命名任务')[:32]}",
        "prompt": str(source.get("prompt") or "").strip(),
        "style": str(source.get("style") or "").strip(),
        "negative": str(source.get("negative") or "").strip(),
        "subject_id": str(source.get("subject_id") or "").strip(),
        "model": str(payload.get("model") or source.get("model") or DEFAULT_MODEL).strip(),
        "aspect_ratio": str(source.get("aspect_ratio") or "1:1").strip(),
        "resolution": str(source.get("resolution") or "1K").strip(),
        "size": str(source.get("size") or "1024x1024").strip(),
        "quality": str(source.get("quality") or "auto").strip(),
        "output_format": str(source.get("output_format") or "png").strip(),
        "count": max(1, min(int(source.get("count") or 1), 20)),
        "concurrency": max(1, min(int(source.get("concurrency") or 2), 6)),
        "retry_limit": max(0, min(int(payload.get("retry_limit") or source.get("retry_limit") or 2), 5)),
        "seed": str(source.get("seed") or "").strip(),
        "variants": [str(v).strip() for v in source.get("variants", []) if str(v).strip()],
        "reference_ids": [str(v).strip() for v in source.get("reference_ids", []) if str(v).strip()][:4],
        "edit_mode": bool(source.get("edit_mode")),
        "retry_of": job_id,
        "retry_count": retry_count,
        "status": "queued",
        "progress": {"done": 0, "total": max(1, min(int(source.get("count") or 1), 20)), "message": "重试排队中"},
        "media_ids": [],
        "error": "",
        "created_at": now_ts(),
        "updated_at": now_ts(),
    }
    if not job["prompt"]:
        return jsonify({"error": "原任务提示词为空，无法重试"}), 400
    with state_lock:
        jobs = read_jobs()
        jobs.append(job)
        write_jobs(jobs)
    job_queue.put(job["id"])
    return jsonify({"job": job})


@app.post("/api/subjects")
def save_subject():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "主体名称不能为空"}), 400
    subject_id = str(payload.get("id") or "").strip() or uuid.uuid4().hex
    attrs = payload.get("attributes") or []
    subject = {
        "id": subject_id,
        "name": name,
        "category": str(payload.get("category") or "").strip(),
        "description": str(payload.get("description") or "").strip(),
        "attributes": [
            {"key": str(a.get("key") or "").strip(), "value": str(a.get("value") or "").strip()}
            for a in attrs if isinstance(a, dict) and (a.get("key") or a.get("value"))
        ],
        "updated_at": now_ts(),
    }
    with state_lock:
        subjects = [s for s in read_subjects() if s.get("id") != subject_id]
        subjects.append(subject)
        write_subjects(subjects)
    return jsonify({"subject": subject})


@app.delete("/api/subjects/<subject_id>")
def delete_subject(subject_id):
    auth = login_required_json()
    if auth:
        return auth
    with state_lock:
        write_subjects([s for s in read_subjects() if s.get("id") != subject_id])
    return jsonify({"ok": True})


@app.post("/api/references")
def upload_reference():
    auth = login_required_json()
    if auth:
        return auth
    if "file" not in request.files:
        return jsonify({"error": "没有上传文件"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "文件名为空"}), 400
    ref_id = uuid.uuid4().hex
    original = secure_filename(file.filename) or "reference.png"
    ext = Path(original).suffix.lower() or ".png"
    filename = f"{ref_id}{ext}"
    ensure_data_dir()
    path = REFERENCE_DIR / filename
    file.save(path)
    width, height = image_dimensions(path)
    item = {
        "id": ref_id,
        "client_id": current_client_id(),
        "name": request.form.get("name") or original,
        "url": f"/references/{filename}",
        "mime": file.mimetype or mimetypes.guess_type(filename)[0] or "image/png",
        "size": path.stat().st_size if path.exists() else 0,
        "width": width,
        "height": height,
        "created_at": now_ts(),
    }
    refs = read_references()
    refs.append(item)
    write_references(refs)
    return jsonify({"reference": item})


@app.get("/references/<path:filename>")
def reference_file(filename):
    return send_from_directory(REFERENCE_DIR, filename)


@app.post("/api/media/clear")
def clear_media():
    auth = login_required_json()
    if auth:
        return auth
    client_id = current_client_id()
    job_ids = {str(job.get("id") or "") for job in client_jobs(client_id)}
    with state_lock:
        write_media([
            item for item in read_media()
            if str(item.get("client_id") or "") != client_id and str(item.get("job_id") or "") not in job_ids
        ])
        write_jobs([job for job in read_jobs() if not matches_client(job, client_id)])
        write_references([item for item in read_references() if not matches_client(item, client_id)])
    return jsonify({"ok": True})


@app.post("/api/media/clear-failed")
def clear_failed_media():
    auth = login_required_json()
    if auth:
        return auth
    client_id = current_client_id()
    with state_lock:
        write_jobs([job for job in read_jobs() if not (matches_client(job, client_id) and job.get("status") == "error")])
    return jsonify({"ok": True})


@app.post("/api/media/delete")
def delete_media_items():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    media_ids = {str(item) for item in payload.get("media_ids", [])}
    job_ids = {str(item) for item in payload.get("job_ids", [])}
    client_id = current_client_id()
    allowed_job_ids = {str(job.get("id") or "") for job in client_jobs(client_id)}
    allowed_media_ids = {str(item.get("id") or "") for item in client_media(client_id)}
    job_ids = job_ids & allowed_job_ids
    media_ids = media_ids & allowed_media_ids
    with state_lock:
        write_media([item for item in read_media() if item.get("id") not in media_ids and item.get("job_id") not in job_ids])
        write_jobs([job for job in read_jobs() if job.get("id") not in job_ids])
    return jsonify({"ok": True})


@app.template_filter("ctime")
def ctime_filter(value):
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(int(value)))
    except (TypeError, ValueError):
        return ""
