import base64
import hashlib
import ipaddress
import json
import math
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
from PIL import Image, ImageOps
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

try:
    from curl_cffi import requests as browser_requests
except ImportError:  # pragma: no cover - fallback for lightweight local runs
    browser_requests = None


APP_USERNAME = os.getenv("APP_USERNAME", "root")
APP_PASSWORD = os.getenv("APP_PASSWORD", "root")
DEFAULT_CUSTOM_API_URL = os.getenv("DEFAULT_CUSTOM_API_URL", "").rstrip("/")
NEW_API_BASE = os.getenv("NEW_API_BASE", DEFAULT_CUSTOM_API_URL).rstrip("/")
NEW_API_TOKEN = os.getenv("NEW_API_TOKEN", "")


DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-image-2")
DEFAULT_TEXT_MODEL = os.getenv("AGENT_TEXT_MODEL", "gpt-4.1-mini")
AVAILABLE_MODELS = [m.strip() for m in os.getenv("AVAILABLE_MODELS", DEFAULT_MODEL).split(",") if m.strip()]
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "200"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "600"))
AGENT_TEXT_TIMEOUT = int(os.getenv("AGENT_TEXT_TIMEOUT", "180"))
AGENT_TEXT_RETRIES = int(os.getenv("AGENT_TEXT_RETRIES", "0"))
VALID_WORKSPACES = {"studio", "commerce", "research"}
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
MEDIA_DIR = DATA_DIR / "media"
THUMB_DIR = DATA_DIR / "thumbs"
REFERENCE_DIR = DATA_DIR / "references"
JOBS_FILE = DATA_DIR / "jobs.json"
MEDIA_FILE = DATA_DIR / "media.json"
SQUARE_FILE = DATA_DIR / "square.json"
SUBJECTS_FILE = DATA_DIR / "subjects.json"
PRESETS_FILE = DATA_DIR / "presets.json"
REFERENCES_FILE = DATA_DIR / "references.json"
MODEL_CONFIG_FILE = DATA_DIR / "model_config.json"
ACCOUNT_POOL_FILE = DATA_DIR / "account_pool.json"
POOL_USERS_FILE = DATA_DIR / "pool_users.json"
INTEGRATION_CONFIG_FILE = DATA_DIR / "integration_config.json"
ADMIN_LOGS_FILE = DATA_DIR / "admin_logs.json"
ADMIN_AUTH_FILE = DATA_DIR / "admin_auth.json"
ADMIN_SETTINGS_FILE = DATA_DIR / "admin_settings.json"

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret")


def asset_version(filename: str) -> str:
    try:
        path = Path(app.static_folder or "") / filename
        return str(int(path.stat().st_mtime))
    except OSError:
        return str(int(time.time()))


@app.context_processor
def inject_asset_helpers():
    return {"asset_version": asset_version}


@app.after_request
def add_static_cache_headers(response):
    if request.path.startswith(f"{app.static_url_path}/"):
        response.headers["Cache-Control"] = "no-cache"
    elif request.path.startswith("/media/") or request.path.startswith("/thumbs/"):
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return response


state_lock = threading.RLock()
job_queue: "queue.Queue[str]" = queue.Queue()
worker_started = False


def now_ts() -> int:
    return int(time.time())


def clean_workspace(value: str | None) -> str:
    workspace = str(value or "").strip().lower()
    return workspace if workspace in VALID_WORKSPACES else ""


def normalize_workspace(value: str | None) -> str:
    return clean_workspace(value) or "studio"


def job_workspace(job: dict | None) -> str:
    item = job or {}
    explicit = clean_workspace(item.get("workspace"))
    if explicit:
        return explicit
    agent_id = str(item.get("agent_id") or "")
    agent_name = str(item.get("agent_name") or "")
    title = str(item.get("title") or "")
    if agent_id == "research-workbench" or "科研图" in agent_name:
        return "research"
    if "简洁生图台" in title:
        return "commerce"
    return "studio"


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
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
                "url": DEFAULT_CUSTOM_API_URL,
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
        "model_providers": [
            {
                "id": "openai-image",
                "name": "OpenAI 生图",
                "kind": "image",
                "patterns": "gpt-image,dall-e,dalle",
                "enabled": True,
            },
            {
                "id": "google-imagen",
                "name": "Google Imagen",
                "kind": "image",
                "patterns": "imagen",
                "enabled": True,
            },
            {
                "id": "banana-image",
                "name": "Nano Banana",
                "kind": "image",
                "patterns": "banana",
                "enabled": True,
            },
            {
                "id": "flux-stable-image",
                "name": "Flux / Stable",
                "kind": "image",
                "patterns": "flux,stable,stability,sdxl",
                "enabled": True,
            },
            {
                "id": "common-text",
                "name": "常用文本模型",
                "kind": "text",
                "patterns": "gpt,gpt-,gpt4,gpt5,gpt5-,o3,o4,o5,chat,claude,deepseek,qwen,glm,moonshot,kimi,yi-,llama,mistral,gemini,mimo",
                "enabled": True,
            },
        ],
        "agent_text": {
            "default_model": DEFAULT_TEXT_MODEL,
            "reuse_custom_api": True,
            "reuse_custom_key": True,
        },
        "custom_model_routes": {
            "image": {
                "label": "生图模型接入",
                "url": DEFAULT_CUSTOM_API_URL,
                "api_key": "",
                "api_keys": [],
                "enabled": False,
            },
            "text": {
                "label": "文本模型接入",
                "url": DEFAULT_CUSTOM_API_URL,
                "api_key": "",
                "api_keys": [],
                "enabled": False,
            },
        },
        "debug": {
            "workbench_custom_api": False,
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
        if key == "custom":
            merged["url"] = str(merged.get("url") or DEFAULT_CUSTOM_API_URL).strip()
            merged["api_key"] = str(merged.get("api_key") or "").strip()
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
    providers = raw.get("model_providers")
    if isinstance(providers, list):
        cleaned_providers = []
        for item in providers:
            if not isinstance(item, dict):
                continue
            provider_id = str(item.get("id") or "").strip() or re.sub(r"[^a-z0-9]+", "-", str(item.get("name") or "").lower()).strip("-")
            name = str(item.get("name") or provider_id).strip()
            kind = str(item.get("kind") or "image").strip().lower()
            if kind not in {"image", "text", "both"}:
                kind = "image"
            patterns = str(item.get("patterns") or "").strip()
            if not provider_id or not name or not patterns:
                continue
            if provider_id == "common-text":
                existing_patterns = provider_patterns({"patterns": patterns})
                for token in ("gpt", "gpt-", "gpt5", "gpt5-", "mimo"):
                    if token not in existing_patterns:
                        existing_patterns.append(token)
                patterns = ",".join(existing_patterns)
            cleaned_providers.append({
                "id": provider_id[:80],
                "name": name[:80],
                "kind": kind,
                "patterns": patterns[:500],
                "enabled": bool(item.get("enabled", True)),
            })
        base["model_providers"] = cleaned_providers
    base["auto_order"] = []
    agent_text = raw.get("agent_text") if isinstance(raw.get("agent_text"), dict) else {}
    base["agent_text"] = {
        **base["agent_text"],
        "default_model": str(agent_text.get("default_model") or base["agent_text"]["default_model"]).strip(),
        "reuse_custom_api": bool(agent_text.get("reuse_custom_api", True)),
        "reuse_custom_key": bool(agent_text.get("reuse_custom_key", True)),
    }
    raw_routes = raw.get("custom_model_routes") if isinstance(raw.get("custom_model_routes"), dict) else {}
    legacy_custom = connections.get("custom", {})
    for kind in ("image", "text"):
        route_raw = raw_routes.get(kind) if isinstance(raw_routes.get(kind), dict) else {}
        route = {**base["custom_model_routes"][kind], **route_raw}
        route["label"] = str(route.get("label") or base["custom_model_routes"][kind]["label"]).strip()
        route["url"] = str(route.get("url") or DEFAULT_CUSTOM_API_URL).strip()
        keys = []
        for value in route.get("api_keys") or []:
            value = str(value or "").strip()
            if value:
                keys.append(value)
        legacy_key = str(route.get("api_key") or "").strip()
        if legacy_key and legacy_key not in keys:
            keys.insert(0, legacy_key)
        route["api_keys"] = keys
        route["api_key"] = keys[0] if keys else ""
        route["enabled"] = bool(route.get("enabled", False))
        base["custom_model_routes"][kind] = route
    if legacy_custom.get("url") or legacy_custom.get("api_key"):
        image_route = base["custom_model_routes"]["image"]
        if not image_route.get("url"):
            image_route["url"] = str(legacy_custom.get("url") or "").strip()
        if not image_route.get("api_key"):
            image_route["api_key"] = str(legacy_custom.get("api_key") or "").strip()
        if image_route.get("api_key") and image_route.get("api_key") not in image_route.get("api_keys", []):
            image_route["api_keys"] = [image_route["api_key"], *image_route.get("api_keys", [])]
        if not raw_routes.get("image"):
            image_route["enabled"] = True
    debug = raw.get("debug") if isinstance(raw.get("debug"), dict) else {}
    base["debug"] = {
        **base["debug"],
        "workbench_custom_api": bool(debug.get("workbench_custom_api", False)),
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


def parse_secret_lines(value: str) -> list[str]:
    keys = []
    for line in str(value or "").splitlines():
        key = line.strip()
        if key and key not in keys:
            keys.append(key)
    return keys


def merge_route_secrets(current_routes: dict, kind: str, posted: str, keep_existing: bool) -> list[str]:
    current = current_routes.get(kind) if isinstance(current_routes.get(kind), dict) else {}
    posted_keys = parse_secret_lines(posted)
    current_keys = [str(key or "").strip() for key in current.get("api_keys", []) if str(key or "").strip()]
    delete_indexes = set()
    if hasattr(request, "form"):
        for value in request.form.getlist(f"{kind}_route_delete_key"):
            try:
                delete_indexes.add(int(value))
            except (TypeError, ValueError):
                continue
    kept_keys = [key for index, key in enumerate(current_keys) if index not in delete_indexes]
    if keep_existing:
        merged = kept_keys[:]
        for key in posted_keys:
            if key not in merged:
                merged.append(key)
        return merged
    return posted_keys


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


def account_ids_to_tokens(accounts: list[dict], ids: list[str]) -> list[str]:
    wanted = {str(item or "").strip() for item in ids if str(item or "").strip()}
    return [str(item.get("access_token") or "") for item in accounts if str(item.get("id") or "") in wanted and item.get("access_token")]


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


def custom_api_debug_enabled(config: dict | None = None) -> bool:
    config = config or read_model_config()
    return bool((config.get("debug") or {}).get("workbench_custom_api"))


def custom_model_route(config: dict | None, kind: str, allow_fallback: bool = True, include_legacy: bool = True) -> dict:
    config = config or read_model_config()
    routes = config.get("custom_model_routes") or {}
    route = routes.get(kind) if isinstance(routes.get(kind), dict) else {}
    if route.get("enabled") and (route.get("url") or route.get("api_key")):
        return route
    if allow_fallback:
        fallback_kind = "text" if kind == "image" else "image"
        fallback = routes.get(fallback_kind) if isinstance(routes.get(fallback_kind), dict) else {}
        if fallback.get("enabled") and (fallback.get("url") or fallback.get("api_key")):
            return fallback
    if not include_legacy:
        return {
            "label": "自定义 API",
            "url": "",
            "api_key": "",
            "api_keys": [],
            "enabled": False,
        }
    custom = (config.get("connections") or {}).get("custom") or {}
    return {
        "label": custom.get("label") or "自定义 API",
        "url": custom.get("url") or "",
        "api_key": custom.get("api_key") or "",
        "api_keys": [custom.get("api_key")] if custom.get("api_key") else [],
        "enabled": True,
    }


def custom_model_route_credentials(
    config: dict | None = None,
    kind: str = "image",
    index: int = 0,
    include_legacy: bool = True,
) -> tuple[str, str, str]:
    route = custom_model_route(config, kind, allow_fallback=True, include_legacy=include_legacy)
    route_kind = "custom"
    routes = (config or read_model_config()).get("custom_model_routes") or {}
    for candidate in ("image", "text"):
        if route is routes.get(candidate):
            route_kind = candidate
            break
    keys = [str(key or "").strip() for key in route.get("api_keys", []) if str(key or "").strip()]
    if not keys and route.get("api_key"):
        keys = [str(route.get("api_key") or "").strip()]
    api_key = keys[index % len(keys)] if keys else ""
    return str(route.get("url") or "").strip(), api_key, route_kind


def custom_model_route_key_pool(
    config: dict | None = None,
    kind: str = "image",
    include_legacy: bool = True,
) -> tuple[str, list[str], str]:
    route = custom_model_route(config, kind, allow_fallback=True, include_legacy=include_legacy)
    route_kind = "custom"
    routes = (config or read_model_config()).get("custom_model_routes") or {}
    for candidate in ("image", "text"):
        if route is routes.get(candidate):
            route_kind = candidate
            break
    keys = [str(key or "").strip() for key in route.get("api_keys", []) if str(key or "").strip()]
    if not keys and route.get("api_key"):
        keys = [str(route.get("api_key") or "").strip()]
    return str(route.get("url") or "").strip(), keys, route_kind


def admin_custom_api_credentials(config: dict | None = None) -> tuple[str, str]:
    config = config or read_model_config()
    api_url, api_key, _ = custom_model_route_credentials(config, "image")
    return api_url, api_key


def public_model_config(config: dict | None = None, include_admin_debug: bool = True) -> dict:
    public = json.loads(json.dumps(config or read_model_config(), ensure_ascii=False))
    public["default_custom_api_url"] = DEFAULT_CUSTOM_API_URL
    debug = public.get("debug") if isinstance(public.get("debug"), dict) else {}
    debug_enabled = bool(debug.get("workbench_custom_api"))
    public["debug"] = {"workbench_custom_api": debug_enabled}
    custom = ((public.get("connections") or {}).get("custom") or {})
    raw_key = str(custom.pop("api_key", "") or "").strip()
    custom["api_key_configured"] = bool(debug_enabled and raw_key)
    if not debug_enabled:
        custom["url"] = custom.get("url") or DEFAULT_CUSTOM_API_URL
    routes = public.get("custom_model_routes") if isinstance(public.get("custom_model_routes"), dict) else {}
    for route in routes.values():
        if not isinstance(route, dict):
            continue
        raw_route_key = str(route.pop("api_key", "") or "").strip()
        route.pop("api_keys", None)
        route["api_key_configured"] = bool(debug_enabled and raw_route_key)
        if not debug_enabled:
            route["url"] = DEFAULT_CUSTOM_API_URL
            route["enabled"] = False
    return public


def public_admin_auth(auth: dict | None = None) -> dict:
    auth = auth or read_admin_auth()
    return {"username": auth.get("username", ""), "password_mask": mask_secret(str(auth.get("password") or ""))}


def integration_secret_masks(integrations: dict | None = None) -> dict:
    integrations = integrations or read_integration_config()
    return {
        "sub2api_password": mask_secret(((integrations.get("sub2api") or {}).get("password") or "")),
        "sub2api_api_key": mask_secret(((integrations.get("sub2api") or {}).get("api_key") or "")),
        "cpa_secret_key": mask_secret(((integrations.get("cpa") or {}).get("secret_key") or "")),
    }


def merge_secret_field(current: str, posted: str) -> str:
    posted = str(posted or "").strip()
    return posted if posted else str(current or "").strip()


def resolve_custom_api_credentials(api_url: str, api_key: str, kind: str = "image") -> tuple[str, str, bool, str]:
    config = read_model_config()
    debug_enabled = custom_api_debug_enabled(config)
    admin_url, admin_key, route_kind = custom_model_route_credentials(config, kind, include_legacy=debug_enabled)
    resolved_url = str(api_url or "").strip()
    if debug_enabled and not resolved_url:
        resolved_url = admin_url
    resolved_key = str(api_key or "").strip()
    used_debug_key = False
    if debug_enabled and not resolved_key and admin_key:
        resolved_key = admin_key
        used_debug_key = True
    return resolved_url, resolved_key, used_debug_key, route_kind


def available_model_ids() -> list[str]:
    ids = [str(item.get("id") or "").strip() for item in read_model_config().get("model_profiles", [])]
    ids = [item for item in ids if item]
    return [item for item in ids if model_allowed_by_kind(item)] or AVAILABLE_MODELS or [DEFAULT_MODEL]


def provider_patterns(provider: dict) -> list[str]:
    raw = str(provider.get("patterns") or "")
    return [item.strip().lower() for item in re.split(r"[\n,，;；]+", raw) if item.strip()]


def provider_matches_model(provider: dict, model: str, kind: str) -> bool:
    provider_kind = str(provider.get("kind") or "image").strip().lower()
    if provider_kind not in {"both", kind}:
        return False
    value = str(model or "").lower()
    return any(fnmatch_model(pattern, value) for pattern in provider_patterns(provider))


def fnmatch_model(pattern: str, value: str) -> bool:
    if not pattern:
        return False
    if "*" in pattern:
        regex = "^" + re.escape(pattern).replace("\\*", ".*") + "$"
        return re.search(regex, value) is not None
    return pattern in value


def model_allowed_by_providers(model: str, kind: str, config: dict | None = None) -> bool:
    config = config or read_model_config()
    providers = [item for item in config.get("model_providers", []) if isinstance(item, dict)]
    relevant = [item for item in providers if str(item.get("kind") or "image").strip().lower() in {"both", kind}]
    if not relevant:
        return True
    enabled = [item for item in relevant if item.get("enabled")]
    if not enabled:
        return False
    return any(provider_matches_model(provider, model, kind) for provider in enabled)


def is_raw_text_model_id(model: str) -> bool:
    value = str(model or "").lower()
    if not value or is_raw_image_model_id(value):
        return False
    return any(token in value for token in (
        "gpt-",
        "gpt",
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
        "mimo",
    ))


def model_allowed_by_kind(model: str) -> bool:
    if is_raw_image_model_id(model):
        return model_allowed_by_providers(model, "image")
    if is_raw_text_model_id(model):
        return model_allowed_by_providers(model, "text")
    return True


def mask_secret(value: str, left: int = 8, right: int = 4) -> str:
    value = str(value or "").strip()
    if len(value) <= left + right:
        return value[:2] + "***" if value else ""
    return f"{value[:left]}...{value[-right:]}"


def mask_secret_list(values: list[str]) -> list[str]:
    return [mask_secret(value) for value in values if str(value or "").strip()]


SECRET_PATTERNS = [
    re.compile(r"Bearer\s+[A-Za-z0-9._\-+/=]+", re.IGNORECASE),
    re.compile(r"sk-[A-Za-z0-9._\-]{8,}"),
    re.compile(r"(access[_-]?token[\"'\s:=]+)[A-Za-z0-9._\-+/=]{8,}", re.IGNORECASE),
    re.compile(r"(refresh[_-]?token[\"'\s:=]+)[A-Za-z0-9._\-+/=]{8,}", re.IGNORECASE),
    re.compile(r"(api[_-]?key[\"'\s:=]+)[A-Za-z0-9._\-]{8,}", re.IGNORECASE),
]


def redact_secrets(value):
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            if str(key).lower() in {"api_key", "access_token", "refresh_token", "token", "secret_key", "password"}:
                redacted[key] = mask_secret(str(item))
            else:
                redacted[key] = redact_secrets(item)
        return redacted
    if isinstance(value, list):
        return [redact_secrets(item) for item in value]
    text = str(value)
    for pattern in SECRET_PATTERNS:
        text = pattern.sub(lambda m: (m.group(1) if m.lastindex else "") + "[redacted]", text)
    return text


def normalize_admin_log_retention_days(value) -> int:
    try:
        days = int(value)
    except (TypeError, ValueError):
        days = 30
    return max(0, min(days, 3650))


def clean_admin_logs(logs: list[dict], retention_days=None, max_items: int = 300) -> list[dict]:
    days = normalize_admin_log_retention_days(retention_days)
    cutoff = now_ts() - days * 86400 if days else 0
    cleaned = []
    for item in logs if isinstance(logs, list) else []:
        if not isinstance(item, dict):
            continue
        created_at = int(item.get("created_at") or 0)
        if cutoff and created_at and created_at < cutoff:
            continue
        cleaned.append(item)
    cleaned.sort(key=lambda item: int(item.get("created_at") or 0))
    return cleaned[-max_items:]


def admin_log(action: str, detail: dict | None = None) -> None:
    logs = read_json(ADMIN_LOGS_FILE, [])
    logs.append({"id": uuid.uuid4().hex, "action": action, "detail": redact_secrets(detail or {}), "created_at": now_ts()})
    write_json(ADMIN_LOGS_FILE, clean_admin_logs(logs, read_admin_settings().get("admin_log_retention_days")))


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
                item["last_error"] = redact_secrets(str(error or "生成失败"))[:500]
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
    raise RuntimeError(redact_secrets(f"{context} failed: HTTP {resp.status_code} {str(body)[:500]}"))


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


def build_pool_image_prompt(prompt: str, ratio: str, resolution: str = "", quality: str = "", size: str = "") -> str:
    ratio = str(ratio or "").strip()
    resolution = str(resolution or "").strip()
    quality = str(quality or "").strip()
    size = str(size or "").strip()
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
    quality_hints = {
        "standard": "质量使用 standard 标准质量，优先速度和稳定性。",
        "high": "质量使用 high 高质量，强化细节、材质和边缘清晰度。",
        "hd": "质量使用 hd 高清质量，强化细节、真实光影和可交付质感。",
    }
    extras = [
        hints.get(ratio),
        f"目标分辨率档位：{resolution}；请求尺寸参考：{size}。" if resolution or size else "",
        quality_hints.get(quality.lower(), ""),
    ]
    extras = [item for item in extras if item]
    return "\n\n".join([prompt.strip(), *extras]) if extras else prompt.strip()


GPT_IMAGE_2_MIN_PIXELS = 655_360
GPT_IMAGE_2_MAX_PIXELS = 8_294_400
GPT_IMAGE_2_MAX_EDGE = 3840
GPT_IMAGE_2_QUALITIES = {"auto", "low", "medium", "high"}


def is_gpt_image_2_model(model: str) -> bool:
    return str(model or "").strip().lower() in {"gpt-image-2", "codex-gpt-image-2"}


def parse_size(size: str) -> tuple[int, int] | None:
    match = re.match(r"^\s*(\d{2,5})\s*x\s*(\d{2,5})\s*$", str(size or ""), re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def round_multiple(value: float, multiple: int = 16) -> int:
    return max(multiple, int(round(float(value) / multiple)) * multiple)


def ceil_multiple(value: float, multiple: int = 16) -> int:
    return max(multiple, int(math.ceil(float(value) / multiple)) * multiple)


def floor_multiple(value: float, multiple: int = 16) -> int:
    return max(multiple, int(math.floor(float(value) / multiple)) * multiple)


def legalize_gpt_image_2_size(size: str, aspect_ratio: str = "1:1", resolution: str = "1K") -> str:
    ratio_match = re.match(r"^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$", str(aspect_ratio or "1:1"))
    if ratio_match:
        ratio_w, ratio_h = float(ratio_match.group(1)), float(ratio_match.group(2))
    else:
        parsed = parse_size(size)
        ratio_w, ratio_h = parsed if parsed else (1.0, 1.0)
    ratio_w = max(1.0, float(ratio_w))
    ratio_h = max(1.0, float(ratio_h))
    if max(ratio_w, ratio_h) / min(ratio_w, ratio_h) > 3:
        if ratio_w >= ratio_h:
            ratio_w = ratio_h * 3
        else:
            ratio_h = ratio_w * 3
    target_long_edge = {"1K": 1024, "2K": 2048, "4K": 3840}.get(str(resolution or "1K"), 1024)
    if ratio_w >= ratio_h:
        width = float(target_long_edge)
        height = width * ratio_h / ratio_w
    else:
        height = float(target_long_edge)
        width = height * ratio_w / ratio_h
    width = max(16, float(width))
    height = max(16, float(height))
    width = round_multiple(width)
    height = round_multiple(height)
    min_scale = max(1.0, (GPT_IMAGE_2_MIN_PIXELS / max(1, width * height)) ** 0.5)
    width = ceil_multiple(width * min_scale)
    height = ceil_multiple(height * min_scale)
    if max(width, height) > GPT_IMAGE_2_MAX_EDGE or width * height > GPT_IMAGE_2_MAX_PIXELS:
        scale = min(GPT_IMAGE_2_MAX_EDGE / max(width, height), (GPT_IMAGE_2_MAX_PIXELS / max(1, width * height)) ** 0.5)
        width = floor_multiple(width * scale)
        height = floor_multiple(height * scale)
    return f"{width}x{height}"


def normalize_image_request_options(job: dict, endpoint: str = "") -> tuple[dict, dict]:
    model = str(job.get("model") or DEFAULT_MODEL).strip()
    size = str(job.get("size") or "1024x1024").strip()
    quality = str(job.get("quality") or "auto").strip().lower()
    output_format = str(job.get("output_format") or "png").strip().lower()
    options: dict = {
        "model": model,
        "size": size,
        "quality": quality,
        "output_format": output_format,
    }
    note = ""
    if is_gpt_image_2_model(model):
        original_size = size
        size = legalize_gpt_image_2_size(size, job.get("aspect_ratio") or "1:1", job.get("resolution") or "1K")
        quality_map = {"standard": "medium", "hd": "high"}
        quality = quality_map.get(quality, quality)
        if quality not in GPT_IMAGE_2_QUALITIES:
            quality = "auto"
        output_format = output_format if output_format in {"png", "jpeg", "webp"} else "png"
        background = str(job.get("background") or "auto").strip().lower() or "auto"
        moderation = str(job.get("moderation") or "auto").strip().lower() or "auto"
        options.update({
            "size": size,
            "quality": quality,
            "output_format": output_format,
            "background": background if background in {"auto", "opaque"} else "auto",
            "moderation": moderation if moderation in {"auto", "low"} else "auto",
        })
        if output_format in {"jpeg", "webp"}:
            try:
                compression = int(job.get("output_compression") or 0)
            except (TypeError, ValueError):
                compression = 0
            if compression:
                options["output_compression"] = max(0, min(compression, 100))
        if size != original_size:
            note = f"gpt-image-2 size 已从 {original_size} 调整为合法尺寸 {size}"
    return options, {
        "model": model,
        "size": options.get("size", size),
        "quality": options.get("quality", quality),
        "output_format": options.get("output_format", output_format),
        "background": options.get("background", ""),
        "moderation": options.get("moderation", ""),
        "output_compression": options.get("output_compression", ""),
        "note": note,
        "endpoint": endpoint,
    }


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

    @staticmethod
    def text_model_slug(model: str) -> str:
        model = str(model or "").strip()
        if not model or model == DEFAULT_TEXT_MODEL:
            return "auto"
        return model

    def start_text_generation(self, model: str, messages: list[dict], requirements: dict):
        parts = []
        for message in messages:
            role = str(message.get("role") or "user").strip()
            content = str(message.get("content") or "")
            parts.append(f"{role}: {content}")
        prompt = "\n\n".join(parts)
        payload = {
            "action": "next",
            "messages": [{
                "id": str(uuid.uuid4()),
                "author": {"role": "user"},
                "create_time": time.time(),
                "content": {"content_type": "text", "parts": [prompt]},
                "metadata": {},
            }],
            "parent_message_id": str(uuid.uuid4()),
            "model": self.text_model_slug(model),
            "timezone_offset_min": -480,
            "timezone": "Asia/Shanghai",
            "conversation_mode": {"kind": "primary_assistant"},
            "enable_message_followups": False,
            "supports_buffering": True,
            "supported_encodings": ["v1"],
            "client_contextual_info": {"app_name": "chatgpt.com"},
        }
        path = "/backend-api/f/conversation"
        resp = self.session.post(
            self.base_url + path,
            headers=self.image_headers(path, requirements, "", "text/event-stream"),
            json=payload,
            timeout=AGENT_TEXT_TIMEOUT,
            stream=True,
        )
        ensure_response_ok(resp, "text conversation")
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

    def generate_agent_plan(self, model: str, payload: dict) -> dict:
        self.bootstrap()
        requirements = self.chat_requirements()
        resp = self.start_text_generation(model, build_agent_plan_messages(payload), requirements)
        content = ""
        try:
            for raw in iter_sse_payloads(resp):
                if raw == "[DONE]":
                    break
                try:
                    event = json.loads(raw)
                except Exception:
                    continue
                value = event.get("v") if isinstance(event, dict) else None
                candidates = [value, event]
                for candidate in candidates:
                    if not isinstance(candidate, dict):
                        continue
                    message = candidate.get("message")
                    if not isinstance(message, dict):
                        continue
                    if (message.get("author") or {}).get("role") != "assistant":
                        continue
                    parts = (message.get("content") or {}).get("parts") or []
                    text = "".join(str(part) for part in parts if isinstance(part, str)).strip()
                    if text:
                        content = text
        finally:
            resp.close()
        if not content:
            raise RuntimeError("号池文本模型没有返回内容")
        return normalize_agent_plan(extract_json_object(content), payload.get("values") if isinstance(payload.get("values"), dict) else {})

    def generate(self, prompt: str, model: str, ratio: str, references: list[dict], resolution: str = "", quality: str = "", size: str = "") -> list[dict]:
        final_prompt = build_pool_image_prompt(prompt, ratio, resolution, quality, size)
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
        data = client.generate(
            prompt,
            job.get("model") or DEFAULT_MODEL,
            job.get("aspect_ratio") or "1:1",
            references,
            job.get("resolution") or "1K",
            job.get("quality") or "auto",
            job.get("size") or "",
        )
        mark_pool_account_result(token, True)
        update_job(job["id"], {
            "usage": {
                "source": "local_account_pool",
                "request_params": {
                    "model": job.get("model") or DEFAULT_MODEL,
                    "aspect_ratio": job.get("aspect_ratio") or "1:1",
                    "resolution": job.get("resolution") or "1K",
                    "size": job.get("size") or "",
                    "quality": job.get("quality") or "auto",
                    "note": "号池模式没有独立 size 参数，已写入最终提示词约束。",
                },
            },
            "revised_prompt": prompt,
        })
        return [save_image_payload(job["id"], index + i, normalize_image(item), prompt) for i, item in enumerate(data)]
    except Exception as exc:
        mark_pool_account_result(token, False, redact_secrets(str(exc)))
        raise


def read_jobs():
    return read_json(JOBS_FILE, [])


def write_jobs(items):
    write_json(JOBS_FILE, items[-MAX_HISTORY:])


def read_media():
    return read_json(MEDIA_FILE, [])


def write_media(items):
    write_json(MEDIA_FILE, items[-MAX_HISTORY * 4:])


def media_path_from_url(url: str) -> Path | None:
    raw = str(url or "")
    if not raw.startswith("/media/"):
        return None
    filename = raw.split("/media/", 1)[1].split("?", 1)[0]
    if not filename:
        return None
    target = (MEDIA_DIR / filename).resolve()
    try:
        if target.is_relative_to(MEDIA_DIR.resolve()):
            return target
    except ValueError:
        return None
    return None


def thumb_url_for_media(media_id: str, source_url: str, max_size: int = 420) -> str:
    source = media_path_from_url(source_url)
    if not source or not source.exists():
        return source_url
    thumb_name = f"{media_id or source.stem}-{max_size}.webp"
    thumb_path = THUMB_DIR / thumb_name
    if thumb_path.exists():
        return f"/thumbs/{thumb_name}"
    try:
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((max_size, max_size))
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(thumb_path, "WEBP", quality=78, method=4)
        return f"/thumbs/{thumb_name}"
    except Exception:
        return source_url


def ensure_media_thumb(item: dict, max_size: int = 420) -> dict:
    if not isinstance(item, dict):
        return item
    current = str(item.get("thumb_url") or "")
    if current.startswith("/thumbs/"):
        return item
    url = str(item.get("url") or item.get("image_url") or "")
    if not url:
        return item
    item["thumb_url"] = thumb_url_for_media(str(item.get("id") or item.get("media_id") or ""), url, max_size)
    return item


def ensure_media_thumbs(items: list[dict], max_size: int = 420, persist: bool = False) -> list[dict]:
    changed = False
    result = []
    for item in items:
        before = str((item or {}).get("thumb_url") or "")
        result.append(ensure_media_thumb(item, max_size))
        changed = changed or before != str((item or {}).get("thumb_url") or "")
    if persist and changed:
        write_media(items)
    return result


def read_square():
    return read_json(SQUARE_FILE, [])


def write_square(items):
    write_json(SQUARE_FILE, items[-1000:])


def ensure_square_thumb(item: dict, max_size: int = 520) -> dict:
    if not isinstance(item, dict):
        return item
    current = str(item.get("thumb_url") or "")
    if current.startswith("/thumbs/"):
        return item
    url = str(item.get("image_url") or "")
    if not url:
        return item
    item["thumb_url"] = thumb_url_for_media(str(item.get("media_id") or item.get("id") or ""), url, max_size)
    return item


def ensure_square_thumbs(items: list[dict], max_size: int = 520, persist: bool = False) -> list[dict]:
    changed = False
    for item in items:
        before = str((item or {}).get("thumb_url") or "")
        ensure_square_thumb(item, max_size)
        changed = changed or before != str((item or {}).get("thumb_url") or "")
    if persist and changed:
        write_square(items)
    return items


def read_admin_settings() -> dict:
    raw = read_json(ADMIN_SETTINGS_FILE, {})
    return {
        "save_generated_images": bool(raw.get("save_generated_images", True)),
        "admin_log_retention_days": normalize_admin_log_retention_days(raw.get("admin_log_retention_days", 30)),
    }


def write_admin_settings(settings: dict) -> None:
    current = read_admin_settings()
    current.update(settings or {})
    current["save_generated_images"] = bool(current.get("save_generated_images", True))
    current["admin_log_retention_days"] = normalize_admin_log_retention_days(current.get("admin_log_retention_days", 30))
    current["updated_at"] = now_ts()
    write_json(ADMIN_SETTINGS_FILE, current)


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
    items = []
    for job in read_jobs():
        if not matches_client(job, cid):
            continue
        if job_workspace(job) == "commerce" and str(job.get("client_id") or "").strip() != cid:
            continue
        items.append(public_job(job))
    return items


def public_job(job: dict) -> dict:
    item = dict(job or {})
    item["workspace"] = job_workspace(item)
    if item.get("api_key"):
        item["api_key"] = ""
        item["api_key_configured"] = True
    return item


def public_jobs(items: list[dict]) -> list[dict]:
    return [public_job(item) for item in items]


def public_square_item(item: dict) -> dict:
    public = dict(item or {})
    public.pop("liked_by", None)
    return public


def square_item_for_media(media: dict, job: dict | None = None, client_id: str = "") -> dict:
    prompt = str(media.get("prompt") or (job or {}).get("prompt") or "").strip()
    title = str((job or {}).get("title") or "").strip() or (prompt[:24] if prompt else "广场作品")
    title = title[:40]
    now = now_ts()
    return {
        "id": uuid.uuid4().hex,
        "media_id": str(media.get("id") or ""),
        "job_id": str(media.get("job_id") or ""),
        "title": title,
        "prompt": prompt,
        "image_url": str(media.get("url") or ""),
        "thumb_url": thumb_url_for_media(str(media.get("id") or ""), str(media.get("url") or ""), 520),
        "model": str(media.get("model") or (job or {}).get("model") or DEFAULT_MODEL),
        "aspect_ratio": str(media.get("aspect_ratio") or (job or {}).get("aspect_ratio") or "1:1"),
        "resolution": str(media.get("resolution") or (job or {}).get("resolution") or "1K"),
        "size": str(media.get("actual_size") or media.get("size") or (job or {}).get("size") or ""),
        "quality": str(media.get("quality") or (job or {}).get("quality") or "auto"),
        "likes": 0,
        "views": 0,
        "featured": False,
        "status": "visible",
        "recommended_by": client_id,
        "created_at": now,
        "updated_at": now,
    }


def client_media(client_id: str | None = None) -> list[dict]:
    cid = client_id if client_id is not None else current_client_id()
    if not cid:
        return []
    job_ids = {str(job.get("id") or "") for job in client_jobs(cid)}
    return ensure_media_thumbs([
        item for item in read_media()
        if str(item.get("client_id") or "") == cid or str(item.get("job_id") or "") in job_ids
    ])


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


def build_prompt_with_base(payload: dict, prompt: str) -> str:
    next_payload = dict(payload or {})
    next_payload["prompt"] = str(prompt or "").strip()
    return build_prompt(next_payload)


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


def record_job_request_params(job_id: str, params: dict) -> None:
    job = get_job(job_id) or {}
    usage = job.get("usage") if isinstance(job.get("usage"), dict) else {}
    next_usage = dict(usage)
    next_usage["request_params"] = params
    update_job(job_id, {"usage": next_usage})


def merge_job_usage(job_id: str, upstream_usage) -> dict:
    job = get_job(job_id) or {}
    usage = job.get("usage") if isinstance(job.get("usage"), dict) else {}
    next_usage = dict(usage)
    if isinstance(upstream_usage, dict):
        next_usage["upstream"] = upstream_usage
    elif upstream_usage:
        next_usage["upstream"] = upstream_usage
    update_job(job_id, {"usage": next_usage})
    return next_usage


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
    local_upscale = str(job.get("local_upscale") or "none").strip().lower()
    if local_upscale in {"2x", "2k", "4k"}:
        try:
            with Image.open(path) as image:
                image = ImageOps.exif_transpose(image)
                if local_upscale == "2x":
                    target_size = (max(1, image.width * 2), max(1, image.height * 2))
                else:
                    target_edge = 4096 if local_upscale == "4k" else 2048
                    scale = max(1.0, target_edge / max(1, image.width, image.height))
                    target_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
                resample_root = getattr(Image, "Resampling", Image)
                resample = getattr(resample_root, "LANCZOS", 1)
                image = image.resize(target_size, resample)
                if path.suffix.lower() in {".jpg", ".jpeg"} and image.mode != "RGB":
                    image = image.convert("RGB")
                image.save(path)
        except Exception:
            local_upscale = "failed"
    width, height = image_dimensions(path)
    actual_size = f"{width}x{height}" if width and height else ""
    url = f"/media/{filename}"
    return {
        "id": media_id,
        "job_id": job_id,
        "client_id": str(job.get("client_id") or ""),
        "workspace": job_workspace(job),
        "index": index,
        "url": url,
        "thumb_url": thumb_url_for_media(media_id, url),
        "source_url": source_url,
        "mime": mime,
        "prompt": prompt,
        "model": str(job.get("model") or ""),
        "aspect_ratio": str(job.get("aspect_ratio") or "1:1"),
        "resolution": str(job.get("resolution") or "1K"),
        "size": str(job.get("size") or "1024x1024"),
        "actual_size": actual_size,
        "width": width,
        "height": height,
        "quality": str(job.get("quality") or "auto"),
        "output_format": str(job.get("output_format") or "png"),
        "background": str(job.get("background") or "auto"),
        "local_upscale": local_upscale,
        "reference_ids": [str(v).strip() for v in job.get("reference_ids", []) if str(v).strip()][:4],
        "edit_mode": bool(job.get("edit_mode")),
        "admin_visible": read_admin_settings().get("save_generated_images", True),
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
    request_options, request_meta = normalize_image_request_options(job, "/v1/images/edits")
    data = {"model": request_options["model"], "prompt": prompt, "size": request_options["size"], "n": "1"}
    if request_options.get("quality") and request_options["quality"] != "auto":
        data["quality"] = request_options["quality"]
    for key in ("output_format", "output_compression", "background", "moderation"):
        if request_options.get(key):
            data[key] = request_options[key]
    record_job_request_params(job["id"], {
        **request_meta,
        "aspect_ratio": job.get("aspect_ratio") or "1:1",
        "resolution": job.get("resolution") or "1K",
        "reference_count": len(ref_paths),
    })

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


def recover_interrupted_jobs() -> None:
    with state_lock:
        jobs = read_jobs()
        media_by_job: dict[str, list[dict]] = {}
        for item in read_media():
            media_by_job.setdefault(str(item.get("job_id") or ""), []).append(item)
        changed = False
        for job in jobs:
            if job.get("status") not in {"queued", "running"}:
                continue
            job_media = media_by_job.get(str(job.get("id") or ""), [])
            progress = job.get("progress") if isinstance(job.get("progress"), dict) else {}
            done = max(int(progress.get("done") or 0), len(job.get("media_ids") or []), len(job_media))
            total = int(progress.get("total") or job.get("count") or 1)
            if job_media:
                job.update({
                    "status": "success" if done >= total else "partial",
                    "error": "" if done >= total else "服务重启后任务中断，已保留已完成图片。",
                    "media_ids": [str(item.get("id") or "") for item in job_media if item.get("id")],
                    "progress": {"done": done, "total": total, "message": "已恢复已完成图片" if done >= total else "已保留部分图片"},
                    "completed_at": now_ts(),
                    "updated_at": now_ts(),
                })
            else:
                job.update({
                    "status": "error",
                    "error": "服务重启后任务中断，请重新提交。",
                    "progress": {"done": done, "total": total, "message": "任务已中断"},
                    "completed_at": now_ts(),
                    "updated_at": now_ts(),
                })
            changed = True
        if changed:
            write_jobs(jobs)


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


def is_raw_image_model_id(model: str) -> bool:
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


def is_image_model_id(model: str) -> bool:
    return is_raw_image_model_id(model) and model_allowed_by_providers(model, "image")


def is_text_model_id(model: str) -> bool:
    return is_raw_text_model_id(model) and model_allowed_by_providers(model, "text")


def split_model_ids(models: list[str]) -> tuple[list[str], list[str]]:
    image_models = [model for model in models if is_image_model_id(model)]
    text_models = [model for model in models if is_text_model_id(model)]
    return image_models, text_models


def fetch_custom_models_by_kind(kind: str, api_url: str, api_key: str) -> tuple[list[str], str, str]:
    config = read_model_config()
    debug_enabled = custom_api_debug_enabled(config)
    route_url, route_keys, route_kind = custom_model_route_key_pool(config, kind, include_legacy=debug_enabled)
    final_url = str(api_url or "").strip() or (route_url if debug_enabled else "")
    request_key = str(api_key or "").strip()
    final_keys = [request_key] if request_key else (route_keys if debug_enabled else [])
    if not final_url:
        raise ValueError("请先填写自定义 API URL")
    if not final_keys:
        raise ValueError("请先填写 API Key")
    merged_models = []
    errors = []
    resolved_url = ""
    candidates = candidate_api_urls("custom", final_url)
    def fetch_with_key(key_index: int, final_key: str) -> tuple[list[str], str, list[str]]:
        key_errors = []
        for candidate in candidates:
            try:
                return fetch_models(candidate, final_key), candidate.rstrip("/"), key_errors
            except Exception as exc:
                key_errors.append(redact_secrets(f"Key {key_index} {mask_secret(final_key)} @ {candidate}: {exc}"))
        return [], "", key_errors

    max_workers = max(1, min(len(final_keys), 6))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(fetch_with_key, index, final_key) for index, final_key in enumerate(final_keys, 1)]
        for future in as_completed(futures):
            models, key_url, key_errors = future.result()
            if models:
                unique_extend(merged_models, models)
                if not resolved_url:
                    resolved_url = key_url
            errors.extend(key_errors)
    if merged_models:
        return merged_models, resolved_url or final_url.rstrip("/"), route_kind
    raise RuntimeError(redact_secrets(" | ".join(errors) or "模型读取失败"))


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
                "只输出严格 json object，不要 Markdown。"
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
                    "如果 agent.prompt_skills 存在，必须把这些提示词技能落实到三个方案中，不要只复述技能名称",
                    "不要生成真实品牌 Logo、不要要求画中文字，除非用户明确要求",
                ],
                "revision": revision,
                "agent": agent,
                "values": values,
            }, ensure_ascii=False),
        },
    ]


def normalize_agent_mode_plan(plan: dict, fallback_prompt: str) -> dict:
    if not isinstance(plan, dict):
        raise ValueError("agent mode plan must be an object")
    prompt = str(plan.get("prompt") or fallback_prompt or "").strip()
    if not prompt:
        raise ValueError("agent mode plan missing prompt")
    title = str(plan.get("title") or "").strip()[:80]
    task_type = str(plan.get("task_type") or "single").strip().lower()
    if task_type not in {"single", "set", "album"}:
        task_type = "single"
    aspect_ratio = str(plan.get("aspect_ratio") or "").strip()
    if aspect_ratio not in {"1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "16:9", "9:16", "21:9", "1:4", "8:1", "1:8"}:
        aspect_ratio = ""
    try:
        count = int(plan.get("count") or 1)
    except (TypeError, ValueError):
        count = 1
    steps = plan.get("steps") if isinstance(plan.get("steps"), list) else []
    notes = plan.get("notes") if isinstance(plan.get("notes"), list) else []
    return {
        "title": title,
        "task_type": task_type,
        "brief": str(plan.get("brief") or "").strip()[:1600],
        "prompt": prompt[:5000],
        "aspect_ratio": aspect_ratio,
        "count": max(1, min(count, 20)),
        "negative": str(plan.get("negative") or "").strip()[:1200],
        "steps": [str(item or "").strip() for item in steps if str(item or "").strip()][:8],
        "notes": [str(item or "").strip() for item in notes if str(item or "").strip()][:8],
    }


def cjk_char_count(value: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", str(value or "")))


def english_word_count(value: str) -> int:
    return len(re.findall(r"\b[A-Za-z][A-Za-z\-]{2,}\b", str(value or "")))


def is_english_heavy_prompt(value: str) -> bool:
    text = str(value or "")
    if not text.strip():
        return False
    letters = len(re.findall(r"[A-Za-z]", text))
    cjk = cjk_char_count(text)
    words = english_word_count(text)
    return words >= 12 and letters > max(80, cjk * 2)


def build_prompt_analysis_fallback_prompt(payload: dict, plan: dict | None = None) -> str:
    base = str(payload.get("prompt") or "").strip()
    mode = str(payload.get("mode") or "optimize").strip().lower()
    references = payload.get("references") if isinstance(payload.get("references"), list) else []
    negative = str((plan or {}).get("negative") or payload.get("negative") or "").strip()
    lines = []
    if base:
        lines.append(base)
    supplements = []
    if references:
        supplements.append("保留参考图的主体数量、人物身份特征、动作关系、构图比例、光影方向和主要色彩，不凭空增加参考图中不存在的人物、文字、Logo 或品牌元素。")
    if mode == "failure":
        supplements.append("风险规避：重点检查手部、手指数量、肢体比例、面部结构、烟雾与背景融合、主体一致性和画面清晰度，避免畸形、错位、重复肢体、低质感和过度锐化。")
    elif mode == "params":
        supplements.append("参数建议：保持当前主体和场景不变，优先使用当前比例与尺寸；如需更稳，减少张数并加强负面提示词约束。")
    elif mode == "style":
        supplements.append("风格增强：在不改变主体、人数、动作和场景的前提下，增强真实摄影质感、自然光影、材质细节、空间层次和成片清晰度。")
    else:
        supplements.append("优化补充：保持原始主题、人物数量、动作和场景不变，补充构图、光线、材质、清晰度和负面控制，输出可直接生图的中文提示词。")
    if negative:
        supplements.append(f"负面控制：{negative}")
    else:
        supplements.append("负面控制：低清晰度、肢体畸形、手指错误、面部崩坏、主体变形、错别字、多余人物、多余手臂、过度锐化、AI 伪影。")
    lines.append("\n".join(supplements))
    return "\n\n".join(item for item in lines if item).strip()


def normalize_prompt_analysis_plan(plan: dict, payload: dict) -> dict:
    if not isinstance(plan, dict):
        raise ValueError("prompt analysis must be an object")
    fallback_prompt = str(payload.get("prompt") or "").strip()
    prompt = str(plan.get("prompt") or fallback_prompt or "").strip()
    if not prompt:
        raise ValueError("prompt analysis missing prompt")
    mode = str(payload.get("mode") or plan.get("mode") or "optimize").strip().lower()
    if mode not in {"preflight", "optimize", "params", "failure", "style"}:
        mode = "optimize"
    if fallback_prompt and fallback_prompt not in prompt:
        prompt = f"{fallback_prompt}\n\n优化补充：{prompt}"
    if is_english_heavy_prompt(prompt):
        prompt = build_prompt_analysis_fallback_prompt(payload, plan)
    aspect_ratio = str(plan.get("aspect_ratio") or payload.get("aspect_ratio") or "").strip()
    if aspect_ratio not in {"1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "16:9", "9:16", "21:9", "1:4", "8:1", "1:8"}:
        aspect_ratio = str(payload.get("aspect_ratio") or "").strip()
    try:
        count = int(plan.get("count") or payload.get("count") or 1)
    except (TypeError, ValueError):
        count = 1
    risks = plan.get("risks") if isinstance(plan.get("risks"), list) else []
    steps = plan.get("steps") if isinstance(plan.get("steps"), list) else []
    notes = plan.get("notes") if isinstance(plan.get("notes"), list) else []
    return {
        "mode": mode,
        "task_type": "single",
        "brief": str(plan.get("brief") or "").strip()[:1600],
        "prompt": prompt[:5000],
        "aspect_ratio": aspect_ratio,
        "count": max(1, min(count, 20)),
        "negative": str(plan.get("negative") or payload.get("negative") or "").strip()[:1200],
        "risks": [str(item or "").strip() for item in risks if str(item or "").strip()][:8],
        "steps": [str(item or "").strip() for item in steps if str(item or "").strip()][:8],
        "notes": [str(item or "").strip() for item in notes if str(item or "").strip()][:8],
    }

def build_prompt_analysis_messages(payload: dict) -> list[dict]:
    prompt = str(payload.get("prompt") or "").strip()
    mode = str(payload.get("mode") or "optimize").strip().lower()
    references = payload.get("references") if isinstance(payload.get("references"), list) else []
    return [
        {
            "role": "system",
            "content": (
                "你是生图发送前风险预判与提示词优化助手。只输出严格 JSON object，不要 Markdown。"
                "所有字段必须使用简体中文，尤其 prompt、brief、risks、steps、notes、negative 禁止输出英文句子；只允许保留 8K、AI、Logo、JPEG 这类必要术语。"
                "必须围绕用户当前输入做风险识别和规避优化，不能把任务改写成无关的新任务。"
                "如果是 failure 模式，先判断可能失败的原因，再给出规避这些风险后的中文优化提示词。"
                "参考图只作为约束摘要，不要凭空编造参考图中不存在的文字、Logo、品牌或主体。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "mode": mode,
                "output_schema": {
                    "brief": "string: 对当前任务的简短理解，必须中文",
                    "risks": ["string: 具体风险点，必须中文"],
                    "steps": ["string: 对应规避策略，必须中文"],
                    "prompt": "string: 基于风险规避后的可直接生图提示词，必须中文",
                    "aspect_ratio": "string",
                    "count": "number",
                    "negative": "string: 中文负面提示词",
                    "notes": ["string: 中文注意事项"],
                },
                "requirements": [
                    "不得引入 user_prompt 没有提到的核心文字、品牌、人名或物体。",
                    "prompt 必须是中文生图提示词，不要写英文段落，不要中英混写。",
                    "如果有参考图，只说明保留参考图主体、构图、光影、色彩等约束；不要猜测参考图具体文字内容。",
                    "failure 模式必须输出 risks，并在 prompt 中加入规避错误文字、低清晰度、主体变形、过度锐化等风险的约束。",
                    "params 模式侧重比例、张数、负面提示词和质量建议，但 prompt 仍要保持当前用户意图。",
                    "style 模式可以增强风格，但不能改变用户要生成的主体和场景。",
                ],
                "user_prompt": prompt,
                "current": {
                    "image_model": payload.get("image_model"),
                    "aspect_ratio": payload.get("aspect_ratio"),
                    "resolution": payload.get("resolution"),
                    "size": payload.get("size"),
                    "count": payload.get("count"),
                    "quality": payload.get("quality"),
                    "negative": payload.get("negative"),
                    "reference_count": len(references[:4]),
                },
                "references": references[:4],
            }, ensure_ascii=False),
        },
    ]

def build_agent_mode_messages(payload: dict) -> list[dict]:
    prompt = str(payload.get("prompt") or "").strip()
    references = payload.get("references") if isinstance(payload.get("references"), list) else []
    return [
        {
            "role": "system",
            "content": (
                "你是生图工作台的任务拆解 Agent。只输出严格 json object，不要 Markdown。"
                "你要理解用户想做一张图、一组不同图片或宣传画册，并转成可直接生图的中文提示词和参数。"
                "如果有参考图，必须说明保留参考主体、结构、颜色或关键细节，并把编辑/再生成约束写进 prompt。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "output_schema": {
                    "title": "string",
                    "task_type": "single | set | album",
                    "brief": "string",
                    "prompt": "string",
                    "aspect_ratio": "string",
                    "count": "number",
                    "negative": "string",
                    "steps": ["string"],
                    "notes": ["string"],
                },
                "requirements": [
                    "prompt 必须包含主体、场景、构图、光线、镜头、材质/颜色、背景、平台用途、交付标准。",
                    "single 推荐 1-2 张，set 推荐 3-6 张，album 推荐 6-12 张。",
                    "不要要求模型生成可读中文文字，除非用户明确要求。",
                    "不要只复述用户原话，要补足可执行画面方案。",
                ],
                "user_prompt": prompt,
                "current": {
                    "model": payload.get("image_model"),
                    "aspect_ratio": payload.get("aspect_ratio"),
                    "count": payload.get("count"),
                    "negative": payload.get("negative"),
                },
                "references": references[:4],
            }, ensure_ascii=False),
        },
    ]


def call_agent_mode_text_model(api_url: str, api_key: str, model: str, payload: dict) -> dict:
    api_base = normalize_api_base(api_url)
    headers = {"Content-Type": "application/json"}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    body = {
        "model": model,
        "messages": build_agent_mode_messages(payload),
        "temperature": 0.65,
    }
    endpoint = urljoin(api_base + "/", "v1/chat/completions")
    resp = requests.post(endpoint, headers=headers, json=body, timeout=AGENT_TEXT_TIMEOUT)
    if resp.status_code >= 400:
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {resp.text[:800].strip()}"))
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    return normalize_agent_mode_plan(extract_json_object(content), str(payload.get("prompt") or ""))


def call_prompt_analysis_text_model(api_url: str, api_key: str, model: str, payload: dict) -> dict:
    api_base = normalize_api_base(api_url)
    headers = {"Content-Type": "application/json"}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    body = {
        "model": model,
        "messages": build_prompt_analysis_messages(payload),
        "temperature": 0.35,
    }
    endpoint = urljoin(api_base + "/", "v1/chat/completions")
    resp = requests.post(endpoint, headers=headers, json=body, timeout=AGENT_TEXT_TIMEOUT)
    if resp.status_code >= 400:
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {resp.text[:800].strip()}"))
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    return normalize_prompt_analysis_plan(extract_json_object(content), payload)


def extract_chat_text_content(message: dict) -> str:
    content = message.get("content") if isinstance(message, dict) else ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                value = item.get("text") or item.get("content") or ""
                if value:
                    parts.append(str(value))
            elif item:
                parts.append(str(item))
        return "\n".join(parts).strip()
    return str(content or "").strip()


def build_commerce_analysis_messages(payload: dict, references: list[dict]) -> list[dict]:
    prompt = str(payload.get("message") or "").strip()
    history = payload.get("history") if isinstance(payload.get("history"), list) else []
    product_context = str(payload.get("product_context") or "").strip()
    messages = [
        {
            "role": "system",
            "content": (
                "你是简洁生图台里的通用图文对话助手。必须使用简体中文回答。"
                "根据用户的问题、补充说明和上传图片正常对话，回答要直接、具体、可执行。"
                "如果用户需要生图提示词，就输出可直接复制的提示词，并说明主体、构图、背景、光线、材质、风格、画面比例和需要避免的内容。"
                "如果用户只是提问、改文案、看图、总结、翻译或分析图片，就按问题本身回答，不要强制套电商、淘宝主图或产品分析结构。"
                "不要编造图片里不存在的品牌、文字、功效认证或参数。无法确认的信息要明确说不确定。"
            ),
        }
    ]
    if product_context:
        messages.append({"role": "user", "content": f"补充说明：{product_context}"})
    for item in history[-10:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content") or "").strip()
        if content:
            messages.append({"role": role, "content": content[:3000]})
    content_parts = [{"type": "text", "text": prompt or "请根据这些图片进行正常图文对话。"}]
    for ref in references[:4]:
        data_url = reference_to_data_url(ref)
        if data_url:
            content_parts.append({"type": "image_url", "image_url": {"url": data_url}})
    messages.append({"role": "user", "content": content_parts if len(content_parts) > 1 else content_parts[0]["text"]})
    return messages


def call_commerce_analysis_text_model(api_url: str, api_key: str, model: str, payload: dict, references: list[dict]) -> str:
    api_base = normalize_api_base(api_url)
    headers = {"Content-Type": "application/json"}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    body = {
        "model": model,
        "messages": build_commerce_analysis_messages(payload, references),
        "temperature": 0.45,
    }
    endpoint = urljoin(api_base + "/", "v1/chat/completions")
    resp = requests.post(endpoint, headers=headers, json=body, timeout=AGENT_TEXT_TIMEOUT)
    if resp.status_code >= 400:
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {resp.text[:800].strip()}"))
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = extract_chat_text_content(message)
    if not content:
        raise RuntimeError("文本模型没有返回内容")
    return content[:12000]


def call_pool_text_model_once(
    model: str,
    messages: list[dict],
    normalize,
    payload,
    requirements: dict | None = None,
) -> tuple[dict, str]:
    account = pick_pool_account()
    token = account["access_token"]
    try:
        client = ChatGptImageClient(token)
        client.bootstrap()
        active_requirements = requirements or client.chat_requirements()
        resp = client.start_text_generation(model, messages, active_requirements)
        content = collect_pool_text_response(resp)
        if not content:
            raise RuntimeError("号池文本模型没有返回内容")
        plan = normalize(extract_json_object(content), payload)
        mark_pool_account_result(token, True)
        return plan, model
    except Exception as exc:
        mark_pool_account_result(token, False, redact_secrets(str(exc)))
        raise


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
    }
    endpoint = urljoin(api_base + "/", "v1/chat/completions")
    attempts = max(1, min(AGENT_TEXT_RETRIES + 1, 4))
    last_error = ""
    resp = None
    for attempt in range(attempts):
        try:
            resp = requests.post(endpoint, headers=headers, json=body, timeout=AGENT_TEXT_TIMEOUT)
            if resp.status_code not in {429, 502, 503, 504}:
                break
            last_error = redact_secrets(f"New API {resp.status_code}: {resp.text[:500]}")
        except requests.Timeout:
            last_error = f"文本模型请求超过 {AGENT_TEXT_TIMEOUT} 秒"
        except requests.RequestException as exc:
            last_error = redact_secrets(str(exc))
        if attempt < attempts - 1:
            time.sleep(1.5 * (attempt + 1))
    if resp is None:
        raise RuntimeError(last_error or "文本模型请求失败")
    if resp.status_code >= 400:
        detail = redact_secrets(resp.text[:800].strip())
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {detail or last_error}"))
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    return normalize_agent_plan(extract_json_object(content), payload.get("values") if isinstance(payload.get("values"), dict) else {})


def call_agent_text_model_with_pool(model: str, payload: dict) -> dict:
    account = pick_pool_account()
    token = account["access_token"]
    try:
        client = ChatGptImageClient(token)
        plan = client.generate_agent_plan(model, payload)
        mark_pool_account_result(token, True)
        return plan
    except Exception as exc:
        mark_pool_account_result(token, False, redact_secrets(str(exc)))
        raise


def collect_pool_text_response(resp) -> str:
    content = ""
    try:
        for raw in iter_sse_payloads(resp):
            if raw == "[DONE]":
                break
            try:
                event = json.loads(raw)
            except Exception:
                continue
            value = event.get("v") if isinstance(event, dict) else None
            for candidate in (value, event):
                if not isinstance(candidate, dict):
                    continue
                message = candidate.get("message")
                if not isinstance(message, dict):
                    continue
                if (message.get("author") or {}).get("role") != "assistant":
                    continue
                parts = (message.get("content") or {}).get("parts") or []
                text = "".join(str(part) for part in parts if isinstance(part, str)).strip()
                if text:
                    content = text
    finally:
        resp.close()
    return content


def research_payload_summary(payload: dict) -> dict:
    figure_type = str(payload.get("figure_type") or "").strip()
    style = str(payload.get("style") or "").strip()
    return {
        "subject": str(payload.get("subject") or "").strip(),
        "context": str(payload.get("context") or "").strip(),
        "figure_type": figure_type or "research workflow figure",
        "style": style or "clean scientific illustration",
        "skill": str(payload.get("skill") or "").strip(),
        "current_prompt": str(payload.get("current_prompt") or payload.get("prompt") or "").strip(),
        "current_mermaid": str(payload.get("current_mermaid") or payload.get("mermaid") or "").strip(),
    }


def build_research_fallback_prompt(payload: dict) -> str:
    values = research_payload_summary(payload)
    subject = values["subject"] or "根据科研材料提取研究主体"
    context = values["context"][:1600] or "未提供科研材料，请仅根据用户填写的主题生成。"
    return "\n".join([
        "请生成一段可直接用于科研图生图的中文提示词。",
        f"主体：{subject}。明确研究对象、输入条件、处理过程、关键变量和最终输出。",
        f"构图：{values['figure_type']}。使用左到右或上到下的模块化流程布局，节点之间用箭头连接，体现步骤推进和因果关系。",
        "结构：展示输入、处理模块、输出、对照组、分支、反馈、验证和局部放大信息，不编造科研结论。",
        f"风格：{values['style']}。干净白底或浅色背景，信息层级清楚，矢量科研插图质感，配色克制，箭头精确。",
        f"科研材料：{context}",
        "负面控制：低清晰度、伪科学结构、不可读标签、随机多余模块、装饰性海报风、错误文字。",
    ])


def research_clean_label(value: str, fallback: str = "步骤") -> str:
    label = re.sub(r"\s+", " ", str(value or fallback))
    label = re.sub(r"[\"'`\[\]{}<>|]", "", label).strip()
    return (label or fallback)[:34]


def build_research_fallback_mermaid(payload: dict) -> str:
    values = research_payload_summary(payload)
    if not values["subject"] and not values["context"]:
        return ""
    raw_items = re.split(r"[\n\r.;；。,:，、>→\-]+", values["context"])
    steps: list[str] = []
    for item in raw_items:
        label = research_clean_label(item)
        if len(label) < 2:
            continue
        if not any(existing == label or existing in label or label in existing for existing in steps):
            steps.append(label)
    if len(steps) < 3:
        steps = [
            research_clean_label(values["subject"], "研究对象"),
            "输入 / 样本准备",
            "实验或模型处理",
            "关键变量读出",
            "验证与结论输出",
        ]
    steps = steps[:7]
    direction = "TD" if values["figure_type"] in {"mechanism", "abstract"} else "LR"
    ids = ["A", "B", "C", "D", "E", "F", "G"]
    lines = [
        f"flowchart {direction}",
        f'  title["{research_clean_label(values["subject"] or "科研流程图", "科研流程图")}"]:::title',
    ]
    lines.extend(f'  {ids[index]}["{research_clean_label(step, f"步骤 {index + 1}")}"]:::step' for index, step in enumerate(steps))
    lines.append("  title --> A")
    lines.extend(f"  {ids[index]} --> {ids[index + 1]}" for index in range(len(steps) - 1))
    if values["figure_type"] == "mechanism" and len(steps) >= 4:
        lines.append(f"  {ids[min(len(steps) - 2, 4)]} -. 反馈 .-> {ids[1]}")
    if values["figure_type"] == "abstract" and len(steps) >= 5:
        lines.append(f'  {ids[-1]} --> output["论文图形摘要输出"]:::output')
    lines.extend([
        "  classDef title fill:#0b8f72,stroke:#00665f,color:#ffffff,stroke-width:1px;",
        "  classDef step fill:#ffffff,stroke:#8ccbbb,color:#15201d,stroke-width:1px;",
        "  classDef output fill:#e8f8f2,stroke:#0b8f72,color:#063f3b,stroke-width:1px;",
    ])
    return "\n".join(lines)


def clean_research_mermaid(value: str) -> str:
    text = str(value or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:mermaid)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```$", "", text).strip()
    if not text:
        return ""
    first = text.splitlines()[0].strip().lower()
    allowed = ("flowchart", "graph", "sequencediagram", "statediagram", "journey", "timeline")
    return text if first.startswith(allowed) else ""


def normalize_research_plan(plan: dict, payload: dict) -> dict:
    if not isinstance(plan, dict):
        raise ValueError("research plan must be an object")
    prompt = str(plan.get("prompt") or plan.get("image_prompt") or "").strip()
    if not prompt:
        prompt = build_research_fallback_prompt(payload)
    mermaid = clean_research_mermaid(plan.get("mermaid") or plan.get("diagram") or "")
    if not mermaid:
        mermaid = build_research_fallback_mermaid(payload)
    nodes = plan.get("nodes") if isinstance(plan.get("nodes"), list) else []
    notes = plan.get("notes") if isinstance(plan.get("notes"), list) else []
    if not prompt and not mermaid:
        raise ValueError("research plan missing prompt and mermaid")
    return {
        "title": str(plan.get("title") or research_payload_summary(payload)["subject"] or "").strip()[:120],
        "prompt": prompt[:6000],
        "mermaid": mermaid[:6000],
        "caption": str(plan.get("caption") or "").strip()[:1200],
        "negative": str(plan.get("negative") or "").strip()[:1200],
        "nodes": [str(item or "").strip() for item in nodes if str(item or "").strip()][:10],
        "notes": [str(item or "").strip() for item in notes if str(item or "").strip()][:10],
    }


def build_research_plan_messages(payload: dict) -> list[dict]:
    values = research_payload_summary(payload)
    return [
        {
            "role": "system",
            "content": (
                "你是科研图工作台的中文科研绘图规划师和提示词工程师。"
                "只输出严格 JSON object，不要输出 Markdown。"
                "你必须把用户粘贴的论文摘要、实验步骤或课题材料，转换成中文科研生图提示词和有效 Mermaid 流程图。"
                "除 Mermaid 关键字 flowchart/classDef 等语法外，所有标题、节点、图注、提示词、说明必须使用中文。"
                "不要分析当前代码仓库，不要提到 Docker、Git、部署、文件、代码或本项目。"
                "不要编造科研结论；标签要短，节点要可编辑。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "output_schema": {
                    "title": "中文标题",
                    "prompt": "中文 S-C-S-S 科研图生图提示词",
                    "mermaid": "有效 Mermaid 源码，以 flowchart LR 或 flowchart TD 开头，节点文字必须是中文",
                    "caption": "中文图注",
                    "negative": "中文负面提示词",
                    "nodes": ["中文短节点标签"],
                    "notes": ["中文绘图备注"],
                },
                "requirements": [
                    "prompt 可以使用 主体 / 构图 / 结构 / 风格 四段，必须避免输出大段英文标题",
                    "prompt 必须可直接用于科研图生图，不要写成解释文章",
                    "Mermaid 必须是流程图，节点标签和箭头注释必须使用中文",
                    "如果 current_mermaid 里已有英文节点，必须翻译为中文后再输出",
                    "材料里有主流程、分支、反馈、验证、输出时，要在流程图里分开表达",
                    "避免伪科学机制、不可读文字、随机装饰模块和海报式堆砌",
                    "如果 current_prompt 或 current_mermaid 已存在，要在其基础上中文优化，不要忽略",
                ],
                "research": values,
            }, ensure_ascii=False),
        },
    ]


def call_research_text_model(api_url: str, api_key: str, model: str, payload: dict) -> dict:
    api_base = normalize_api_base(api_url)
    headers = {"Content-Type": "application/json"}
    auth = bearer_token(api_key)
    if auth:
        headers["Authorization"] = auth
    body = {
        "model": model,
        "messages": build_research_plan_messages(payload),
        "temperature": 0.45,
    }
    endpoint = urljoin(api_base + "/", "v1/chat/completions")
    resp = requests.post(endpoint, headers=headers, json=body, timeout=AGENT_TEXT_TIMEOUT)
    if resp.status_code >= 400:
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {resp.text[:800].strip()}"))
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("文本模型没有返回 choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    return normalize_research_plan(extract_json_object(content), payload)


def is_model_unavailable_error(exc: Exception) -> bool:
    text = str(exc or "").lower()
    return (
        "model_not_found" in text
        or "no available channel" in text
        or "no channel" in text
        or "model not found" in text
        or "model_not_available" in text
        or "does not exist" in text and "model" in text
        or "invalid model" in text
        or "unsupported model" in text
    )


def parse_text_model_version(model: str) -> tuple[str, tuple[int, ...], str] | None:
    value = str(model or "").strip().lower()
    match = re.search(r"^(.*?)(\d+(?:[.-]\d+)*)(.*)$", value)
    if not match:
        return None
    prefix, raw_version, suffix = match.groups()
    numbers = tuple(int(part) for part in re.findall(r"\d+", raw_version))
    return prefix, numbers, suffix


def text_model_distance(selected: str, candidate: str) -> tuple[int, int, int, str]:
    selected_parts = parse_text_model_version(selected)
    candidate_parts = parse_text_model_version(candidate)
    candidate_value = str(candidate or "").strip().lower()
    if selected_parts and candidate_parts:
        selected_prefix, selected_version, selected_suffix = selected_parts
        candidate_prefix, candidate_version, candidate_suffix = candidate_parts
        same_series = selected_prefix == candidate_prefix and selected_suffix == candidate_suffix
        same_major = same_series and selected_version[:1] == candidate_version[:1]
        width = max(len(selected_version), len(candidate_version))
        selected_padded = selected_version + (0,) * (width - len(selected_version))
        candidate_padded = candidate_version + (0,) * (width - len(candidate_version))
        distance = sum(abs(a - b) for a, b in zip(selected_padded, candidate_padded))
        if same_major and candidate_version < selected_version:
            return (0, distance, -sum(candidate_padded), candidate_value)
        if same_major:
            return (1, distance, -sum(candidate_padded), candidate_value)
        if same_series:
            return (2, distance, -sum(candidate_padded), candidate_value)
    return (9, 999, 0, candidate_value)


def preferred_text_models(models: list[str], selected: str = "") -> list[str]:
    cleaned = []
    for model in models:
        model = str(model or "").strip()
        if model and model not in cleaned and is_text_model_id(model):
            cleaned.append(model)
    selected = str(selected or "").strip()
    priority = []
    if selected:
        related = sorted(
            [model for model in cleaned if model != selected],
            key=lambda item: text_model_distance(selected, item),
        )
        priority.extend([model for model in related if text_model_distance(selected, model)[0] < 9])
    priority.extend(["gpt-5.4", "gpt-5.3", "gpt-5.2", "gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"])
    selected = str(selected or "").strip()
    ordered = []
    if selected and selected in cleaned:
        ordered.append(selected)
    lower_map = {model.lower(): model for model in cleaned}
    for item in priority:
        model = lower_map.get(item)
        if model and model not in ordered:
            ordered.append(model)
    for model in cleaned:
        if model not in ordered:
            ordered.append(model)
    return ordered


def preferred_research_text_models(models: list[str], selected: str = "") -> list[str]:
    return preferred_text_models(models, selected)


def available_pool_text_models(selected: str = "") -> list[str]:
    models = available_model_ids()
    ordered = preferred_text_models(models, selected)
    if ordered:
        return ordered
    selected = str(selected or "").strip()
    return [selected] if selected and is_text_model_id(selected) else []


def call_custom_text_model_with_fallback(
    api_url: str,
    api_key: str,
    model: str,
    payload: dict,
    caller,
) -> tuple[dict, str]:
    errors = []
    try:
        return caller(api_url, api_key, model, payload), model
    except Exception as exc:
        if not is_model_unavailable_error(exc):
            raise
        errors.append(f"{model}: {exc}")
    try:
        model_list, _resolved_url, _route_kind = fetch_custom_models_by_kind("text", api_url, api_key)
    except Exception as exc:
        raise RuntimeError(redact_secrets("所选文本模型不可用，且刷新文本模型池失败：" + str(exc)))
    candidates = [item for item in preferred_text_models(model_list, model) if item != model]
    for candidate in candidates:
        try:
            return caller(api_url, api_key, candidate, payload), candidate
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
            if not is_model_unavailable_error(exc):
                break
    raise RuntimeError(redact_secrets("文本模型池都不可用：" + " | ".join(errors[:6])))


def call_custom_text_model_with_key_pool(
    api_url: str,
    api_keys: list[str],
    model: str,
    payload: dict,
    caller,
) -> tuple[dict, str]:
    keys = [str(key or "").strip() for key in api_keys if str(key or "").strip()]
    if not keys:
        raise RuntimeError("文本模型 API Key 池为空")
    errors = []
    model_candidates: list[str] = [model]
    model_list: list[str] = []
    for key_index, key in enumerate(keys, 1):
        for candidate in model_candidates:
            try:
                return caller(api_url, key, candidate, payload), candidate
            except Exception as exc:
                errors.append(f"Key {key_index} {mask_secret(key)} / {candidate}: {exc}")
                if key_index == 1 and candidate == model and is_model_unavailable_error(exc):
                    try:
                        model_list, _resolved_url, _route_kind = fetch_custom_models_by_kind("text", api_url, "")
                        model_candidates = preferred_text_models(model_list, model) or [model]
                    except Exception:
                        model_candidates = [model]
                continue
    for candidate in [item for item in preferred_text_models(model_list, model) if item != model]:
        for key_index, key in enumerate(keys, 1):
            try:
                return caller(api_url, key, candidate, payload), candidate
            except Exception as exc:
                errors.append(f"Key {key_index} {mask_secret(key)} / {candidate}: {exc}")
                if not is_model_unavailable_error(exc):
                    continue
    raise RuntimeError(redact_secrets("文本模型 Key 池都不可用：" + " | ".join(errors[:8])))


def call_pool_text_model_with_fallback(
    model: str,
    messages: list[dict],
    normalize,
    payload,
) -> tuple[dict, str]:
    errors = []
    candidates = available_pool_text_models(model)
    if model and model not in candidates:
        candidates.insert(0, model)
    for candidate in candidates:
        try:
            return call_pool_text_model_once(candidate, messages, normalize, payload)
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
            if not is_model_unavailable_error(exc):
                raise
    raise RuntimeError(redact_secrets("号池文本模型池都不可用：" + " | ".join(errors[:6])))


def call_research_text_model_with_fallback(api_url: str, api_key: str, model: str, payload: dict) -> tuple[dict, str]:
    errors = []
    try:
        return call_research_text_model(api_url, api_key, model, payload), model
    except Exception as exc:
        if not is_model_unavailable_error(exc):
            raise
        errors.append(f"{model}: {exc}")
    try:
        model_list, _resolved_url, _route_kind = fetch_custom_models_by_kind("text", api_url, api_key)
    except Exception as exc:
        raise RuntimeError(redact_secrets("所选文本模型不可用，且刷新文本模型列表失败：" + str(exc)))
    candidates = [item for item in preferred_research_text_models(model_list, model) if item != model]
    for candidate in candidates:
        try:
            return call_research_text_model(api_url, api_key, candidate, payload), candidate
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
            if not is_model_unavailable_error(exc):
                break
    raise RuntimeError(redact_secrets("文本模型都不可用：" + " | ".join(errors[:6])))


def call_research_text_model_with_key_pool(api_url: str, api_keys: list[str], model: str, payload: dict) -> tuple[dict, str]:
    keys = [str(key or "").strip() for key in api_keys if str(key or "").strip()]
    if not keys:
        raise RuntimeError("文本模型 API Key 池为空")
    errors = []
    model_candidates: list[str] = [model]
    model_list: list[str] = []
    for key_index, key in enumerate(keys, 1):
        for candidate in model_candidates:
            try:
                return call_research_text_model(api_url, key, candidate, payload), candidate
            except Exception as exc:
                errors.append(f"Key {key_index} {mask_secret(key)} / {candidate}: {exc}")
                if key_index == 1 and candidate == model and is_model_unavailable_error(exc):
                    try:
                        model_list, _resolved_url, _route_kind = fetch_custom_models_by_kind("text", api_url, "")
                        model_candidates = preferred_research_text_models(model_list, model) or [model]
                    except Exception:
                        model_candidates = [model]
                continue
    for candidate in [item for item in preferred_research_text_models(model_list, model) if item != model]:
        for key_index, key in enumerate(keys, 1):
            try:
                return call_research_text_model(api_url, key, candidate, payload), candidate
            except Exception as exc:
                errors.append(f"Key {key_index} {mask_secret(key)} / {candidate}: {exc}")
    raise RuntimeError(redact_secrets("文本模型 Key 池都不可用：" + " | ".join(errors[:8])))


def call_research_text_model_with_pool(model: str, payload: dict) -> dict:
    account = pick_pool_account()
    token = account["access_token"]
    try:
        client = ChatGptImageClient(token)
        client.bootstrap()
        resp = client.start_text_generation(model, build_research_plan_messages(payload), client.chat_requirements())
        content = collect_pool_text_response(resp)
        if not content:
            raise RuntimeError("号池文本模型没有返回内容")
        plan = normalize_research_plan(extract_json_object(content), payload)
        mark_pool_account_result(token, True)
        return plan
    except Exception as exc:
        mark_pool_account_result(token, False, redact_secrets(str(exc)))
        raise


def is_image_channel_unavailable_error(exc: Exception) -> bool:
    text = str(exc or "").lower()
    return (
        "image_generation tool not found" in text
        or "tool choice" in text and "image_generation" in text
        or "model_not_found" in text
        or "no available channel" in text
        or "no channel" in text
        or "model not found" in text
    )


def preferred_research_image_models(models: list[str], selected: str = "") -> list[str]:
    cleaned = []
    for model in models:
        model = str(model or "").strip()
        if model and model not in cleaned and is_image_model_id(model):
            cleaned.append(model)
    priority = ["gpt-image-1.5", "gpt-image-1", "gpt-image-2", "imagen-4", "flux"]
    selected = str(selected or "").strip()
    ordered = []
    if selected and selected in cleaned:
        ordered.append(selected)
    lower_map = {model.lower(): model for model in cleaned}
    for item in priority:
        model = lower_map.get(item)
        if model and model not in ordered:
            ordered.append(model)
    for model in cleaned:
        if model not in ordered:
            ordered.append(model)
    return ordered


def generate_one(job: dict, prompt: str, index: int) -> list[dict]:
    if str(job.get("connection_mode") or "").strip() == "pool":
        return generate_one_with_pool(job, prompt, index)
    api_base = job_api_base(job)
    api_key = str(job.get("api_key") or "")
    if job.get("api_key_source") == "debug_admin_config":
        route_url, route_key, _route_kind = custom_model_route_credentials(read_model_config(), "image", index)
        api_base = normalize_api_base(route_url or api_base)
        api_key = route_key or api_key
    headers = {"Authorization": bearer_token(api_key)}
    reference_ids = job.get("reference_ids") or []
    references = [r for r in read_references() if r.get("id") in reference_ids]
    use_edit = job.get("edit_mode") and references
    if use_edit:
        resp = post_image_edit(api_base, headers, job, prompt, references)
    else:
        request_options, request_meta = normalize_image_request_options(job, "/v1/images/generations")
        upstream_payload = {
            "model": request_options["model"],
            "prompt": prompt,
            "n": 1,
            "size": request_options["size"],
        }
        if references:
            upstream_payload["reference_images"] = [reference_to_data_url(ref) for ref in references[:4]]
            upstream_payload["reference_images"] = [item for item in upstream_payload["reference_images"] if item]
        if request_options.get("quality") and request_options["quality"] != "auto":
            upstream_payload["quality"] = request_options["quality"]
        for key in ("output_format", "output_compression", "background", "moderation"):
            if request_options.get(key):
                upstream_payload[key] = request_options[key]
        record_job_request_params(job["id"], {
            **request_meta,
            "aspect_ratio": job.get("aspect_ratio") or "1:1",
            "resolution": job.get("resolution") or "1K",
            "reference_count": len(upstream_payload.get("reference_images") or []),
        })
        resp = requests.post(
            urljoin(api_base + "/", "v1/images/generations"),
            headers={**headers, "Content-Type": "application/json"},
            json=upstream_payload,
            timeout=REQUEST_TIMEOUT,
        )
    if resp.status_code >= 400:
        raise RuntimeError(redact_secrets(f"New API {resp.status_code}: {resp.text[:1000]}"))
    data = resp.json()
    merge_job_usage(job["id"], data.get("usage"))
    update_job(job["id"], {"revised_prompt": data.get("revised_prompt")})
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
        raw_prompt = str(job.get("prompt") or "").strip()
        if not raw_prompt:
            raise RuntimeError("提示词为空")
        count = max(1, min(int(job.get("count") or 1), 20))
        variants = job.get("variants") or []
        prompt_items = [str(item).strip() for item in job.get("prompt_variants") or [] if str(item).strip()]
        if prompt_items:
            count = len(prompt_items[:20])
            update_job(job_id, {"count": count})
        estimate = estimate_cost(job.get("model", ""), count)
        update_job(job_id, {"cost": estimate})
        prompts: list[str] = []
        if prompt_items:
            prompts = [build_prompt_with_base(job, prompt) for prompt in prompt_items[:count]]
        elif variants:
            base_prompt = build_prompt(job)
            for variant in variants[:count]:
                prompts.append(f"{base_prompt}\n画面分镜：{variant}")
        else:
            base_prompt = build_prompt(job)
            prompts = [base_prompt for _ in range(count)]
        retry_limit = max(0, min(int(job.get("retry_limit") or 0), 5))
        concurrency = max(1, min(int(job.get("count") or len(prompts) or 1), len(prompts), 20))
        model_candidates = [str(job.get("model") or DEFAULT_MODEL).strip()]

        def generate_prompt_index(item: tuple[int, str]) -> list[dict]:
            idx, prompt = item
            last_error = ""
            for attempt in range(retry_limit + 1):
                attempt_text = f" · 重试 {attempt}/{retry_limit}" if attempt else ""
                update_job(job_id, {
                    "progress": {
                        "done": len(created_media),
                        "total": len(prompts),
                        "message": f"生成第 {idx + 1}/{len(prompts)} 张{attempt_text} · 并发 {concurrency}",
                    },
                    "last_attempt": attempt + 1,
                })
                try:
                    return generate_one(job, prompt, idx)
                except Exception as exc:
                    last_error = str(exc)
                    if is_image_channel_unavailable_error(exc):
                        try:
                            model_list, _resolved_url, _route_kind = fetch_custom_models_by_kind("image", "", "")
                            for candidate in preferred_research_image_models(model_list, job.get("model") or DEFAULT_MODEL):
                                if candidate not in model_candidates:
                                    model_candidates.append(candidate)
                        except Exception:
                            pass
                        next_model = next((model for model in model_candidates if model != job.get("model")), "")
                        if next_model:
                            update_job(job_id, {
                                "model": next_model,
                                "error": f"{last_error}；已自动切换生图模型到 {next_model} 重试",
                            })
                            job["model"] = next_model
                            continue
                    update_job(job_id, {"error": last_error})
                    if attempt >= retry_limit:
                        raise
                    time.sleep(min(10, 1.6 * (attempt + 1)))
            raise RuntimeError(last_error or "生成失败")

        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(generate_prompt_index, item) for item in enumerate(prompts)]
            for future in as_completed(futures):
                new_media = future.result()
                created_media.extend(new_media)
                done_count = min(len(created_media), len(prompts))
                with state_lock:
                    media = read_media()
                    media.extend(new_media)
                    unique = {item["id"]: item for item in media}
                    write_media(list(unique.values()))
                update_job(job_id, {
                    "progress": {
                        "done": done_count,
                        "total": len(prompts),
                        "message": f"已完成 {done_count}/{len(prompts)} 张 · 并发 {concurrency}",
                    }
                })
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
    recover_interrupted_jobs()
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
        default_custom_api_url=DEFAULT_CUSTOM_API_URL,
        model_config=public_model_config(model_config),
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
            if not password:
                password = read_admin_auth().get("password", "")
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
                    "label": existing.get("label") or ("自定义 API" if key == "custom" else "本地号池"),
                    "badge": existing.get("badge") or ("云端" if key == "custom" else "OAuth"),
                    "url": existing.get("url", ""),
                    "description": existing.get("description", ""),
                    "enabled": True,
                }
                if key == "custom":
                    posted_key = request.form.get("custom_api_key", "").strip()
                    keep_existing = request.form.get("keep_custom_api_key") == "on"
                    connections[key]["api_key"] = existing.get("api_key", "") if keep_existing and not posted_key else posted_key
            current_routes = current.get("custom_model_routes") or {}
            custom_model_routes = {}
            for kind in ("image", "text"):
                custom_model_routes[kind] = {
                    "label": request.form.get(f"{kind}_route_label", "生图模型接入" if kind == "image" else "文本模型接入").strip(),
                    "url": request.form.get(f"{kind}_route_url", "").strip(),
                    "api_keys": merge_route_secrets(
                        current_routes,
                        kind,
                        request.form.get(f"{kind}_route_api_keys", ""),
                        request.form.get(f"keep_{kind}_route_api_key") == "on",
                    ),
                    "enabled": request.form.get(f"{kind}_route_enabled") == "on",
                }
                custom_model_routes[kind]["api_key"] = custom_model_routes[kind]["api_keys"][0] if custom_model_routes[kind]["api_keys"] else ""
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
            model_providers = []
            provider_ids = request.form.getlist("provider_id")
            provider_names = request.form.getlist("provider_name")
            provider_kinds = request.form.getlist("provider_kind")
            provider_patterns_list = request.form.getlist("provider_patterns")
            enabled_provider_ids = set(request.form.getlist("provider_enabled"))
            deleted_provider_ids = set(request.form.getlist("provider_delete"))
            for index, provider_id in enumerate(provider_ids):
                name = provider_names[index].strip() if index < len(provider_names) else ""
                kind = provider_kinds[index].strip() if index < len(provider_kinds) else "image"
                patterns = provider_patterns_list[index].strip() if index < len(provider_patterns_list) else ""
                provider_id = provider_id.strip() or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or uuid.uuid4().hex[:10]
                if provider_id in deleted_provider_ids:
                    continue
                if not name or not patterns:
                    continue
                model_providers.append({
                    "id": provider_id,
                    "name": name,
                    "kind": kind if kind in {"image", "text", "both"} else "image",
                    "patterns": patterns,
                    "enabled": provider_id in enabled_provider_ids,
                })
            new_provider_name = request.form.get("new_provider_name", "").strip()
            new_provider_patterns = request.form.get("new_provider_patterns", "").strip()
            if new_provider_name and new_provider_patterns:
                new_provider_id = re.sub(r"[^a-z0-9]+", "-", new_provider_name.lower()).strip("-") or uuid.uuid4().hex[:10]
                existing_ids = {item["id"] for item in model_providers}
                if new_provider_id in existing_ids:
                    new_provider_id = f"{new_provider_id}-{uuid.uuid4().hex[:6]}"
                new_provider_kind = request.form.get("new_provider_kind", "image").strip()
                model_providers.append({
                    "id": new_provider_id,
                    "name": new_provider_name,
                    "kind": new_provider_kind if new_provider_kind in {"image", "text", "both"} else "image",
                    "patterns": new_provider_patterns,
                    "enabled": request.form.get("new_provider_enabled") == "on",
                })
            config = {
                "default_connection_mode": request.form.get("default_connection_mode", "custom"),
                "auto_order": [],
                "connections": connections,
                "custom_model_routes": custom_model_routes,
                "model_profiles": profiles,
                "model_providers": model_providers,
                "debug": {
                    "workbench_custom_api": request.form.get("workbench_custom_api_debug") == "on",
                },
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
                message = f"导入失败：{redact_secrets(str(exc))}"
            saved = True
        elif action == "update_account":
            target_id = request.form.get("target_account_id", "")
            updated = []
            target_mask = ""
            for item in accounts:
                if item.get("id") == target_id:
                    target_mask = item.get("token_mask", "")
                    item = {
                        **item,
                        "status": request.form.get("status", item.get("status", "正常")),
                        "type": request.form.get("type", item.get("type", "openai")),
                        "quota": request.form.get("quota", item.get("quota", 0)),
                        "note": request.form.get("note", item.get("note", "")),
                    }
                updated.append(item)
            write_account_pool(updated)
            admin_log("更新账号状态", {"account": target_mask or target_id})
            message = "账号状态已更新。"
            saved = True
        elif action == "delete_accounts":
            targets = set(request.form.getlist("account_id"))
            write_account_pool([item for item in accounts if item.get("id") not in targets])
            admin_log("删除账号", {"count": len(targets)})
            message = f"已删除 {len(targets)} 个账号。"
            saved = True
        elif action == "refresh_selected_accounts":
            target_ids = request.form.getlist("account_id") or [request.form.get("target_account_id", "")]
            targets = account_ids_to_tokens(accounts, target_ids)
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
            current_sub2api = current.get("sub2api") or {}
            next_integrations = {
                **current,
                "sub2api": {
                    "name": request.form.get("sub2api_name", ""),
                    "base_url": request.form.get("sub2api_base_url", ""),
                    "auth_method": request.form.get("sub2api_auth_method", "password"),
                    "username": request.form.get("sub2api_username", ""),
                    "password": merge_secret_field(current_sub2api.get("password", ""), request.form.get("sub2api_password", "")),
                    "api_key": merge_secret_field(current_sub2api.get("api_key", ""), request.form.get("sub2api_api_key", "")),
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
                    message = f"读取 Sub2API 失败：{redact_secrets(str(exc))}"
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
            current_cpa = current.get("cpa") or {}
            next_integrations = {
                **current,
                "cpa": {
                    "name": request.form.get("cpa_name", ""),
                    "base_url": request.form.get("cpa_base_url", ""),
                    "secret_key": merge_secret_field(current_cpa.get("secret_key", ""), request.form.get("cpa_secret_key", "")),
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
                    message = f"读取 CPA 失败：{redact_secrets(str(exc))}"
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
            current = read_integration_config()
            current_sub2api = current.get("sub2api") or {}
            current_cpa = current.get("cpa") or {}
            next_integrations = {
                "sub2api": {
                    "name": request.form.get("sub2api_name", ""),
                    "base_url": request.form.get("sub2api_base_url", ""),
                    "auth_method": request.form.get("sub2api_auth_method", "password"),
                    "username": request.form.get("sub2api_username", ""),
                    "password": merge_secret_field(current_sub2api.get("password", ""), request.form.get("sub2api_password", "")),
                    "api_key": merge_secret_field(current_sub2api.get("api_key", ""), request.form.get("sub2api_api_key", "")),
                    "group_id": request.form.get("sub2api_group_id", ""),
                },
                "cpa": {
                    "name": request.form.get("cpa_name", ""),
                    "base_url": request.form.get("cpa_base_url", ""),
                    "secret_key": merge_secret_field(current_cpa.get("secret_key", ""), request.form.get("cpa_secret_key", "")),
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
                message = f"Sub2API 同步失败：{redact_secrets(str(exc))}"
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
                message = f"CPA 同步失败：{redact_secrets(str(exc))}"
            saved = True
        elif action == "toggle_media_archive":
            enabled = not read_admin_settings().get("save_generated_images", True)
            write_admin_settings({"save_generated_images": enabled})
            admin_log("更新图片保存开关", {"save_generated_images": enabled})
            message = "图片保存已开启。" if enabled else "图片保存已关闭，新生成图片不会进入后台图片管理。"
            saved = True
        elif action == "save_log_retention":
            days = normalize_admin_log_retention_days(request.form.get("admin_log_retention_days"))
            write_admin_settings({"admin_log_retention_days": days})
            with state_lock:
                write_json(ADMIN_LOGS_FILE, clean_admin_logs(read_json(ADMIN_LOGS_FILE, []), days))
            admin_log("update admin log retention", {"days": days})
            message = f"日志保留时间已更新为 {days} 天。" if days else "日志已关闭按时间清理，仅保留最近 300 条。"
            saved = True
        elif action in {"hide_square_items", "delete_square_items", "restore_square_items", "toggle_square_featured"}:
            target_id = request.form.get("target_square_id", "").strip()
            square_ids = set(request.form.getlist("square_id"))
            if target_id:
                square_ids.add(target_id)
            if not square_ids:
                message = "没有选择广场图片。"
            else:
                with state_lock:
                    square_items = read_square()
                    changed = 0
                    if action == "delete_square_items":
                        before = len(square_items)
                        square_items = [item for item in square_items if str(item.get("id") or "") not in square_ids]
                        changed = before - len(square_items)
                    else:
                        for item in square_items:
                            if str(item.get("id") or "") not in square_ids:
                                continue
                            if action == "toggle_square_featured":
                                item["featured"] = not bool(item.get("featured"))
                            elif action == "restore_square_items":
                                item["status"] = "visible"
                            elif action == "hide_square_items":
                                item["status"] = "hidden"
                            item["updated_at"] = now_ts()
                            changed += 1
                    write_square(square_items)
                admin_log("update square items", {"action": action, "count": changed})
                message = f"广场图片已处理 {changed} 条。"
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
    profile_model_ids = [str(item.get("id") or "").strip() for item in config.get("model_profiles", []) if str(item.get("id") or "").strip()]
    profile_image_models, profile_text_models = split_model_ids(profile_model_ids)
    accounts = read_account_pool()
    pool_users = read_pool_users()
    admin_settings = read_admin_settings()
    all_media_items = read_media()
    ensure_media_thumbs(all_media_items, persist=True)
    media_items = sorted(
        [item for item in all_media_items if item.get("admin_visible", True)],
        key=lambda x: x.get("created_at", 0),
        reverse=True,
    )
    media_archive_groups = []
    media_archive_map = {}
    for item in media_items:
        try:
            day_key = time.strftime("%Y-%m-%d", time.localtime(int(item.get("created_at") or 0)))
            day_label = time.strftime("%Y年%m月%d日", time.localtime(int(item.get("created_at") or 0)))
        except (TypeError, ValueError):
            day_key = "unknown"
            day_label = "未知日期"
        if day_key not in media_archive_map:
            media_archive_map[day_key] = {"key": day_key, "label": day_label, "media": []}
            media_archive_groups.append(media_archive_map[day_key])
        media_archive_map[day_key]["media"].append(item)
    jobs = sorted(public_jobs(read_jobs()), key=lambda x: x.get("created_at", 0), reverse=True)
    square_items = sorted(ensure_square_thumbs(read_square(), persist=True), key=lambda x: x.get("created_at", 0), reverse=True)
    with state_lock:
        cleaned_logs = clean_admin_logs(read_json(ADMIN_LOGS_FILE, []), admin_settings.get("admin_log_retention_days"))
        write_json(ADMIN_LOGS_FILE, cleaned_logs)
    logs = sorted(redact_secrets(cleaned_logs), key=lambda x: x.get("created_at", 0), reverse=True)
    integrations = read_integration_config()
    return render_template(
        "admin.html",
        config=config,
        custom_api_key_mask=mask_secret(admin_custom_api_credentials(config)[1]),
        route_key_masks={
            kind: mask_secret(((config.get("custom_model_routes") or {}).get(kind) or {}).get("api_key") or "")
            for kind in ("image", "text")
        },
        route_key_summaries={
            kind: mask_secret_list(((config.get("custom_model_routes") or {}).get(kind) or {}).get("api_keys") or [])
            for kind in ("image", "text")
        },
        profile_lines=profile_lines,
        profile_model_ids=profile_model_ids,
        profile_image_models=profile_image_models,
        profile_text_models=profile_text_models,
        saved=saved,
        message=message,
        admin_auth=public_admin_auth(),
        admin_settings=admin_settings,
        accounts=accounts,
        account_stats=account_stats(accounts),
        pool_users=pool_users,
        pool_user_stats=pool_user_stats(pool_users),
        integrations=integrations,
        integration_masks=integration_secret_masks(integrations),
        default_custom_api_url=DEFAULT_CUSTOM_API_URL,
        media_items=media_items,
        media_archive_groups=media_archive_groups,
        square_items=square_items,
        jobs=jobs[:80],
        logs=logs[:120],
        sub2api_remote_accounts=sub2api_remote_accounts,
        cpa_remote_files=cpa_remote_files,
        sync_errors=sync_errors,
    )


@app.get("/media/<path:filename>")
def media_file(filename):
    return send_from_directory(MEDIA_DIR, filename)


@app.get("/thumbs/<path:filename>")
def thumb_file(filename):
    return send_from_directory(THUMB_DIR, filename, mimetype="image/webp" if filename.endswith(".webp") else None)


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "models": available_model_ids(),
        "new_api_base": NEW_API_BASE,
        "model_config": public_model_config(read_model_config()),
    })


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
        "model_config": public_model_config(read_model_config()),
        "account_pool": account_stats(read_account_pool()),
        "pool_user": public_pool_user(current_pool_user()),
        "pool_users": pool_user_stats(read_pool_users()),
    })


@app.get("/api/square")
def square_list():
    sort = str(request.args.get("sort") or "latest").strip().lower()
    period = str(request.args.get("period") or "").strip().lower()
    now = now_ts()
    min_ts = 0
    if period == "week":
        min_ts = now - 7 * 86400
    elif period == "month":
        min_ts = now - 31 * 86400
    square_items = ensure_square_thumbs(read_square(), persist=True)
    items = [item for item in square_items if item.get("status") != "hidden" and (not min_ts or int(item.get("created_at") or 0) >= min_ts)]
    if sort == "hot":
        items.sort(key=lambda x: (int(x.get("likes") or 0), int(x.get("views") or 0), int(x.get("created_at") or 0)), reverse=True)
    elif sort == "featured":
        items.sort(key=lambda x: (bool(x.get("featured")), int(x.get("likes") or 0), int(x.get("created_at") or 0)), reverse=True)
    else:
        items.sort(key=lambda x: int(x.get("created_at") or 0), reverse=True)
    return jsonify({"items": [public_square_item(item) for item in items[:80]], "total": len(items)})


@app.post("/api/square/recommend")
def square_recommend():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    media_id = str(payload.get("media_id") or "").strip()
    if not media_id:
        return jsonify({"error": "缺少图片 ID"}), 400
    client_id = current_client_id()
    media = next((item for item in client_media(client_id) if str(item.get("id") or "") == media_id), None)
    if not media or not media.get("url"):
        return jsonify({"error": "只能推荐当前工作台中已成功保存的图片"}), 404
    jobs_by_id = {str(job.get("id") or ""): job for job in client_jobs(client_id)}
    with state_lock:
        items = read_square()
        existing = next((item for item in items if str(item.get("media_id") or "") == media_id and item.get("status") != "hidden"), None)
        if existing:
            ensure_square_thumb(existing)
            return jsonify({"item": public_square_item(existing), "ok": True, "duplicate": True})
        item = square_item_for_media(media, jobs_by_id.get(str(media.get("job_id") or "")), client_id)
        items.append(item)
        write_square(items)
    return jsonify({"item": public_square_item(item), "ok": True})


@app.post("/api/square/like")
def square_like():
    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("id") or "").strip()
    if not item_id:
        return jsonify({"error": "缺少作品 ID"}), 400
    client_id = current_client_id()
    with state_lock:
        items = read_square()
        target = next((item for item in items if str(item.get("id") or "") == item_id and item.get("status") != "hidden"), None)
        if not target:
            return jsonify({"error": "作品不存在"}), 404
        liked_by = set(target.get("liked_by") if isinstance(target.get("liked_by"), list) else [])
        if client_id in liked_by:
            liked_by.remove(client_id)
        else:
            liked_by.add(client_id)
        target["liked_by"] = sorted(liked_by)
        target["likes"] = len(liked_by)
        target["updated_at"] = now_ts()
        write_square(items)
    return jsonify({"item": public_square_item(target), "liked": client_id in liked_by})


@app.post("/api/models")
def models():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    api_key = str(payload.get("api_key") or "").strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    model_kind = str(payload.get("model_kind") or "image").strip()
    if model_kind not in {"image", "text", "both"}:
        model_kind = "image"
    pool_user = None
    api_url = str(payload.get("api_url") or "").strip()
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
    try:
        if model_kind == "both":
            if not custom_api_debug_enabled():
                model_kind = "image"
            else:
                image_list, image_url, image_route = fetch_custom_models_by_kind("image", api_url, api_key)
                text_list, text_url, text_route = fetch_custom_models_by_kind("text", "", "")
                image_models = split_model_ids(image_list)[0]
                text_models = split_model_ids(text_list)[1]
                return jsonify({
                    "ok": True,
                    "models": sorted(set(image_list + text_list)),
                    "image_models": image_models,
                    "text_models": text_models,
                    "api_url": image_url,
                    "text_api_url": text_url,
                    "route_kind": image_route,
                    "text_route_kind": text_route,
                })
        model_list, resolved_url, route_kind = fetch_custom_models_by_kind(model_kind, api_url, api_key)
        image_models, text_models = split_model_ids(model_list)
        return jsonify({
            "ok": True,
            "models": model_list,
            "image_models": image_models if model_kind == "image" else [],
            "text_models": text_models if model_kind == "text" else text_models,
            "api_url": resolved_url,
            "route_kind": route_kind,
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": "模型读取失败", "detail": redact_secrets(str(exc))}), 502
@app.get("/api/debug/custom-api")
def debug_custom_api():
    auth = login_required_json()
    if auth:
        return auth
    config = read_model_config()
    debug_enabled = custom_api_debug_enabled(config)
    image_url, image_key, image_route_kind = custom_model_route_credentials(config, "image")
    text_url, text_key, text_route_kind = custom_model_route_credentials(config, "text")
    return jsonify({
        "ok": True,
        "enabled": debug_enabled,
        "api_url": image_url if debug_enabled else "",
        "has_api_key": bool(image_key) if debug_enabled else False,
        "routes": {
            "image": {
                "api_url": image_url if debug_enabled else "",
                "has_api_key": bool(image_key) if debug_enabled else False,
                "route_kind": image_route_kind if debug_enabled else "",
            },
            "text": {
                "api_url": text_url if debug_enabled else "",
                "has_api_key": bool(text_key) if debug_enabled else False,
                "route_kind": text_route_kind if debug_enabled else "",
            },
        },
    })


@app.post("/api/agent-plan")
def agent_plan():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    text_custom_fallback = bool(payload.get("text_custom_fallback"))
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    if not model:
        return jsonify({"error": "请先选择或填写 Agent 文本模型"}), 400
    try:
        if connection_mode == "pool" and not text_custom_fallback:
            pool_user, pool_error = require_pool_user_json()
            if pool_error:
                return pool_error
            if not pool_available_accounts():
                return jsonify({"ok": False, "error": "本地号池没有可用账号", "detail": "请先到管理后台导入并刷新可用号池账号"}), 200
            plan, model = call_pool_text_model_with_fallback(
                model,
                build_agent_plan_messages(payload),
                lambda plan, values: normalize_agent_plan(plan, values.get("values") if isinstance(values.get("values"), dict) else {}),
                payload,
            )
        else:
            requested_api_key = api_key
            api_url, api_key, used_debug_key, _route_kind = resolve_custom_api_credentials(api_url, api_key, "text")
            if not api_url:
                return jsonify({"error": "请先填写文本模型 API URL"}), 400
            if not api_key:
                return jsonify({"error": "请先填写文本模型 API Key"}), 400
            if used_debug_key and not requested_api_key:
                route_url, route_keys, _route_kind = custom_model_route_key_pool(read_model_config(), "text", include_legacy=True)
                api_url = route_url or api_url
                plan, model = call_custom_text_model_with_key_pool(api_url, route_keys or [api_key], model, payload, call_agent_text_model)
            else:
                plan, model = call_custom_text_model_with_fallback(api_url, api_key, model, payload, call_agent_text_model)
        return jsonify({"ok": True, "plan": plan, "model": model})
    except Exception as exc:
        return jsonify({"ok": False, "error": "Agent 文本模型生成失败", "detail": redact_secrets(str(exc))}), 200


@app.post("/api/commerce-analysis-chat")
def commerce_analysis_chat():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message") or "").strip()
    reference_ids = [str(item).strip() for item in payload.get("reference_ids", []) if str(item).strip()][:4]
    if not message and not reference_ids:
        return jsonify({"error": "请先输入问题或上传图片"}), 400
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    if not model:
        return jsonify({"error": "请先填写文本模型"}), 400
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    requested_api_key = api_key
    try:
        api_url, api_key, used_debug_key, _route_kind = resolve_custom_api_credentials(api_url, api_key, "text")
        if not api_url:
            return jsonify({"error": "请先填写文本模型 API URL"}), 400
        if not api_key:
            return jsonify({"error": "请先填写文本模型 API Key"}), 400
        client_id = current_client_id()
        allowed_refs = {str(item.get("id") or ""): item for item in client_references(client_id)}
        references = [allowed_refs[item] for item in reference_ids if item in allowed_refs][:4]
        if used_debug_key and not requested_api_key:
            route_url, route_keys, _route_kind = custom_model_route_key_pool(read_model_config(), "text", include_legacy=True)
            api_url = route_url or api_url
            last_error = ""
            for key in route_keys or [api_key]:
                try:
                    reply = call_commerce_analysis_text_model(api_url, key, model, payload, references)
                    return jsonify({"ok": True, "reply": reply, "model": model})
                except Exception as exc:
                    last_error = str(exc)
            raise RuntimeError(last_error or "文本模型调用失败")
        reply = call_commerce_analysis_text_model(api_url, api_key, model, payload, references)
        return jsonify({"ok": True, "reply": reply, "model": model})
    except Exception as exc:
        return jsonify({"ok": False, "error": "AI 对话失败", "detail": redact_secrets(str(exc))}), 200


@app.post("/api/agent-mode-plan")
def agent_mode_plan():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    text_custom_fallback = bool(payload.get("text_custom_fallback"))
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    if not model:
        return jsonify({"error": "请先选择或填写 Agent 文本模型"}), 400
    try:
        if connection_mode == "pool" and not text_custom_fallback:
            pool_user, pool_error = require_pool_user_json()
            if pool_error:
                return pool_error
            if not pool_available_accounts():
                return jsonify({"ok": False, "error": "本地号池没有可用账号", "detail": "请先到管理后台导入并刷新可用号池账号"}), 200
            plan, model = call_pool_text_model_with_fallback(
                model,
                build_agent_mode_messages(payload),
                lambda plan, _payload: normalize_agent_mode_plan(plan, str(payload.get("prompt") or "")),
                payload,
            )
        else:
            requested_api_key = api_key
            api_url, api_key, used_debug_key, _route_kind = resolve_custom_api_credentials(api_url, api_key, "text")
            if not api_url:
                return jsonify({"error": "请先填写文本模型 API URL"}), 400
            if not api_key:
                return jsonify({"error": "请先填写文本模型 API Key"}), 400
            if used_debug_key and not requested_api_key:
                route_url, route_keys, _route_kind = custom_model_route_key_pool(read_model_config(), "text", include_legacy=True)
                api_url = route_url or api_url
                plan, model = call_custom_text_model_with_key_pool(api_url, route_keys or [api_key], model, payload, call_agent_mode_text_model)
            else:
                plan, model = call_custom_text_model_with_fallback(api_url, api_key, model, payload, call_agent_mode_text_model)
        return jsonify({"ok": True, "plan": plan, "model": model})
    except Exception as exc:
        return jsonify({"ok": False, "error": "Agent 模式 A 拆解失败", "detail": redact_secrets(str(exc))}), 200

@app.post("/api/prompt-analysis")
def prompt_analysis():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    text_custom_fallback = bool(payload.get("text_custom_fallback"))
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    if not model:
        return jsonify({"error": "请先选择或填写文本分析模型"}), 400
    try:
        if connection_mode == "pool" and not text_custom_fallback:
            pool_user, pool_error = require_pool_user_json()
            if pool_error:
                return pool_error
            if not pool_available_accounts():
                return jsonify({"ok": False, "error": "本地号池没有可用账号", "detail": "请先到管理后台导入并刷新可用号池账号"}), 200
            plan, model = call_pool_text_model_with_fallback(
                model,
                build_prompt_analysis_messages(payload),
                normalize_prompt_analysis_plan,
                payload,
            )
        else:
            requested_api_key = api_key
            api_url, api_key, used_debug_key, _route_kind = resolve_custom_api_credentials(api_url, api_key, "text")
            if not api_url:
                return jsonify({"error": "请先填写文本模型 API URL"}), 400
            if not api_key:
                return jsonify({"error": "请先填写文本模型 API Key"}), 400
            if used_debug_key and not requested_api_key:
                route_url, route_keys, _route_kind = custom_model_route_key_pool(read_model_config(), "text", include_legacy=True)
                api_url = route_url or api_url
                plan, model = call_custom_text_model_with_key_pool(api_url, route_keys or [api_key], model, payload, call_prompt_analysis_text_model)
            else:
                plan, model = call_custom_text_model_with_fallback(api_url, api_key, model, payload, call_prompt_analysis_text_model)
        return jsonify({"ok": True, "plan": plan, "model": model})
    except Exception as exc:
        return jsonify({"ok": False, "error": "文本分析失败", "detail": redact_secrets(str(exc))}), 200

@app.post("/api/research-plan")
def research_plan():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    subject = str(payload.get("subject") or "").strip()
    context = str(payload.get("context") or "").strip()
    if not subject and not context:
        return jsonify({"error": "请先填写论文摘要、实验步骤或课题材料"}), 400
    model = str(payload.get("text_model") or DEFAULT_TEXT_MODEL).strip()
    connection_mode = str(payload.get("connection_mode") or "custom").strip()
    text_custom_fallback = bool(payload.get("text_custom_fallback"))
    api_url = str(payload.get("text_api_url") or payload.get("api_url") or "").strip()
    api_key = str(payload.get("text_api_key") or payload.get("api_key") or "").strip()
    if not model:
        return jsonify({"error": "请先选择或填写科研工作台文本模型"}), 400
    try:
        if connection_mode == "pool" and not text_custom_fallback:
            pool_user, pool_error = require_pool_user_json()
            if pool_error:
                return pool_error
            if not pool_available_accounts():
                return jsonify({"ok": False, "error": "本地号池没有可用账号", "detail": "请先到管理员后台导入并刷新可用号池账号"}), 200
            plan, model = call_pool_text_model_with_fallback(
                model,
                build_research_plan_messages(payload),
                normalize_research_plan,
                payload,
            )
        else:
            requested_api_key = api_key
            api_url, api_key, used_debug_key, _route_kind = resolve_custom_api_credentials(api_url, api_key, "text")
            if not api_url:
                return jsonify({"error": "请先填写文本模型 API URL"}), 400
            if not api_key:
                return jsonify({"error": "请先填写文本模型 API Key"}), 400
            if used_debug_key and not requested_api_key:
                route_url, route_keys, _route_kind = custom_model_route_key_pool(read_model_config(), "text", include_legacy=True)
                api_url = route_url or api_url
                plan, model = call_research_text_model_with_key_pool(api_url, route_keys or [api_key], model, payload)
            else:
                plan, model = call_research_text_model_with_fallback(api_url, api_key, model, payload)
        return jsonify({"ok": True, "plan": plan, "model": model})
    except Exception as exc:
        return jsonify({"ok": False, "error": "科研工作台文本模型生成失败", "detail": redact_secrets(str(exc))}), 200


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
    used_debug_key = False
    if connection_mode == "pool":
        pool_user, pool_error = require_pool_user_json()
        if pool_error:
            return pool_error
    if connection_mode == "pool" and not pool_available_accounts():
        return jsonify({"error": "本地号池没有可用账号，请先到管理员号池导入账号并刷新额度"}), 400
    api_url = str(payload.get("api_url") or "").strip()
    if connection_mode == "custom":
        api_url, api_key, used_debug_key, route_kind = resolve_custom_api_credentials(api_url, api_key, "image")
        if not api_url:
            return jsonify({"error": "请先填写自定义 API URL"}), 400
        if not api_key:
            return jsonify({"error": "请先填写 API Key"}), 400
    else:
        route_kind = ""
    if connection_mode == "pool":
        resolved_api_url, resolve_errors = "local-account-pool", []
    else:
        resolved_api_url, resolve_errors = resolve_api_url(connection_mode, api_url, api_key)
    client_id = current_client_id()
    client_request_id = str(payload.get("client_request_id") or "").strip()[:120]
    workspace = normalize_workspace(payload.get("workspace"))
    if client_request_id:
        existing = next(
            (
                item for item in read_jobs()
                if matches_client(item, client_id)
                and str(item.get("client_request_id") or "") == client_request_id
            ),
            None,
        )
        if existing:
            return jsonify({"job": public_job(existing)})
    requested_model = str(payload.get("model") or DEFAULT_MODEL).strip()
    requested_job_options = {
        "model": requested_model,
        "aspect_ratio": str(payload.get("aspect_ratio") or "1:1").strip(),
        "resolution": str(payload.get("resolution") or "1K").strip(),
        "size": str(payload.get("size") or "1024x1024").strip(),
        "quality": str(payload.get("quality") or "auto").strip(),
        "output_format": str(payload.get("output_format") or "png").strip(),
        "background": str(payload.get("background") or "auto").strip(),
        "moderation": str(payload.get("moderation") or "auto").strip(),
        "output_compression": payload.get("output_compression") or "",
        "local_upscale": str(payload.get("local_upscale") or "none").strip(),
    }
    normalized_options, _normalized_meta = normalize_image_request_options(requested_job_options)
    job = {
        "id": uuid.uuid4().hex,
        "client_request_id": client_request_id,
        "client_id": client_id,
        "workspace": workspace,
        "mode": mode,
        "protocol": str(payload.get("protocol") or "custom-openai").strip(),
        "connection_mode": connection_mode,
        "api_url": api_url.rstrip("/") if api_url else resolved_api_url,
        "resolved_api_url": resolved_api_url,
        "api_key": api_key,
        "api_key_source": "debug_admin_config" if used_debug_key else ("user_input" if api_key else ""),
        "api_key_route": route_kind,
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
        "model": requested_model,
        "aspect_ratio": requested_job_options["aspect_ratio"],
        "resolution": requested_job_options["resolution"],
        "size": str(normalized_options.get("size") or requested_job_options["size"]),
        "quality": str(normalized_options.get("quality") or requested_job_options["quality"]),
        "output_format": str(normalized_options.get("output_format") or requested_job_options["output_format"]),
        "background": str(normalized_options.get("background") or requested_job_options["background"]),
        "moderation": str(normalized_options.get("moderation") or requested_job_options["moderation"]),
        "output_compression": str(normalized_options.get("output_compression") or requested_job_options["output_compression"]),
        "local_upscale": requested_job_options["local_upscale"],
        "count": count,
        "concurrency": count,
        "retry_limit": max(0, min(int(payload.get("retry_limit") or 2), 5)),
        "seed": str(payload.get("seed") or "").strip(),
        "variants": [str(v).strip() for v in payload.get("variants", []) if str(v).strip()],
        "prompt_variants": [str(v).strip() for v in payload.get("prompt_variants", []) if str(v).strip()][:20],
        "research_project_signature": str(payload.get("research_project_signature") or "").strip()[:1000],
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
    return jsonify({"job": public_job(job)})


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
    api_key = str(payload.get("api_key") or "").strip()
    connection_mode = str(payload.get("connection_mode") or source.get("connection_mode") or "custom").strip()
    pool_user = None
    used_debug_key = False
    if connection_mode == "pool":
        pool_user, pool_error = require_pool_user_json()
        if pool_error:
            return pool_error
    if connection_mode == "pool" and not pool_available_accounts():
        return jsonify({"error": "本地号池没有可用账号，请先到管理员号池导入账号并刷新额度"}), 400
    api_url = str(payload.get("api_url") or source.get("api_url") or "").strip()
    if connection_mode == "custom":
        api_url, api_key, used_debug_key, route_kind = resolve_custom_api_credentials(api_url, api_key, "image")
        if not api_url:
            return jsonify({"error": "请先填写自定义 API URL"}), 400
        if not api_key:
            return jsonify({"error": "请先填写 API Key"}), 400
    else:
        route_kind = ""
    if connection_mode == "pool":
        resolved_api_url, resolve_errors = "local-account-pool", []
    else:
        resolved_api_url, resolve_errors = resolve_api_url(connection_mode, api_url, api_key)
    retry_model = str(payload.get("model") or source.get("model") or DEFAULT_MODEL).strip()
    retry_options = {
        "model": retry_model,
        "aspect_ratio": str(source.get("aspect_ratio") or "1:1").strip(),
        "resolution": str(source.get("resolution") or "1K").strip(),
        "size": str(source.get("size") or "1024x1024").strip(),
        "quality": str(source.get("quality") or "auto").strip(),
        "output_format": str(source.get("output_format") or "png").strip(),
        "background": str(source.get("background") or "auto").strip(),
        "moderation": str(source.get("moderation") or "auto").strip(),
        "output_compression": source.get("output_compression") or "",
        "local_upscale": str(source.get("local_upscale") or "none").strip(),
    }
    normalized_retry_options, _retry_meta = normalize_image_request_options(retry_options)
    retry_count = int(source.get("retry_count") or 0) + 1
    retry_count_total = max(1, min(int(source.get("count") or 1), 20))
    job = {
        "id": uuid.uuid4().hex,
        "client_id": client_id,
        "workspace": job_workspace(source),
        "mode": str(source.get("mode") or "single"),
        "protocol": str(source.get("protocol") or "custom-openai").strip(),
        "connection_mode": connection_mode,
        "api_url": api_url.rstrip("/") if api_url else resolved_api_url,
        "resolved_api_url": resolved_api_url,
        "api_key": api_key,
        "api_key_source": "debug_admin_config" if used_debug_key else ("user_input" if api_key else ""),
        "api_key_route": route_kind,
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
        "model": retry_model,
        "aspect_ratio": retry_options["aspect_ratio"],
        "resolution": retry_options["resolution"],
        "size": str(normalized_retry_options.get("size") or retry_options["size"]),
        "quality": str(normalized_retry_options.get("quality") or retry_options["quality"]),
        "output_format": str(normalized_retry_options.get("output_format") or retry_options["output_format"]),
        "background": str(normalized_retry_options.get("background") or retry_options["background"]),
        "moderation": str(normalized_retry_options.get("moderation") or retry_options["moderation"]),
        "output_compression": str(normalized_retry_options.get("output_compression") or retry_options["output_compression"]),
        "local_upscale": retry_options["local_upscale"],
        "count": retry_count_total,
        "concurrency": retry_count_total,
        "retry_limit": max(0, min(int(payload.get("retry_limit") or source.get("retry_limit") or 2), 5)),
        "seed": str(source.get("seed") or "").strip(),
        "variants": [str(v).strip() for v in source.get("variants", []) if str(v).strip()],
        "reference_ids": [str(v).strip() for v in source.get("reference_ids", []) if str(v).strip()][:4],
        "edit_mode": bool(source.get("edit_mode")),
        "retry_of": job_id,
        "retry_count": retry_count,
        "status": "queued",
        "progress": {"done": 0, "total": retry_count_total, "message": "重试排队中"},
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
    return jsonify({"job": public_job(job)})


@app.post("/api/jobs/archive")
def archive_jobs():
    auth = login_required_json()
    if auth:
        return auth
    payload = request.get_json(silent=True) or {}
    job_ids = {str(item).strip() for item in payload.get("job_ids", []) if str(item).strip()}
    if not job_ids:
        return jsonify({"error": "请选择要归档的任务"}), 400
    archived = bool(payload.get("archived", True))
    client_id = current_client_id()
    updated = []
    now = now_ts()
    with state_lock:
        jobs = read_jobs()
        for job in jobs:
            if str(job.get("id") or "") not in job_ids:
                continue
            if not matches_client(job, client_id):
                continue
            if job_workspace(job) == "commerce" and str(job.get("client_id") or "").strip() != client_id:
                continue
            job["archived"] = archived
            if archived:
                job["archived_at"] = now
            else:
                job.pop("archived_at", None)
            job["updated_at"] = now
            updated.append(public_job(job))
        write_jobs(jobs)
    return jsonify({"ok": True, "jobs": updated})


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
