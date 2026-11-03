"""
Embedding Service — wraps Gemini text-embedding-004 for vector generation.

Provides a thin caching layer so repeated identical texts don't hit the API.
"""

import os
import hashlib
from typing import List, Optional, Dict
from collections import OrderedDict
from dotenv import load_dotenv
import logging

load_dotenv()

# In-memory LRU cache using OrderedDict (keeps last N embeddings)
_CACHE_MAX = 512
_CACHE: "OrderedDict[str, List[float]]" = OrderedDict()

EMBEDDING_DIM = 768  # Gemini text-embedding-004 output dimension


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
_client = None


def _get_client():
    """google-genai client (the package actually listed in requirements.txt;
    the old code imported google.generativeai, which isn't installed, so every
    call silently fell back to meaningless hash embeddings)."""
    global _client
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=api_key)
    return _client


def _normalize(vec: List[float]) -> List[float]:
    norm = max(sum(x * x for x in vec) ** 0.5, 1e-9)
    return [x / norm for x in vec]


def _cache_put(key: str, emb: List[float]) -> None:
    if len(_CACHE) >= _CACHE_MAX:
        try:
            _CACHE.popitem(last=False)
        except Exception:
            pass
    _CACHE[key] = emb


def _embed_remote(texts: List[str]) -> List[List[float]]:
    from google.genai import types
    client = _get_client()
    res = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    # Truncated (<3072-dim) gemini-embedding-001 vectors must be re-normalized.
    return [_normalize(list(e.values)) for e in res.embeddings]


def generate_embedding(text: str) -> List[float]:
    """768-dim embedding. BLOCKING - call via asyncio.to_thread from async code.
    Falls back to a deterministic hash pseudo-embedding only when no API key
    is configured (dev/tests) or the API call fails."""
    return generate_embeddings_batch([text])[0]


def generate_embeddings_batch(texts: List[str], batch_size: int = 100) -> List[List[float]]:
    """Embed many texts with one API call per `batch_size`, using the LRU cache.
    BLOCKING - call via asyncio.to_thread from async code."""
    out: List[Optional[List[float]]] = [None] * len(texts)
    todo: List[int] = []
    for i, t in enumerate(texts):
        if not t.strip():
            out[i] = [0.0] * EMBEDDING_DIM
            continue
        key = _cache_key(t)
        if key in _CACHE:
            _CACHE.move_to_end(key)
            out[i] = _CACHE[key]
        else:
            todo.append(i)

    client = _get_client() if todo else None
    for start in range(0, len(todo), batch_size):
        idxs = todo[start:start + batch_size]
        batch = [texts[i] for i in idxs]
        embs = None
        if client is not None:
            try:
                embs = _embed_remote(batch)
            except Exception:
                logging.exception("[embedding_service] Gemini embedding call failed")
        for i, t, k in zip(idxs, batch, range(len(batch))):
            if embs is not None:
                out[i] = embs[k]
                _cache_put(_cache_key(t), embs[k])
            else:
                out[i] = _deterministic_embedding(t)
    return out  # type: ignore[return-value]


def _deterministic_embedding(text: str) -> List[float]:
    """Produce a stable pseudo-embedding from a SHA-256 hash so vector math
    (cosine similarity) still works directionally in dev without an API key."""
    import struct

    digest = hashlib.sha256(text.encode("utf-8")).digest()
    # Repeat the 32-byte digest to fill 768 floats
    repeated = digest * ((EMBEDDING_DIM * 4 // len(digest)) + 1)
    floats = list(struct.unpack(f"<{EMBEDDING_DIM}f", repeated[: EMBEDDING_DIM * 4]))
    # Normalise to unit length
    norm = max(sum(x * x for x in floats) ** 0.5, 1e-9)
    return [x / norm for x in floats]
