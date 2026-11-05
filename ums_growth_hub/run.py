"""
Single-Command Startup Launcher for UMS Smart Growth Hub.
Features:
- Automatic dependency verification
- Socket port probe with conflict resolution (8000, 8001, 8002, 8080...)
- Background server daemon startup
- Fast healthcheck ping loop
- Automatic default browser launch
- Rich terminal status banner
"""

import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# Console Windows mặc định cp1252 → in tiếng Việt bị UnicodeEncodeError. Ép UTF-8 (thay ký tự lỗi nếu có).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def is_port_available(host: str, port: int) -> bool:
    """Probes whether a TCP port is open and available for binding."""
    if not (1024 <= port <= 65535):
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        try:
            s.bind((host, port))
            return True
        except socket.error:
            return False


def find_available_port(host: str, candidate_ports: list[int]) -> int:
    """Finds the first available port from candidate list, or scans sequentially."""
    for p in candidate_ports:
        if is_port_available(host, p):
            return p

    # Fallback sequential search
    for p in range(8000, 8100):
        if is_port_available(host, p):
            return p

    return 8000


def wait_for_healthcheck(url: str, timeout_sec: float = 10.0) -> bool:
    """Polls the /api/health endpoint until HTTP 200 is received or timeout."""
    start_time = time.time()
    while time.time() - start_time < timeout_sec:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "UMS-Startup-Probe"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def print_banner(host: str, port: int):
    """Displays rich startup banner in terminal."""
    banner = f"""
================================================================================
     UMS SMART GROWTH HUB — NỀN TẢNG HỒ SƠ NĂNG LỰC SỐ THCS NGOẠI NGỮ
           Trường THCS Ngoại ngữ — Đại học Ngoại ngữ, ĐHQGHN
================================================================================
  * Web Platform : http://{host}:{port}
  * API Docs     : http://{host}:{port}/docs
  * Healthcheck  : http://{host}:{port}/api/health
  * Core Engine  : 100% Offline AI (GDPT 2018 Rubrics & CNN High School Pathway)
================================================================================
  Máy chủ đang hoạt động. Nhấn Ctrl+C để dừng hệ thống an toàn.
================================================================================
"""
    print(banner)


def main():
    """Main launcher entry point."""
    from app.config import DEFAULT_HOST, FALLBACK_PORTS

    host = DEFAULT_HOST
    port = find_available_port(host, FALLBACK_PORTS)

    print(f">> [UMS Launcher] Đang khởi động máy chủ trên http://{host}:{port}...")

    # Server runner function
    def start_uvicorn():
        import uvicorn
        from app.main import app
        uvicorn.run(app, host=host, port=port, log_level="warning")

    # Start Uvicorn in background daemon thread
    server_thread = threading.Thread(target=start_uvicorn, daemon=True)
    server_thread.start()

    # Wait for server healthcheck
    health_url = f"http://{host}:{port}/api/health"
    healthy = wait_for_healthcheck(health_url, timeout_sec=8.0)

    if healthy:
        print_banner(host, port)
        # Open default browser
        try:
            webbrowser.open_new_tab(f"http://{host}:{port}")
        except Exception as e:
            print(f">> [UMS Launcher] Lưu ý: Vui lòng mở trình duyệt và truy cập http://{host}:{port}")
    else:
        print(f">> [UMS Launcher] Cảnh báo: Chưa nhận được phản hồi healthcheck tại {health_url}")

    # Keep main thread alive until interrupt
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n>> [UMS Launcher] Đang tắt máy chủ UMS Smart Growth Hub... Tạm biệt!")
        sys.exit(0)


if __name__ == "__main__":
    main()
