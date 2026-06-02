#!/usr/bin/env python3
"""
从 Brave 浏览器提取指定域名的 cookies 的独立工具。

零外部依赖 —— 直接通过 libsecret + cryptography 解密数据库。

用法:
  # 默认提取 platform.xiaomimimo.com
  python3 brave_cookies.py

  # 指定域名
  python3 brave_cookies.py --domain example.com

  # 输出 curl 可用格式
  python3 brave_cookies.py --format curl
"""

import argparse
import json
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.hashes import SHA1
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


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


def detect_browser() -> tuple[str, dict]:
    for name, info in BROWSER_INFO.items():
        if (info["path"] / "Cookies").exists():
            return name, info
    return "brave", BROWSER_INFO["brave"]


def get_key_material(label: str) -> str:
    import secretstorage

    conn = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(conn)
    for item in collection.get_all_items():
        if item.get_label() == label:
            val = item.get_secret().decode("utf-8", errors="replace").strip()
            if val:
                return val
    raise RuntimeError(f"Keyring 中未找到 '{label}'")


def extract(domain: str = "https://platform.xiaomimimo.com", browser_name: str | None = None) -> dict[str, str]:
    import sqlite3

    if browser_name:
        info = BROWSER_INFO[browser_name]
    else:
        _, info = detect_browser()

    cookie_db = info["path"] / "Cookies"
    km = get_key_material(info["keyring_label"])
    key = PBKDF2HMAC(algorithm=SHA1(), iterations=1, length=16, salt=b"saltysalt").derive(km.encode("utf-8"))

    domain_name = domain.replace("https://", "").replace("http://", "").split("/")[0]

    db = sqlite3.connect(f"file:{cookie_db}?immutable=1", uri=True)
    db.row_factory = sqlite3.Row
    db.text_factory = bytes

    try:
        row = db.execute("select value from meta where key = 'version'").fetchone()
        db_version = int(row[0]) if row else 0
    except Exception:
        db_version = 0

    rows = db.execute(
        "SELECT name, value, encrypted_value FROM cookies WHERE host_key LIKE ? OR host_key LIKE ? ORDER BY name",
        (f"%.{domain_name}", f".{domain_name}"),
    ).fetchall()
    db.close()

    result = {}
    for row in rows:
        name = row["name"].decode("utf-8", errors="replace")
        plain = row["value"]
        enc = row["encrypted_value"]

        if plain:
            result[name] = plain.decode("utf-8", errors="replace")
        elif enc and len(enc) > 3 and enc[:3] in (b"v10", b"v11"):
            try:
                payload = enc[3:]
                c = Cipher(algorithms.AES(key), modes.CBC(b" " * 16))
                d = c.decryptor().update(payload) + c.decryptor().finalize()
                if db_version >= 24:
                    d = d[32:]
                result[name] = d[:-d[-1]].decode("utf-8")
            except Exception:
                pass

    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", default="platform.xiaomimimo.com")
    ap.add_argument("--browser", choices=list(BROWSER_INFO.keys()), default=None)
    ap.add_argument("--format", choices=["json", "curl", "plain"], default="plain")
    args = ap.parse_args()

    cookies = extract(f"https://{args.domain}", args.browser)

    if args.format == "json":
        print(json.dumps(cookies, ensure_ascii=False, indent=2))
    elif args.format == "curl":
        print("; ".join(f"{k}={v}" for k, v in cookies.items()))
    else:
        for k, v in cookies.items():
            print(f"{k}={v}")


if __name__ == "__main__":
    main()
