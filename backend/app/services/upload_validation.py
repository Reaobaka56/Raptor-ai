"""Validate uploaded media by content (magic bytes), not just file extension."""
from typing import Optional

# extension -> predicate over the first bytes of the file
def _png(b: bytes) -> bool:  return b.startswith(b"\x89PNG\r\n\x1a\n")
def _jpg(b: bytes) -> bool:  return b.startswith(b"\xff\xd8\xff")
def _gif(b: bytes) -> bool:  return b[:6] in (b"GIF87a", b"GIF89a")
def _webp(b: bytes) -> bool: return b[:4] == b"RIFF" and b[8:12] == b"WEBP"
def _isobmff(b: bytes) -> bool: return b[4:8] == b"ftyp"          # mp4 / mov
def _webm(b: bytes) -> bool: return b.startswith(b"\x1a\x45\xdf\xa3")

SIGNATURES = {
    ".png": _png, ".jpg": _jpg, ".jpeg": _jpg, ".gif": _gif, ".webp": _webp,
    ".mp4": _isobmff, ".mov": _isobmff, ".webm": _webm,
}


def content_matches_extension(ext: str, contents: bytes) -> bool:
    check = SIGNATURES.get(ext.lower())
    return bool(check and check(contents[:32]))
