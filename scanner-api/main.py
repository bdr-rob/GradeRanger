"""
FastAPI entrypoint for the Grade Ranger card scanner (OpenCV heuristics).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from analyzer import analyze_base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class AnalyzeBody(BaseModel):
    imageBase64: str = Field(..., min_length=8)


class AnalyzeResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


app = FastAPI(title="Grade Ranger Scanner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeBody) -> AnalyzeResponse:
    try:
        data = analyze_base64(body.imageBase64)
        return AnalyzeResponse(success=True, data=data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        return AnalyzeResponse(success=False, error=str(e))

