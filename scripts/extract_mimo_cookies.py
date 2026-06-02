#!/usr/bin/env python3
"""从默认浏览器提取小米 MiMo 平台 Cookie。
支持 Chromium 系（Chrome/Brave/Edge/Vivaldi）和 Firefox。
输出 JSON: {"cookie": "name=val; name2=val2; ...", "browser": "Brave", "error": null}
失败时: {"cookie": null, "browser": "...", "error": "错误描述"}
"""
import json
import subprocess
import sys

# .desktop 文件名 → 用户友好的浏览器名称
_BROWSER_MAP = {
    'brave-browser.desktop': 'Brave',
    'brave-browser-beta.desktop': 'Brave Beta',
    'google-chrome.desktop': 'Chrome',
    'google-chrome-stable.desktop': 'Chrome',
    'google-chrome-beta.desktop': 'Chrome Beta',
    'chromium-browser.desktop': 'Chromium',
    'chromium.desktop': 'Chromium',
    'microsoft-edge.desktop': 'Edge',
    'microsoft-edge-stable.desktop': 'Edge',
    'vivaldi-stable.desktop': 'Vivaldi',
    'firefox.desktop': 'Firefox',
    'firefox-esr.desktop': 'Firefox ESR',
}

# .desktop 文件名 → pycookiecheat 的 browser 参数（Chromium 系共用 'chrome'）
_BROWSER_IMPL = {
    'brave-browser.desktop': 'brave',
    'brave-browser-beta.desktop': 'brave',
    'google-chrome.desktop': 'chrome',
    'google-chrome-stable.desktop': 'chrome',
    'google-chrome-beta.desktop': 'chrome',
    'chromium-browser.desktop': 'chromium',
    'chromium.desktop': 'chromium',
    'microsoft-edge.desktop': 'edge',
    'microsoft-edge-stable.desktop': 'edge',
    'vivaldi-stable.desktop': 'vivaldi',
    'firefox.desktop': 'firefox',
    'firefox-esr.desktop': 'firefox',
}


def get_default_browser():
    """通过 xdg-settings 检测默认浏览器"""
    try:
        result = subprocess.run(
            ['xdg-settings', 'get', 'default-web-browser'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            desktop = result.stdout.strip()
            name = _BROWSER_MAP.get(desktop, desktop.replace('.desktop', ''))
            impl = _BROWSER_IMPL.get(desktop)
            return desktop, name, impl
    except Exception:
        pass
    return None, '浏览器', None


def extract():
    try:
        from pycookiecheat import chrome_cookies
    except ImportError:
        return None, None, "pycookiecheat 未安装，请执行: pip3 install --break-system-packages pycookiecheat"

    desktop_file, browser_name, browser_impl = get_default_browser()

    if not browser_impl:
        return None, browser_name, f"不支持从 {browser_name} 提取 Cookie，请手动粘贴"

    # Firefox 走 firefox_cookies，Chromium 系走 chrome_cookies
    try:
        if browser_impl == 'firefox':
            from pycookiecheat import firefox_cookies
            cookies = firefox_cookies(url='https://platform.xiaomimimo.com')
        else:
            cookies = chrome_cookies(
                url='https://platform.xiaomimimo.com',
                browser=browser_impl
            )
    except Exception as e:
        return None, browser_name, f"从 {browser_name} 提取 Cookie 失败: {e}"

    if not cookies:
        return None, browser_name, f"未找到 MiMo Cookie，请先在 {browser_name} 中登录 platform.xiaomimimo.com"

    cookie_str = '; '.join(f'{k}={v}' for k, v in cookies.items())
    return cookie_str, browser_name, None


if __name__ == '__main__':
    cookie, browser, error = extract()
    print(json.dumps({"cookie": cookie, "browser": browser, "error": error}, ensure_ascii=False))
    sys.exit(0 if cookie else 1)
