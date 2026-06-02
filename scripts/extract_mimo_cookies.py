#!/usr/bin/env python3
"""
通过 GNOME Keyring 直连 Brave Cookie 数据库解密，提取 platform.xiaomimimo.com cookies。
替代 CDP 方案 —— 不需要启动浏览器。

零外部依赖 —— 仅使用 sqlite3 / cryptography / secretstorage（系统预装）。

解密原理（与 Chrome/Brave 一致）：
  1. 从 GNOME Keyring 获取 "${Browser} Safe Storage" 条目值（base64 字符串）
  2. 作为 PBKDF2 密码，盐值 "saltysalt"，1 次迭代 → 16 字节 AES 密钥
  3. AES-CBC 解密，IV = 16 个空格（0x20）
  4. 跳过前 32 字节 SHA256 域哈希（数据库版本 >= 24）
  5. PKCS#7 去填充

输出格式（与旧 CDP 方案兼容）：
  {"cookie": "...", "browser": "Brave", "error": null}
"""

import json
import sqlite3
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.hashes import SHA1
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# ─── 浏览器配置 ───
# keyring_label 必须精确匹配 GNOME Keyring 中的条目名
BROWSER_INFO = {
    "brave": {
        "path": Path.home() / ".config" / "BraveSoftware" / "Brave-Browser" / "Default",
        "keyring_label": "Brave Safe Storage",
        "display": "Brave",
    },
    "chrome": {
        "path": Path.home() / ".config" / "google-chrome" / "Default",
        "keyring_label": "Chrome Safe Storage",
        "display": "Chrome",
    },
    "chromium": {
        "path": Path.home() / ".config" / "chromium" / "Default",
        "keyring_label": "Chromium Safe Storage",
        "display": "Chromium",
    },
}

TARGET_DOMAINS = ["platform.xiaomimimo.com", "xiaomimimo.com"]


def detect_browser() -> str:
    """检测有 cookie 数据库的浏览器，优先 Brave。"""
    for name in ("brave", "chrome", "chromium"):
        if (BROWSER_INFO[name]["path"] / "Cookies").exists():
            return name
    return "brave"


def get_key_material(keyring_label: str) -> str:
    """从 GNOME Keyring/libsecret 获取指定浏览器的加密密钥材料。

    密钥条目名必须是精确匹配的 keyring_label（如 "Brave Safe Storage"），
    而不是任意包含 "Safe Storage" 的条目。
    """
    import secretstorage

    conn = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(conn)

    for item in collection.get_all_items():
        label = item.get_label()
        if label == keyring_label:
            val = item.get_secret().decode("utf-8", errors="replace").strip()
            if val:
                return val

    raise RuntimeError(
        f"GNOME Keyring 中未找到条目 '{keyring_label}'。"
        f"请在浏览器中登录 platform.xiaomimimo.com 后再试。"
    )


def decrypt_value(encrypted_value: bytes, enc_key: bytes, db_version: int) -> str:
    """解密 Chrome/Brave cookie 值。"""
    if not encrypted_value or len(encrypted_value) < 3:
        return ""

    prefix = encrypted_value[:3]
    if prefix not in (b"v10", b"v11"):
        # 明文 cookie
        return encrypted_value.decode("utf-8", errors="replace")

    # 去掉 v10/v11 前缀
    payload = encrypted_value[3:]

    # AES-CBC，IV = 16 个空格 (0x20)
    cipher = Cipher(algorithms.AES(enc_key), modes.CBC(b" " * 16))
    decrypted = cipher.decryptor().update(payload) + cipher.decryptor().finalize()

    # 数据库版本 >= 24: 前 32 字节是 SHA256 域哈希，先跳过
    if db_version >= 24:
        decrypted = decrypted[32:]

    # PKCS#7 去填充
    pad_len = decrypted[-1]
    return decrypted[:-pad_len].decode("utf-8")


def extract_cookies() -> dict:
    """从浏览器数据库提取 cookies。"""
    browser = detect_browser()
    info = BROWSER_INFO[browser]

    cookie_db = info["path"] / "Cookies"
    if not cookie_db.exists():
        return {
            "cookie": None,
            "browser": info["display"],
            "error": f"未找到 {info['display']} Cookie 数据库: {cookie_db}",
        }

    # ─── 1) 获取密钥 ───
    try:
        key_material = get_key_material(info["keyring_label"])
    except Exception as e:
        return {"cookie": None, "browser": info["display"], "error": str(e)}

    enc_key = PBKDF2HMAC(
        algorithm=SHA1(), iterations=1, length=16, salt=b"saltysalt"
    ).derive(key_material.encode("utf-8"))

    # ─── 2) 读取数据库 ───
    try:
        db = sqlite3.connect(f"file:{cookie_db}?immutable=1", uri=True)
        db.row_factory = sqlite3.Row
        db.text_factory = bytes

        # 数据库版本
        try:
            row = db.execute("select value from meta where key = 'version'").fetchone()
            db_version = int(row[0]) if row else 0
        except Exception:
            db_version = 0

        # 构建域名查询条件
        like_clauses = " OR ".join(
            f"host_key LIKE '%.{d}'" for d in TARGET_DOMAINS
        )
        exact_clauses = " OR ".join(
            f"host_key = '.{d}'" for d in TARGET_DOMAINS
        )

        rows = db.execute(
            f"""SELECT name, value, encrypted_value
                FROM cookies
                WHERE ({like_clauses} OR {exact_clauses})
                ORDER BY name"""
        ).fetchall()
        db.close()
    except Exception as e:
        return {
            "cookie": None,
            "browser": info["display"],
            "error": f"读取 Cookie 数据库失败: {e}",
        }

    if not rows:
        return {
            "cookie": None,
            "browser": info["display"],
            "error": f"未找到 {info['display']} 中 platform.xiaomimimo.com 的 Cookie。"
                      f"请先在 {info['display']} 中登录并访问该站点后再试。",
        }

    # ─── 3) 逐条解密 ───
    result: dict[str, str] = {}
    for row in rows:
        name = row["name"].decode("utf-8", errors="replace")
        plain_val = row["value"]
        enc_val = row["encrypted_value"]

        if plain_val:
            # 已有明文
            result[name] = plain_val.decode("utf-8", errors="replace")
        elif enc_val and len(enc_val) > 3:
            try:
                val = decrypt_value(enc_val, enc_key, db_version)
                if val:
                    result[name] = val
            except Exception:
                # 某个 cookie 解密失败不影响其他
                pass

    if not result:
        return {
            "cookie": None,
            "browser": info["display"],
            "error": "Cookie 解密失败：密钥不匹配或 Cookie 已过期",
        }

    cookie_str = "; ".join(f"{k}={v}" for k, v in result.items())
    return {"cookie": cookie_str, "browser": info["display"], "error": None}


def main():
    result = extract_cookies()
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result["cookie"] else 1)


if __name__ == "__main__":
    main()
