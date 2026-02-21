import logging

from config import settings

logger = logging.getLogger(__name__)

# Preferred Gemini models in priority order (best quality first, no previews).
# At startup the code tests each model with a tiny probe call and picks the
# first one that succeeds (i.e. has quota and exists on this API key).
_GEMINI_MODEL_PREFERENCE = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
]

# Cached model name — reset to "" to force re-probe on next call
_gemini_model_name: str = ""


def _is_quota_error(exc: Exception) -> bool:
    msg = str(exc)
    return "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower()


async def _probe_model(name: str) -> bool:
    """Return True if this model can handle a tiny generateContent call right now."""
    import google.generativeai as genai
    try:
        model = genai.GenerativeModel(model_name=name)
        await model.generate_content_async("ping")
        return True
    except Exception as e:
        msg = str(e)
        if _is_quota_error(e):
            logger.info(f"  {name}: quota exhausted — skipping")
        elif "not found" in msg.lower() or "404" in msg:
            logger.info(f"  {name}: not found — skipping")
        else:
            logger.info(f"  {name}: error ({msg[:60]}) — skipping")
        return False


async def _resolve_gemini_model(force_reprobe: bool = False) -> str:
    """Pick the best available Gemini model that has quota right now.

    If force_reprobe is True the cache is cleared and all models are re-tested.
    """
    global _gemini_model_name
    if _gemini_model_name and not force_reprobe:
        return _gemini_model_name

    if force_reprobe:
        logger.warning("Gemini: quota hit on cached model — re-probing all models...")
        _gemini_model_name = ""

    import google.generativeai as genai

    # Build set of models available on this API key
    try:
        available = {
            m.name.replace("models/", "")
            for m in genai.list_models()
            if "generateContent" in m.supported_generation_methods
        }
        logger.info(f"Gemini: {len(available)} models available — probing for quota...")
    except Exception as e:
        logger.warning(f"Could not list Gemini models: {e} — will probe preference list directly")
        available = set(_GEMINI_MODEL_PREFERENCE)

    # Test preferred models in order, pick first one with quota
    for candidate in _GEMINI_MODEL_PREFERENCE:
        if candidate not in available:
            continue
        logger.info(f"  Probing {candidate}...")
        if await _probe_model(candidate):
            _gemini_model_name = candidate
            logger.info(f"Gemini: selected model → {_gemini_model_name}")
            return _gemini_model_name

    # Last resort: try every available model until one works
    logger.warning("No preferred model had quota — trying all available models...")
    for candidate in sorted(available):
        if await _probe_model(candidate):
            _gemini_model_name = candidate
            logger.warning(f"Gemini: falling back to → {_gemini_model_name}")
            return _gemini_model_name

    raise RuntimeError(
        "No Gemini model has available quota. Check your API key or billing at "
        "https://aistudio.google.com"
    )


async def complete(system_prompt: str, user_prompt: str) -> str:
    if settings.llm_provider == "anthropic":
        return await _call_anthropic(system_prompt, user_prompt)
    if settings.llm_provider == "gemini":
        return await _call_gemini(system_prompt, user_prompt)
    return await _call_openai(system_prompt, user_prompt)


async def _call_openai(system_prompt: str, user_prompt: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=8192,
    )
    return response.choices[0].message.content


async def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text


async def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini, and if the selected model hits a quota error mid-session,
    automatically re-probe for a working model and retry once."""
    import google.generativeai as genai
    genai.configure(api_key=settings.gemini_api_key)

    model_name = await _resolve_gemini_model()

    for attempt in range(2):  # attempt 0: cached model, attempt 1: re-probed model
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
        )
        try:
            response = await model.generate_content_async(
                user_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8192,
                ),
            )
            return response.text
        except Exception as e:
            if _is_quota_error(e) and attempt == 0:
                logger.warning(
                    f"Gemini: quota exhausted on '{model_name}' during real call — "
                    f"re-probing for a working model..."
                )
                model_name = await _resolve_gemini_model(force_reprobe=True)
                # loop continues with the new model_name
            else:
                raise
