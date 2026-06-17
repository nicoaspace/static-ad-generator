"""
Image provider router — Gemini (private) or OpenRouter Grok Imagine (public).

When PUBLIC_VERSION=true, routes to OpenRouter's x-ai/grok-imagine-image-quality model.
Otherwise uses the existing Gemini image generation stack.
"""

from __future__ import annotations

import base64
import io
import json
import urllib.error
import urllib.request

from config import (
    GEMINI_IMAGE_MODEL,
    OPENROUTER_IMAGE_MODEL,
    is_public_version,
    load_google_key,
    load_openrouter_key,
    map_aspect_ratio_for_openrouter,
    map_resolution_to_openrouter_image_size,
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_REF_IMAGES = 10


def generate_image(
    prompt: str,
    aspect_ratio: str,
    resolution: str,
    ref_images: list | None = None,
    *,
    seed: int | None = None,
) -> bytes | None:
    """
    Generate an image and return raw bytes, or None on failure.

    Public mode uses Grok Imagine via OpenRouter (text + optional reference images).
    """
    if is_public_version():
        if seed is not None:
            print("    (public mode: seed ignored — Grok Imagine does not expose seeds)")
        return _openrouter_generate(
            prompt,
            aspect_ratio,
            resolution,
            ref_images or [],
        )

    return _gemini_generate(prompt, aspect_ratio, resolution, ref_images or [], seed=seed)


def _pil_to_data_url(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _build_user_content(prompt: str, ref_images: list) -> str | list:
    if not ref_images:
        return prompt

    content: list[dict] = [{"type": "text", "text": prompt}]
    for _, img in ref_images[:MAX_REF_IMAGES]:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": _pil_to_data_url(img)},
            }
        )
    return content


def _decode_data_url(url: str) -> bytes | None:
    if not url.startswith("data:"):
        return None
    try:
        _, _, payload = url.partition(",")
        return base64.b64decode(payload)
    except (ValueError, TypeError):
        return None


def _extract_image_bytes(message: dict) -> bytes | None:
    for image in message.get("images") or []:
        url = (image.get("image_url") or {}).get("url", "")
        decoded = _decode_data_url(url)
        if decoded:
            return decoded

    content = message.get("content")
    if isinstance(content, list):
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "image_url":
                url = (part.get("image_url") or {}).get("url", "")
                decoded = _decode_data_url(url)
                if decoded:
                    return decoded
            inline = part.get("inline_data") or part.get("inlineData")
            if isinstance(inline, dict):
                data = inline.get("data")
                if data:
                    try:
                        return base64.b64decode(data)
                    except (ValueError, TypeError):
                        pass

    if isinstance(content, str) and content.startswith("data:"):
        return _decode_data_url(content)

    return None


def _openrouter_generate(
    prompt: str,
    aspect_ratio: str,
    resolution: str,
    ref_images: list,
) -> bytes | None:
    api_key = load_openrouter_key()
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not found. Set it as an environment variable or in env/.env.local"
        )

    mapped_aspect = map_aspect_ratio_for_openrouter(aspect_ratio)
    if mapped_aspect != aspect_ratio:
        print(f"    (aspect {aspect_ratio} -> {mapped_aspect} for Grok Imagine)")

    body: dict = {
        "model": OPENROUTER_IMAGE_MODEL,
        "messages": [
            {
                "role": "user",
                "content": _build_user_content(prompt, ref_images),
            }
        ],
        "modalities": ["image"],
        "image_config": {
            "aspect_ratio": mapped_aspect,
            "image_size": map_resolution_to_openrouter_image_size(resolution),
        },
    }

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
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter image API error ({exc.code}): {detail}") from exc

    try:
        message = data["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter image response: {data}") from exc

    return _extract_image_bytes(message)


def _gemini_generate(
    prompt: str,
    aspect_ratio: str,
    resolution: str,
    ref_images: list,
    *,
    seed: int | None,
) -> bytes | None:
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
    pil_images = [img for _, img in ref_images[:MAX_REF_IMAGES]]
    contents = [prompt] + pil_images

    response = client.models.generate_content(
        model=GEMINI_IMAGE_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=resolution,
            ),
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data
    return None
