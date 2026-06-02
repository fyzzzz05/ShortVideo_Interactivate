"""统一配置加载 — 优先从 backend/.env 加载，兜底从当前目录/.env。"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# 确保能从 backend/ 根目录加载 .env
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _BACKEND_ROOT / ".env"
if _ENV_FILE.exists():
    load_dotenv(_ENV_FILE)
else:
    load_dotenv()

# 将 backend 加入 sys.path，使脚本可以直接 import app
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def get_required_env(name: str) -> str:
    """获取必需环境变量，缺失时抛出 RuntimeError。"""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def get_ark_api_key() -> str:
    return get_required_env("ARK_API_KEY")


def get_ark_base_url() -> str:
    return os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")


def get_ark_model() -> str:
    return get_required_env("ARK_MODEL")
