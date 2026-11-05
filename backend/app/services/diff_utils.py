"""Helpers for reasoning about a unified diff."""
import re
from typing import Dict, Set

_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def parse_diff_lines(diff_text: str) -> Dict[str, Set[int]]:
    """Map each changed file to the set of new-file (RIGHT side) line numbers
    that exist in the diff - added and context lines. GitHub only accepts
    inline review comments on these lines; one invalid comment makes the whole
    review request fail with 422."""
    files: Dict[str, Set[int]] = {}
    current = None
    new_line = 0
    for raw in diff_text.splitlines():
        if raw.startswith("+++ "):
            path = raw[4:].strip()
            if path == "/dev/null":
                current = None
            else:
                current = path[2:] if path.startswith("b/") else path
                files.setdefault(current, set())
            continue
        if raw.startswith("diff --git"):
            current, new_line = None, 0      # per-file metadata lines follow; not diff content
            continue
        if raw.startswith("--- "):
            continue
        m = _HUNK.match(raw)
        if m:
            new_line = int(m.group(1))
            continue
        if current is None or new_line == 0:
            continue
        if raw.startswith("+"):
            files[current].add(new_line)
            new_line += 1
        elif raw.startswith("-"):
            continue            # removed line: no new-file line number
        elif raw.startswith("\\"):
            continue            # "\ No newline at end of file"
        else:
            files[current].add(new_line)   # context line
            new_line += 1
    return files
