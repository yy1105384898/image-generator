import base64
import json
import mimetypes
import os
import queue
import struct
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin

import requests
from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from werkzeug.utils import secure_filename

try:
    from curl_cffi import requests as browser_requests
except ImportError:  # pragma: no cover - fallback for lightweight local runs
    browser_requests = None


APP_USERNAME = os.getenv("APP_USERNAME", "root")
APP_PASSWORD = os.getenv("APP_PASSWORD", "root")
NEW_API_BASE = os.getenv("NEW_API_BASE", "http://127.0.0.1:3004").rstrip("/")
NEW_API_TOKEN = os.getenv("NEW_API_TOKEN", "")
CONNECTION_ENDPOINTS = {
    "local": "http://192.168.10.5:3004/v1",
    "proxy": "http://60.205.243.114:3004/v1",
    "direct": "https://yynewapi.yangyangnj.xin/v1",
}
AUTO_CONNECTION_ORDER = ("local", "proxy", "direct")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-image-2")
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
        "default_connection_mode": "proxy",
        "auto_order": ["local", "proxy", "direct"],
        "connections": {
            "local": {
                "label": "本地接入",
                "badge": "NAS",
                "url": CONNECTION_ENDPOINTS["local"],
                "description": "优先访问家里 NAS 的 New API，内网可达时延迟最低。",
                "enabled": True,
            },
            "proxy": {
                "label": "中转代理",
                "badge": "最稳",
                "url": CONNECTION_ENDPOINTS["proxy"],
                "description": "经阿里云固定入口转发到上游，适合外网和移动网络使用。",
                "enabled": True,
            },
            "direct": {
                "label": "浏览器直连",
                "badge": "少一跳",
                "url": CONNECTION_ENDPOINTS["direct"],
                "description": "直接访问公网域名，适合支持跨域和证书正常的线路。",
                "enabled": True,
            },
            "auto": {
                "label": "自动",
                "badge": "兜底",
                "url": "",
                "description": "按本地接入、中转代理、浏览器直连依次尝试，哪个能连上就用哪个。",
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
    auto_order = raw.get("auto_order")
    if isinstance(auto_order, list):
        base["auto_order"] = [item for item in auto_order if item in ("local", "proxy", "direct")] or base["auto_order"]
    default_mode = str(raw.get("default_connection_mode") or base["default_connection_mode"]).strip()
    if default_mode in base["connections"]:
        base["default_connection_mode"] = default_mode
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


def connection_endpoints() -> dict[str, str]:
    config = read_model_config()
    return {
        key: str(value.get("url") or CONNECTION_ENDPOINTS.get(key, "")).strip()
        for key, value in config["connections"].items()
        if key != "auto" and value.get("enabled", True)
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
        "status": str(item.get("status") or "正常").strip(),
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
    return {
        "sub2api": {
            "name": str(raw.get("sub2api", {}).get("name") or "本地 sub2api").strip(),
            "base_url": str(raw.get("sub2api", {}).get("base_url") or "").strip(),
            "username": str(raw.get("sub2api", {}).get("username") or "").strip(),
            "password": str(raw.get("sub2api", {}).get("password") or "").strip(),
            "api_key": str(raw.get("sub2api", {}).get("api_key") or "").strip(),
            "group_id": str(raw.get("sub2api", {}).get("group_id") or "").strip(),
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


def sub2api_headers(conf: dict) -> dict[str, str]:
    api_key = str(conf.get("api_key") or "").strip()
    if api_key:
        return {"x-api-key": api_key, "Accept": "application/json"}
    email = str(conf.get("username") or "").strip()
    password = str(conf.get("password") or "").strip()
    base_url = str(conf.get("base_url") or "").strip().rstrip("/")
    if not base_url or not email or not password:
        raise RuntimeError("请先填写 Sub2API 地址和管理员账号密码，或填写 Admin API Key")
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


def sync_sub2api_accounts(conf: dict) -> list[dict]:
    base_url = str(conf.get("base_url") or "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("请先填写 Sub2API 地址")
    headers = sub2api_headers(conf)
    group_id = str(conf.get("group_id") or "").strip()
    synced = []
    page = 1
    while True:
        params = {"platform": "openai", "type": "oauth", "page": page, "page_size": 200}
        if group_id:
            params["group"] = group_id
        resp = requests.get(f"{base_url}/api/v1/admin/accounts", headers=headers, params=params, timeout=30)
        if not resp.ok:
            raise RuntimeError(f"读取 Sub2API 账号失败：HTTP {resp.status_code} {resp.text[:160]}")
        items, total = paged_items(resp.json())
        if not items:
            break
        for item in items:
            if not isinstance(item, dict):
                continue
            token = extract_access_token_from_remote(item)
            detail = item
            account_id = str(item.get("id") or "").strip()
            if not token and account_id:
                detail_resp = requests.get(f"{base_url}/api/v1/admin/accounts/{account_id}", headers=headers, timeout=30)
                if detail_resp.ok:
                    detail_body = unwrap_remote_payload(detail_resp.json())
                    detail = detail_body if isinstance(detail_body, dict) else item
                    token = extract_access_token_from_remote(detail)
            if not token:
                continue
            credentials = detail.get("credentials") if isinstance(detail.get("credentials"), dict) else {}
            account = normalize_account({
                "access_token": token,
                "email": credentials.get("email") or detail.get("email") or detail.get("name"),
                "type": credentials.get("plan_type") or detail.get("type") or "openai-oauth",
                "status": "正常" if str(detail.get("status") or "").lower() not in {"disabled", "error"} else "异常",
                "source": "sub2api",
                "note": f"Sub2API: {conf.get('name') or base_url}",
            })
            if account:
                synced.append(account)
        if page * 200 >= total or len(items) < 200:
            break
        page += 1
    return synced


def sync_cpa_accounts(conf: dict) -> list[dict]:
    base_url = str(conf.get("base_url") or "").strip().rstrip("/")
    secret_key = str(conf.get("secret_key") or "").strip()
    if not base_url or not secret_key:
        raise RuntimeError("请先填写 CPA 地址和 Secret Key")
    headers = {"Authorization": f"Bearer {secret_key}", "Accept": "application/json"}
    resp = requests.get(f"{base_url}/v0/management/auth-files", headers=headers, timeout=30)
    if not resp.ok:
        raise RuntimeError(f"读取 CPA 文件失败：HTTP {resp.status_code} {resp.text[:160]}")
    files, _ = paged_items(resp.json())
    synced = []
    for item in files:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        detail_resp = requests.get(
            f"{base_url}/v0/management/auth-files/download",
            headers=headers,
            params={"name": name},
            timeout=30,
        )
        if not detail_resp.ok:
            continue
        payload = detail_resp.json()
        token = extract_access_token_from_remote(payload)
        if not token:
            continue
        account = normalize_account({
            "access_token": token,
            "email": payload.get("email") or item.get("email") or item.get("account"),
            "type": payload.get("plan_type") or "openai-oauth",
            "source": "cpa",
            "status": "正常",
            "note": f"CPA: {name}",
        })
        if account:
            synced.append(account)
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
    mode = (connection_mode or "proxy").strip()
    endpoints = connection_endpoints()
    if mode == "auto":
        order = read_model_config().get("auto_order") or list(AUTO_CONNECTION_ORDER)
        return [endpoints[item] for item in order if endpoints.get(item)]
    return [api_url.strip() or endpoints.get(mode, NEW_API_BASE)]


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


def resolve_api_url(connection_mode: str, api_url: str, api_key: str) -> tuple[str, list[str]]:
    errors = []
    for candidate in candidate_api_urls(connection_mode, api_url):
        try:
            fetch_models(candidate, api_key)
            return candidate.rstrip("/"), errors
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    fallback = (api_url.strip() or connection_endpoints().get(connection_mode, NEW_API_BASE)).rstrip("/")
    return fallback, errors


def generate_one(job: dict, prompt: str, index: int) -> list[dict]:
    headers = {"Authorization": bearer_token(str(job.get("api_key") or ""))}
    api_base = job_api_base(job)
    reference_ids = job.get("reference_ids") or []
    references = [r for r in read_references() if r.get("id") in reference_ids]
    use_edit = job.get("edit_mode") and references
    if use_edit:
        files = []
        opened = []
        try:
            for ref in references[:4]:
                filename = str(ref.get("url") or "").split("/references/", 1)[-1]
                path = REFERENCE_DIR / filename
                if not path.exists():
                    continue
                fh = path.open("rb")
                opened.append(fh)
                files.append(("image[]", (path.name, fh, ref.get("mime") or "image/png")))
            data = {"model": job["model"], "prompt": prompt, "size": job["size"]}
            if job.get("quality") and job["quality"] != "auto":
                data["quality"] = job["quality"]
            resp = requests.post(
                urljoin(api_base + "/", "v1/images/edits"),
                headers=headers,
                data=data,
                files=files,
                timeout=REQUEST_TIMEOUT,
            )
        finally:
            for fh in opened:
                fh.close()
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
        for idx, prompt in enumerate(prompts):
            update_job(job_id, {"progress": {"done": idx, "total": len(prompts), "message": f"生成第 {idx + 1}/{len(prompts)} 张"}})
            created_media.extend(generate_one(job, prompt, idx))
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
    if request.method == "POST":
        action = request.form.get("action", "save_model_config")
        accounts = read_account_pool()
        if action == "save_admin_auth":
            username = request.form.get("admin_username", "").strip()
            password = request.form.get("admin_password", "").strip()
            write_admin_auth(username, password)
            session["user"] = username or "root"
            admin_log("修改管理员账号")
            message = "管理员账号密码已保存。"
            saved = True
        elif action == "save_model_config":
            current = read_model_config()
            connections = {}
            for key in ("local", "proxy", "direct", "auto"):
                existing = current["connections"].get(key, {})
                connections[key] = {
                    "label": request.form.get(f"{key}_label", existing.get("label", key)).strip(),
                    "badge": request.form.get(f"{key}_badge", existing.get("badge", "")).strip(),
                    "url": request.form.get(f"{key}_url", existing.get("url", "")).strip(),
                    "description": request.form.get(f"{key}_description", existing.get("description", "")).strip(),
                    "enabled": request.form.get(f"{key}_enabled") == "on" or key == "auto",
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
                "default_connection_mode": request.form.get("default_connection_mode", "proxy"),
                "auto_order": [item.strip() for item in request.form.get("auto_order", "local,proxy,direct").split(",")],
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
        elif action == "save_integrations":
            next_integrations = {
                "sub2api": {
                    "name": request.form.get("sub2api_name", ""),
                    "base_url": request.form.get("sub2api_base_url", ""),
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
        integrations=read_integration_config(),
        media_items=media_items,
        jobs=jobs[:80],
        logs=logs[:120],
    )


@app.get("/media/<path:filename>")
def media_file(filename):
    return send_from_directory(MEDIA_DIR, filename)


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "models": available_model_ids(), "new_api_base": NEW_API_BASE, "model_config": read_model_config()})


@app.get("/api/state")
def state():
    auth = login_required_json()
    if auth:
        return auth
    return jsonify({
        "jobs": sorted(read_jobs(), key=lambda x: x.get("created_at", 0), reverse=True),
        "media": sorted(read_media(), key=lambda x: x.get("created_at", 0), reverse=True),
        "subjects": sorted(read_subjects(), key=lambda x: x.get("updated_at", 0), reverse=True),
        "references": sorted(read_references(), key=lambda x: x.get("created_at", 0), reverse=True),
        "presets": read_presets(),
        "models": available_model_ids(),
        "default_model": DEFAULT_MODEL,
        "model_config": read_model_config(),
    })


@app.post("/api/models")
def models():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    api_key = str(payload.get("api_key") or "").strip()
    connection_mode = str(payload.get("connection_mode") or "proxy").strip()
    api_url = str(payload.get("api_url") or "").strip()
    errors = []
    for candidate in candidate_api_urls(connection_mode, api_url):
        try:
            model_list = fetch_models(candidate, api_key)
            return jsonify({"ok": True, "models": model_list, "api_url": candidate.rstrip("/")})
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    return jsonify({"error": "模型读取失败", "detail": " | ".join(errors)}), 502


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
    if not (api_key or NEW_API_TOKEN):
        return jsonify({"error": "请先填写 API Key"}), 400
    mode = str(payload.get("mode") or "single")
    count = max(1, min(int(payload.get("count") or 1), 20))
    connection_mode = str(payload.get("connection_mode") or "proxy").strip()
    api_url = str(payload.get("api_url") or "").strip()
    resolved_api_url, resolve_errors = resolve_api_url(connection_mode, api_url, api_key)
    job = {
        "id": uuid.uuid4().hex,
        "mode": mode,
        "protocol": str(payload.get("protocol") or "custom-openai").strip(),
        "connection_mode": connection_mode,
        "api_url": api_url.rstrip("/") if api_url else resolved_api_url,
        "resolved_api_url": resolved_api_url,
        "api_key": api_key,
        "connection_errors": resolve_errors,
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
    write_media([])
    write_jobs([])
    return jsonify({"ok": True})


@app.post("/api/media/clear-failed")
def clear_failed_media():
    auth = login_required_json()
    if auth:
        return auth
    with state_lock:
        write_jobs([job for job in read_jobs() if job.get("status") != "error"])
    return jsonify({"ok": True})


@app.post("/api/media/delete")
def delete_media_items():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    media_ids = {str(item) for item in payload.get("media_ids", [])}
    job_ids = {str(item) for item in payload.get("job_ids", [])}
    with state_lock:
        write_media([item for item in read_media() if item.get("id") not in media_ids])
        write_jobs([job for job in read_jobs() if job.get("id") not in job_ids])
    return jsonify({"ok": True})


@app.template_filter("ctime")
def ctime_filter(value):
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(int(value)))
    except (TypeError, ValueError):
        return ""
