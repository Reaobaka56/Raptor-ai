import pytest
from app.services.upload_validation import content_matches_extension as ok

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20
JPG = b"\xff\xd8\xff\xe0" + b"0" * 20
GIF = b"GIF89a" + b"0" * 20
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 20
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 20
WEBM = b"\x1a\x45\xdf\xa3" + b"0" * 20


@pytest.mark.parametrize("ext,data", [(".png", PNG), (".jpg", JPG), (".jpeg", JPG), (".gif", GIF),
                                      (".webp", WEBP), (".mp4", MP4), (".mov", MP4), (".webm", WEBM), (".PNG", PNG)])
def test_valid_content_accepted(ext, data):
    assert ok(ext, data)


@pytest.mark.parametrize("ext,data", [
    (".png", b"<script>alert(1)</script>"), (".jpg", PNG), (".png", JPG), (".mp4", PNG),
    (".gif", b""), (".webp", b"RIFF\x00\x00\x00\x00WAVE" + b"0" * 20), (".svg", b"<svg/>"), (".exe", b"MZ"),
])
def test_mismatched_or_disallowed_rejected(ext, data):
    assert not ok(ext, data)
