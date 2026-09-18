from __future__ import annotations

import json
import logging

import cv2
import numpy as np
from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.config import settings
from app.core.storage import new_id, upload_dir
from app.models.schemas import ImageQualityReport, UploadResponse, ViewLabel
from app.pipeline.image_quality import analyze_image, subject_coverage_ratio
from app.pipeline.segmentation import clean_mask, segment

logger = logging.getLogger("photo_to_stl.api.upload")
router = APIRouter()

_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _decode_and_downscale(raw: bytes) -> np.ndarray | None:
    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    h, w = bgr.shape[:2]
    longest = max(h, w)
    if longest > settings.max_image_dimension:
        scale = settings.max_image_dimension / longest
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return bgr


@router.post("/api/upload", response_model=UploadResponse)
async def upload_photos(files: list[UploadFile], views: str | None = Form(default=None)):
    if not files:
        raise HTTPException(400, "En az bir fotoğraf yükleyin.")
    if len(files) > settings.max_upload_files:
        raise HTTPException(400, f"En fazla {settings.max_upload_files} fotoğraf yükleyebilirsiniz.")

    view_labels: list[str] = []
    if views:
        try:
            view_labels = json.loads(views)
        except json.JSONDecodeError:
            view_labels = []

    uid = new_id()
    udir = upload_dir(uid, create=True)

    reports: list[ImageQualityReport] = []
    manifest: list[dict] = []

    for idx, f in enumerate(files):
        ext = "." + f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else ""
        if ext not in _ALLOWED_EXT:
            raise HTTPException(400, f"Desteklenmeyen dosya türü: {f.filename}")
        raw = await f.read()
        if len(raw) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(400, f"{f.filename} çok büyük (limit {settings.max_upload_mb} MB).")
        bgr = _decode_and_downscale(raw)
        if bgr is None:
            raise HTTPException(400, f"{f.filename} geçerli bir görsel olarak okunamadı.")

        view = view_labels[idx] if idx < len(view_labels) else ViewLabel.unspecified.value
        try:
            view = ViewLabel(view).value
        except ValueError:
            view = ViewLabel.unspecified.value

        stored_name = f"{idx:02d}_{view}.jpg"
        cv2.imwrite(str(udir / stored_name), bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])

        metrics = analyze_image(bgr)
        seg = segment(bgr)
        alpha = clean_mask(seg.alpha)
        coverage = subject_coverage_ratio(alpha)

        warnings = list(metrics.warnings)
        if coverage < 0.03:
            warnings.append("Fotoğrafta belirgin bir nesne tespit edilemedi.")
        elif coverage > 0.97:
            warnings.append("Arka plan neredeyse hiç ayırt edilemiyor; nesne tüm kareyi kaplıyor olabilir.")

        usable = metrics.sharpness_score >= 20 and coverage >= 0.02

        h, w = bgr.shape[:2]
        reports.append(ImageQualityReport(
            filename=stored_name,
            view=ViewLabel(view),
            width=w,
            height=h,
            sharpness_score=round(metrics.sharpness_score, 1),
            brightness_score=round(metrics.brightness_score, 1),
            background_complexity=round(metrics.background_complexity, 1),
            subject_coverage_ratio=round(coverage, 3),
            warnings=warnings,
            usable=usable,
        ))
        manifest.append(dict(filename=stored_name, view=view, usable=usable))

    (udir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    overall_warnings: list[str] = []
    usable_count = sum(1 for r in reports if r.usable)
    if usable_count == 0:
        overall_warnings.append("Bu fotoğraf(lar)dan güvenilir bir 3D model oluşturmak zor olabilir.")
    if len(files) == 1:
        overall_warnings.append(
            "Model doğruluğunu artırmak için nesnenin farklı açılardan 3-6 fotoğrafını yükleyebilirsiniz."
        )

    return UploadResponse(
        upload_id=uid,
        images=reports,
        overall_warnings=overall_warnings,
        recommended_multi_photo=len(files) < 3,
    )
