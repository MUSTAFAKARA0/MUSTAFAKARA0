"""Real end-to-end test: drives the actual FastAPI app (TestClient), the real
rembg/GrabCut segmentation, the real visual-hull / silhouette-inflate
providers, the real trimesh/pymeshfix cleanup pipeline, and real binary STL
export -- against synthetically generated but independently-drawn photos
(see gen_synthetic_photos.py). No step is mocked or stubbed.

Run with: PYTHONPATH=. .venv/bin/python tests/test_pipeline_e2e.py
"""
from __future__ import annotations

import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import trimesh
from fastapi.testclient import TestClient

from app.main import app
from tests.gen_synthetic_photos import write_test_set

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


def _poll_job(client: TestClient, job_id: str, timeout_s: float = 120) -> dict:
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout_s:
        r = client.get(f"/api/jobs/{job_id}")
        assert r.status_code == 200, r.text
        last = r.json()
        for step in last["steps"]:
            print(f"  [{step['status']:>11}] {step['label']}: {step.get('detail') or ''}")
        if last["state"] in ("done", "error"):
            return last
        time.sleep(0.5)
    raise TimeoutError(f"job {job_id} did not finish in {timeout_s}s: {last}")


def run_multi_view_case(client: TestClient) -> str:
    print("\n=== MULTI-VIEW (6 photos) CASE ===")
    views = ["front", "back", "left", "right", "top", "bottom"]
    paths = write_test_set(FIXTURES, views)

    files = [("files", (p.name, open(p, "rb"), "image/jpeg")) for p in paths]
    r = client.post("/api/upload", files=files, data={"views": __import__("json").dumps(views)})
    assert r.status_code == 200, r.text
    upload = r.json()
    print("upload:", {i["filename"]: (i["usable"], i["warnings"]) for i in upload["images"]})
    assert all(i["usable"] for i in upload["images"]), upload

    r = client.post("/api/reconstruct", json={
        "upload_id": upload["upload_id"], "quality": "standard", "mesh_density": "medium",
        "model_name": "Test Şişe",
    })
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    print("job_id:", job_id)

    job = _poll_job(client, job_id)
    assert job["state"] == "done", job
    model_id = job["model_id"]
    assert model_id

    r = client.get(f"/api/models/{model_id}")
    assert r.status_code == 200, r.text
    model = r.json()
    print("reconstruction:", model["reconstruction"])
    print("diagnostics:", model["diagnostics"])
    print("printability warnings:", len(model["printability"]["warnings"]))
    print("dimensions:", model["dimensions"])

    assert model["reconstruction"]["method"] == "visual_hull"
    assert model["reconstruction"]["views_used"] == 6
    assert model["diagnostics"]["face_count"] > 0
    assert model["diagnostics"]["vertex_count"] > 0

    r = client.get(f"/api/models/{model_id}/download")
    assert r.status_code == 200
    stl_bytes = r.content
    assert stl_bytes[:5] != b"solid", "must be BINARY stl, not ascii"
    tmp = pathlib.Path("/tmp/e2e_multi.stl")
    tmp.write_bytes(stl_bytes)
    mesh = trimesh.load(tmp, file_type="stl")
    print("Loaded STL back with trimesh:", mesh.vertices.shape, mesh.faces.shape,
          "watertight=", mesh.is_watertight, "volume=", mesh.volume if mesh.is_volume else None)
    assert len(mesh.faces) > 100

    r = client.get(f"/api/models/{model_id}/preview.glb")
    assert r.status_code == 200 and len(r.content) > 100
    print("GLB preview bytes:", len(r.content))

    r = client.post(f"/api/models/{model_id}/export", json={
        "name": "Test Sise Buyuk", "unit": "cm", "width": 15, "keep_aspect": True, "nozzle_mm": 0.4,
    })
    assert r.status_code == 200, r.text
    exp = r.json()
    print("export:", exp["filename"], exp["dimensions"])
    assert exp["filename"].startswith("test-sise-buyuk_")
    assert abs(exp["dimensions"]["width"] - 15.0) < 0.05

    r = client.post(f"/api/models/{model_id}/repair")
    assert r.status_code == 200, r.text
    print("repair diagnostics:", r.json()["diagnostics"])

    return model_id


def run_single_view_case(client: TestClient) -> str:
    print("\n=== SINGLE-VIEW (1 photo) CASE ===")
    paths = write_test_set(FIXTURES, ["front"])
    files = [("files", (paths[0].name, open(paths[0], "rb"), "image/jpeg"))]
    r = client.post("/api/upload", files=files, data={"views": __import__("json").dumps(["front"])})
    assert r.status_code == 200, r.text
    upload = r.json()
    assert upload["recommended_multi_photo"] is True
    assert any("3-6" in w for w in upload["overall_warnings"])

    r = client.post("/api/reconstruct", json={
        "upload_id": upload["upload_id"], "quality": "fast", "mesh_density": "low",
        "model_name": "Tekli Test",
    })
    job_id = r.json()["job_id"]
    job = _poll_job(client, job_id)
    assert job["state"] == "done", job
    model_id = job["model_id"]

    model = client.get(f"/api/models/{model_id}").json()
    print("reconstruction:", model["reconstruction"])
    assert model["reconstruction"]["method"] == "silhouette_inflate"
    assert model["reconstruction"]["confidence"] == "low"
    assert any("TAHMİN" in n for n in model["reconstruction"]["notes"])

    r = client.get(f"/api/models/{model_id}/download")
    assert r.status_code == 200 and len(r.content) > 100
    return model_id


def main():
    client = TestClient(app)
    m1 = run_multi_view_case(client)
    m2 = run_single_view_case(client)

    r = client.delete(f"/api/models/{m1}")
    assert r.status_code == 200
    r = client.get(f"/api/models/{m1}")
    assert r.status_code == 404
    print("\ndelete + 404-after-delete verified for", m1)

    client.delete(f"/api/models/{m2}")
    print("\nALL E2E CHECKS PASSED")


if __name__ == "__main__":
    main()
