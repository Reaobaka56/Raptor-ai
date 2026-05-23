import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from .stack_trace_parser import parse_stack_trace

# =========================
# Request / response models
# =========================

class FileBlob(BaseModel):
    path: str = Field(..., description="Relative path of the file in the repository")
    content: str = Field(..., description="File contents as a raw string")

class DebugRequest(BaseModel):
    stack_trace: str = Field(..., description="Full stack trace / error log supplied by the user")
    files: List[FileBlob] = Field(..., description="A list of source files that are relevant to the error")

class DebugResponse(BaseModel):
    explanation: str = Field(..., description="Human‑readable description of the root cause")
    patch: str = Field(..., description="Unified diff (git style) that fixes the issue")
    confidence: float = Field(..., description="Model confidence score between 0 and 1")

router = APIRouter()

def _call_llm(prompt: str) -> Dict[str, Any]:
    """Call the Gemini model (Google API or Hugging Face) and return a dict with keys
    `explanation`, `patch`, and `confidence`.

    The function expects the LLM to output a JSON object matching ``DebugResponse``.
    It reads the API configuration from environment variables:
        - ``GEMINI_API_KEY`` for the Google Gemini endpoint
        - ``HF_API_TOKEN`` and ``HF_MODEL_ID`` for a Hugging Face hosted Gemini model
    If both are present, the Google endpoint is used first.
    """
    import os
    import json
    import requests

    # Prefer Google Gemini API if key is set
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={gemini_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt} }]
        }
        headers = {"Content-Type": "application/json"}
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {resp.text}")
        # The Gemini response wraps the text in a list of candidates -> content -> parts
        try:
            data = resp.json()
            # Extract the first candidate text
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            # Expect the LLM to output a JSON block; locate the first '{' and last '}'
            json_start = text.find('{')
            json_end = text.rfind('}')
            if json_start == -1 or json_end == -1:
                raise ValueError("LLM response does not contain JSON")
            llm_json = json.loads(text[json_start:json_end+1])
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to parse Gemini response: {e}")
        # Ensure required keys exist
        for k in ("explanation", "patch", "confidence"):
            if k not in llm_json:
                raise HTTPException(status_code=502, detail=f"Gemini response missing key: {k}")
        return llm_json

    # Fallback to Hugging Face inference API
    hf_token = os.getenv("HF_API_TOKEN")
    hf_model = os.getenv("HF_MODEL_ID")
    if hf_token and hf_model:
        url = f"https://api-inference.huggingface.co/models/{hf_model}"
        headers = {"Authorization": f"Bearer {hf_token}", "Accept": "application/json"}
        payload = {"inputs": prompt, "parameters": {"max_new_tokens": 1024, "temperature": 0.0}}
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"HF inference error: {resp.text}")
        try:
            # HF returns a list of generated texts in "generated_text"
            generated = resp.json()
            # Depending on the model, the format may be a list of dicts
            if isinstance(generated, list) and "generated_text" in generated[0]:
                text = generated[0]["generated_text"]
            else:
                # Assume raw string
                text = generated
            json_start = text.find('{')
            json_end = text.rfind('}')
            llm_json = json.loads(text[json_start:json_end+1])
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to parse HF response: {e}")
        for k in ("explanation", "patch", "confidence"):
            if k not in llm_json:
                raise HTTPException(status_code=502, detail=f"HF response missing key: {k}")
        return llm_json

    # If no API configured, fall back to mock (maintain backward compatibility)
    return {
        "explanation": "Mock explanation: the error is caused by accessing a possibly undefined variable.",
        "patch": "--- a/example.ts\n+++ b/example.ts\n@@ -1,3 +1,3 @@\n-const userId = session.user.id\n+const userId = session?.user?.id",
        "confidence": 0.92,
    }


@router.post("/solve", response_model=DebugResponse)
async def solve_debug(req: DebugRequest):
    # 1️⃣ Parse the stack trace
    parsed = parse_stack_trace(req.stack_trace)
    if parsed["language"] == "unknown":
        raise HTTPException(status_code=400, detail="Unable to parse stack trace")

    # 2️⃣ Find the relevant file content (simple linear search)
    target_file = next((f for f in req.files if f.path.endswith(parsed.get("file") or "")), None)
    if not target_file:
        raise HTTPException(status_code=400, detail="Requested file not found in uploaded files")

    # 3️⃣ Build a prompt for the LLM – keep it short for the mock
    prompt = (
        f"You are an AI debugging assistant. The user reports a {parsed['type']} in a {parsed['language']} project.\n"
        f"Error message: {parsed['message']}\n"
        f"File: {parsed['file']} (line {parsed['line']})\n"
        f"File contents (first 200 chars):\n{target_file.content[:200]}\n"
        "Provide a concise explanation of the root cause and a minimal git‑style diff that fixes the bug.\n"
        "Return JSON with keys: explanation, patch, confidence (0‑1)."
    )

    # 4️⃣ Call the (mock) LLM
    llm_result = _call_llm(prompt)
    return DebugResponse(**llm_result)
