# backend/app/stack_trace_parser.py
"""Utility functions to parse stack traces from JavaScript/TypeScript and Python.
The parser extracts:
- language (js or python)
- file name
- line number
- error message / exception type
"""
import re
from typing import Optional, Dict
import logging

_STACK_TRACE_REGEX = {
    "js": re.compile(r"(?P<type>\w+Error): (?P<message>.+?) at (?P<file>.+?):(?P<line>\d+)", re.MULTILINE),
    "python": re.compile(r"Traceback \(most recent call last\):\n(?P<trace>.*?)(?P<type>\w+Error): (?P<message>.+)", re.DOTALL),
}


def parse_stack_trace(trace: str) -> Dict:
    """Return a dict with keys: language, type, message, file, line (int or None)."""
    # Try JavaScript/TypeScript pattern first
    js_match = _STACK_TRACE_REGEX["js"].search(trace)
    if js_match:
        return {
            "language": "js",
            "type": js_match.group("type"),
            "message": js_match.group("message"),
            "file": js_match.group("file"),
            "line": int(js_match.group("line")),
        }
    # Then Python pattern
    py_match = _STACK_TRACE_REGEX["python"].search(trace)
    if py_match:
        # Extract the last file/line from the traceback lines (if any)
        last_line = None
        for line in py_match.group("trace").splitlines():
            m = re.search(r'File "(?P<file>.+?)", line (?P<line>\d+)', line)
            if m:
                last_line = (m.group("file"), int(m.group("line")))
        file, line = last_line if last_line else (None, None)
        return {
            "language": "python",
            "type": py_match.group("type"),
            "message": py_match.group("message"),
            "file": file,
            "line": line,
        }
    # Fallback – unknown format
    return {
        "language": "unknown",
        "type": None,
        "message": trace.strip(),
        "file": None,
        "line": None,
    }

# Simple test when run directly
if __name__ == "__main__":
    sample = "TypeError: Cannot read property 'id' of undefined at src/auth.ts:45"
    logging.info(parse_stack_trace(sample))