"""Groq API client for LLM code generation.

Uses the Groq OpenAI-compatible API to generate code from a structured spec.
Implements retry logic with exponential backoff for 429/5xx errors.
"""

import json
import os
import time
from typing import Optional
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from shared.logger import get_logger

logger = get_logger("groq-client")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_TOKENS = int(os.environ.get("GROQ_MAX_TOKENS", "8192"))
TEMPERATURE = float(os.environ.get("GROQ_TEMPERATURE", "0.2"))

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds


def call_groq(system_prompt: str, user_prompt: str) -> str:
    """Call the Groq API with system + user prompts.

    Args:
        system_prompt: System-level instructions (role, constraints, output format).
        user_prompt: The developer's service request.

    Returns:
        The generated text content from Groq.

    Raises:
        RuntimeError: If all retries are exhausted or a non-retryable error occurs.
    """
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY environment variable is not set")

    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "top_p": 0.9,
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "User-Agent": "groq-python/0.9.0",
        "Accept": "application/json",
        "X-Stainless-Lang": "python",
        "X-Stainless-Package-Version": "0.9.0",
        "X-Stainless-OS": "Linux",
        "X-Stainless-Arch": "x64",
        "X-Stainless-Runtime": "CPython",
        "X-Stainless-Runtime-Version": "3.12.0",
    }

    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib_request.Request(
                GROQ_API_URL,
                data=payload,
                headers=headers,
                method="POST",
            )

            with urllib_request.urlopen(req, timeout=120) as resp:
                response_data = json.loads(resp.read().decode("utf-8"))

            content = response_data["choices"][0]["message"]["content"]

            usage = response_data.get("usage", {})
            logger.info(
                f"Groq API call successful: model={GROQ_MODEL}, "
                f"prompt_tokens={usage.get('prompt_tokens', '?')}, "
                f"completion_tokens={usage.get('completion_tokens', '?')}, "
                f"attempt={attempt + 1}"
            )

            return content

        except HTTPError as e:
            last_error = e
            status = e.code
            body = e.read().decode("utf-8", errors="replace")
            logger.warning(
                f"Groq API HTTP {status} on attempt {attempt + 1}/{MAX_RETRIES}: {body}"
            )

            # Retry on 429 (rate limit) and 5xx (server error)
            if status in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.info(f"Retrying in {delay}s...")
                time.sleep(delay)
                continue

            raise RuntimeError(
                f"Groq API error HTTP {status}: {body}"
            ) from e

        except URLError as e:
            last_error = e
            logger.warning(
                f"Groq API connection error on attempt {attempt + 1}/{MAX_RETRIES}: {e.reason}"
            )
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                time.sleep(delay)
                continue

            raise RuntimeError(
                f"Groq API connection failed after {MAX_RETRIES} attempts: {e.reason}"
            ) from e

    raise RuntimeError(f"Groq API failed after {MAX_RETRIES} attempts: {last_error}")
