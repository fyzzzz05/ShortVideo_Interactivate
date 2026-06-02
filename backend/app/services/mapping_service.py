from pathlib import Path


def load_scene_mapping() -> dict[str, str]:
    path = Path(__file__).resolve().parents[2] / "data" / "mapping" / "scene_mapping.yaml"
    result: dict[str, str] = {}
    if not path.exists() or path.stat().st_size == 0:
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        k, v = line.split(":", 1)
        result[k.strip()] = v.strip()
    return result
