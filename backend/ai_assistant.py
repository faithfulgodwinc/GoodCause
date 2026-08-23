"""AI Campaign Assistant — supportive suggestions only (Gemini 3 Flash via Emergent key)."""
import os
import json
import re
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List

from core import get_current_user, track

router = APIRouter(prefix="/api/ai", tags=["ai"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

SYSTEM = (
    "You are the GoodCause Campaign Assistant, helping people in Nigeria draft honest, clear "
    "donation fundraising campaigns. Currency is Nigerian Naira (₦). You are SUPPORTIVE, not "
    "authoritative. You MUST NOT approve or reject campaigns, declare anything fraudulent, make "
    "legal or medical claims, or promise outcomes. Write in warm, human, respectful language. "
    "Never invent specific facts (names, hospitals, amounts) the user did not provide. "
    "Respond ONLY with a valid JSON object, no markdown fences."
)


class AssistIn(BaseModel):
    raw_text: str = Field(min_length=10, max_length=4000)


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        text = m.group(0)
    return json.loads(text)


@router.post("/campaign-assistant")
async def campaign_assistant(body: AssistIn, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="The AI assistant is not available right now.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        raise HTTPException(status_code=503, detail="The AI assistant is not available right now.")

    prompt = (
        "A fundraiser described their situation below. Draft campaign content strictly based on "
        "what they wrote. Return JSON with EXACTLY these keys:\n"
        '{\n'
        '  "title": "<punchy, honest title, max 70 chars>",\n'
        '  "summary": "<1-2 sentence summary, max 200 chars>",\n'
        '  "story": "<3-5 short warm paragraphs, plain text with \\n\\n between paragraphs>",\n'
        '  "expense_categories": [{"item": "<label>", "note": "<why, optional>"}],\n'
        '  "social_copy": "<short shareable message with a call to support>",\n'
        '  "review_note": "<one sentence reminding the user to review and correct all details>"\n'
        "}\n"
        "Do not fabricate specific amounts unless the user gave them. Keep expense_categories to 3-5 items.\n\n"
        f"Fundraiser wrote:\n{body.raw_text}"
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"assist_{user['id']}",
                   system_message=SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    try:
        response = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        raise HTTPException(status_code=502, detail="The assistant couldn’t respond. Please try again.")

    text = response if isinstance(response, str) else str(response)
    try:
        data = _extract_json(text)
    except Exception:
        raise HTTPException(status_code=502, detail="The assistant couldn’t respond. Please try again.")

    await track("ai_assistant_used", user["id"])
    return {
        "title": data.get("title", ""),
        "summary": data.get("summary", ""),
        "story": data.get("story", ""),
        "expense_categories": data.get("expense_categories", []),
        "social_copy": data.get("social_copy", ""),
        "review_note": data.get("review_note",
                                "Please review and correct all details before publishing."),
        "disclaimer": "AI-generated draft. Review carefully — you are responsible for accuracy.",
    }
