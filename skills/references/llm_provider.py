"""
LLM provider router — Gemini (private) or OpenRouter Nemotron (public).

When PUBLIC_VERSION=true, routes to OpenRouter's free Nemotron model.
Otherwise uses the existing Gemini stack.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from config import (
    GEMINI_LLM_MODEL,
    OPENROUTER_MODEL,
    get_llm_default_model,
    is_public_version,
    load_google_key,
    load_openrouter_key,
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def generate_text(
    system_prompt: str,
    user_message: str,
    *,
    model: str | None = None,
    json_mode: bool = False,
    max_tokens: int = 8192,
    use_web_search: bool = False,
) -> str:
    """
    Generate text from system + user prompts using the active LLM provider.

    use_web_search is only supported in private (Gemini) mode.
    """
    resolved_model = model or get_llm_default_model()

    if is_public_version():
        return _openrouter_generate(
            system_prompt,
            user_message,
            model=resolved_model,
            json_mode=json_mode,
            max_tokens=max_tokens,
        )

    return _gemini_generate(
        system_prompt,
        user_message,
        model=resolved_model,
        json_mode=json_mode,
        max_tokens=max_tokens,
        use_web_search=use_web_search,
    )


def _openrouter_generate(
    system_prompt: str,
    user_message: str,
    *,
    model: str,
    json_mode: bool,
    max_tokens: int,
) -> str:
    api_key = load_openrouter_key()
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not found. Set it as an environment variable or in env/.env.local"
        )

    body: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    payload = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter API error ({exc.code}): {detail}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {data}") from exc


def _gemini_generate(
    system_prompt: str,
    user_message: str,
    *,
    model: str,
    json_mode: bool,
    max_tokens: int,
    use_web_search: bool,
) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError(
            "'google-genai' package required.  pip install google-genai"
        ) from exc

    api_key = load_google_key()
    if not api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY not found. Set it as an environment variable or in env/.env.local"
        )

    client = genai.Client(api_key=api_key)

    config_kwargs: dict = {
        "system_instruction": system_prompt,
        "max_output_tokens": max_tokens,
    }
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"
    if use_web_search:
        config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]

    config = types.GenerateContentConfig(**config_kwargs)
    response = client.models.generate_content(
        model=model or GEMINI_LLM_MODEL,
        contents=user_message,
        config=config,
    )

    text = response.text or ""
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text
