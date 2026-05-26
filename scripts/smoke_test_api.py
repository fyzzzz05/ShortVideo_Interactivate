import requests


BASE = "http://127.0.0.1:8000"


def main() -> None:
    print(requests.get(f"{BASE}/health", timeout=5).json())
    print(requests.get(f"{BASE}/api/v1/episodes/1/events", params={"mode": "offline"}, timeout=5).json())


if __name__ == "__main__":
    main()
