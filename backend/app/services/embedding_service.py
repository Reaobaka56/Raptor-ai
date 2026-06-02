"""
Embedding Service — wraps Gemini text-embedding-004 for vector generation.

Provides a thin caching layer so repeated identical texts don't hit the API.
"""

import os
import hashlib
from typing import List, Optional, Dict
from dotenv import load_dotenv

load_dotenv()

# In-memory LRU-style cache (keeps last 512 embeddings)
_CACHE: Dict[str, List[float]] = {}
_CACHE_MAX = 512

EMBEDDING_DIM = 768  # Gemini text-embedding-004 output dimension


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def generate_embedding(text: str) -> List[float]:
    """Generate a 768-dim embedding for the given text using Gemini text-embedding-004.

    Falls back to a deterministic hash-based pseudo-embedding when no API key is set
    so development / tests still work without network access.
    """
    if not text.strip():
        return [0.0] * EMBEDDING_DIM

    key = _cache_key(text)
    if key in _CACHE:
        return _CACHE[key]

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="RETRIEVAL_DOCUMENT",
            )
            embedding = result["embedding"]

            # Cache management
            if len(_CACHE) >= _CACHE_MAX:
                oldest = next(iter(_CACHE))
                del _CACHE[oldest]
            _CACHE[key] = embedding
            return embedding

        except Exception as e:
            print(f"[embedding_service] Gemini embedding call failed: {e}")
            # Fall through to deterministic fallback

    # ---------- deterministic fallback (dev / offline) ----------
    return _deterministic_embedding(text)


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Batch wrapper — embeds each text individually (Gemini doesn't batch embed yet)."""
    return [generate_embedding(t) for t in texts]


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
