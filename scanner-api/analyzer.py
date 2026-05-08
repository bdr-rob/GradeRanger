"""
Heuristic card scan signals using OpenCV (MVP — informational only).
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np


def decode_image(image_base64: str) -> Optional[np.ndarray]:
    raw = image_base64.strip()
    if "," in raw[:160]:
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception:
        return None
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def calculate_centering_ratio(
    img: np.ndarray,
) -> Tuple[float, Optional[Tuple[int, int, int, int]]]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    coords = cv2.findNonZero(edges)
    if coords is None or len(coords) < 10:
        return 0.5, None
    x, y, w, h = cv2.boundingRect(coords)
    center_x = x + w / 2.0
    left = center_x
    right = img.shape[1] - center_x
    denom = left + right
    if denom <= 0:
        return 0.5, (x, y, w, h)
    ratio = left / denom
    return float(ratio), (x, y, w, h)


def centering_grade_label(ratio: float) -> str:
    diff = abs(0.5 - ratio)
    if diff < 0.02:
        return "10"
    if diff < 0.05:
        return "9"
    if diff < 0.08:
        return "8"
    return "7"


def ratio_to_centering_percent(ratio: float) -> int:
    diff = abs(0.5 - ratio)
    return int(max(0, min(100, round(100 - diff * 400))))


def edge_metrics(img: np.ndarray) -> Tuple[float, int]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    mean_e = float(edges.mean())
    score = max(55, min(100, int(100 - mean_e * 0.35)))
    return mean_e, score


def corner_metrics(img: np.ndarray) -> Tuple[int, int]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    corners = cv2.goodFeaturesToTrack(
        gray,
        maxCorners=40,
        qualityLevel=0.01,
        minDistance=12,
        blockSize=5,
    )
    if corners is None:
        return 0, 72
    n = len(corners)
    score = int(max(60, min(100, 65 + min(n, 20))))
    return n, score


def surface_score(img: np.ndarray) -> int:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    var = float(lap.var())
    if var < 100:
        return 72
    if var < 300:
        return 82
    if var < 800:
        return 90
    return 95


def composite_grades(c: int, co: int, e: int, s: int) -> float:
    return 0.35 * c + 0.25 * co + 0.25 * e + 0.15 * s


def map_composite_to_psa(comp: float) -> int:
    if comp >= 93:
        return 10
    if comp >= 88:
        return 9
    if comp >= 80:
        return 8
    if comp >= 72:
        return 7
    return max(7, min(10, int(round(comp / 10))))


def build_explanation(ratio: float, edge_mean: float) -> str:
    parts: List[str] = []
    if ratio > 0.52:
        parts.append(
            f"Slight centering shift to the right (~{ratio:.2f} left/right balance)."
        )
    elif ratio < 0.48:
        parts.append(
            f"Slight centering shift to the left (~{ratio:.2f} left/right balance)."
        )
    else:
        parts.append("Centering appears fairly balanced left-to-right.")

    if edge_mean > 25:
        parts.append(
            "Higher edge activity detected (possible texture or wear — heuristic)."
        )
    elif edge_mean < 8:
        parts.append("Edges look relatively calm in this crop.")

    parts.append(
        "These estimates are experimental computer vision signals, not official grades."
    )
    return " ".join(parts)


def analyze_base64(image_base64: str) -> Dict[str, Any]:
    img = decode_image(image_base64)
    if img is None or img.size == 0:
        raise ValueError("Could not decode image")

    ratio, _bbox = calculate_centering_ratio(img)
    c_grade = centering_grade_label(ratio)
    centering_pct = ratio_to_centering_percent(ratio)

    edge_mean, edges_pct = edge_metrics(img)
    corner_count, corners_pct = corner_metrics(img)
    surface_pct = surface_score(img)

    comp = composite_grades(centering_pct, corners_pct, edges_pct, surface_pct)

    psa = map_composite_to_psa(comp)
    beckett = round(min(10.0, psa + 0.5), 1)
    cgc = round(min(10.0, psa + 0.3), 1)

    confidence = int(max(55, min(95, round(comp * 0.85))))

    deal_score = round(max(1.0, min(5.0, 1.0 + (comp / 100.0) * 4.0)), 1)

    warnings: List[str] = []
    if abs(ratio - 0.5) > 0.06:
        warnings.append("Noticeable left/right imbalance detected.")
    if edge_mean > 30:
        warnings.append("Strong edge response — check lighting and glare.")
    if corner_count < 8:
        warnings.append("Few corner features detected — photo may be soft or cropped.")

    explanation = build_explanation(ratio, edge_mean)

    notes = (
        "OpenCV heuristic estimate from centering, edges, corners, and sharpness. "
        "Not affiliated with PSA, BGS, or CGC."
    )

    return {
        "centering": centering_pct,
        "corners": corners_pct,
        "edges": edges_pct,
        "surface": surface_pct,
        "predictedGrade": {"PSA": psa, "Beckett": beckett, "CGC": cgc},
        "confidence": confidence,
        "dealScore": deal_score,
        "notes": notes,
        "centeringRatio": ratio,
        "centeringGradeLabel": c_grade,
        "explanation": explanation,
        "warnings": warnings,
    }
