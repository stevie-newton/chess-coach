import requests

from app.core.config import settings
from app.models.user import User
from app.services.coaching_voice_service import coach_voice


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


FOCUS_LIBRARY = {
    "tactics": [
        "Forcing moves",
        "Loose pieces",
        "Checks, captures, threats",
    ],
    "openings": [
        "Piece development",
        "King safety",
        "First 10 move review",
    ],
    "endgames": [
        "Opposition",
        "Pawn promotion races",
        "King activity",
    ],
}


def _fallback_report(completion_report: dict, user: User) -> dict:
    categories = completion_report["categories"]
    next_focus = completion_report["next_focus"]
    focus_items = FOCUS_LIBRARY.get(next_focus, FOCUS_LIBRARY["tactics"])
    tactics_label = categories["tactics"]["label"].lower()
    endgame_label = categories["endgames"]["label"].lower()

    if categories["tactics"]["score"] >= 70:
        opening_line = "You improved your tactical awareness today."
    else:
        opening_line = "Your tactical awareness is starting to build, but it still needs more repetition."

    if categories["endgames"]["score"] < 60:
        weakness_line = "However, your endgame technique still needs work."
    elif categories["openings"]["score"] < 60:
        weakness_line = "However, your opening recall still needs cleaner repetition."
    else:
        weakness_line = "Your overall training balance is moving in the right direction."

    return {
        "source": "fallback",
        "headline": "Coach Report",
        "body": f"{opening_line} {weakness_line}",
        "recommended_focus": focus_items,
        "coach_note": (
            f"Today graded tactics as {tactics_label} and endgames as {endgame_label}. "
            f"Your next focused block should be {next_focus}."
        ),
    }


def _extract_text(response_json: dict) -> str:
    if response_json.get("output_text"):
        return response_json["output_text"].strip()

    chunks = []
    for item in response_json.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                chunks.append(content["text"])

    return "\n".join(chunks).strip()


def _openai_report(completion_report: dict, user: User, fallback: dict) -> dict | None:
    if not settings.OPENAI_API_KEY:
        return None

    voice = coach_voice(user.coach_personality)
    focus_items = FOCUS_LIBRARY.get(completion_report["next_focus"], FOCUS_LIBRARY["tactics"])
    categories = completion_report["categories"]

    prompt = "\n".join(
        [
            "Create a short post-training chess coach report.",
            "Return plain text only, no markdown table.",
            "Use this exact structure:",
            "1 short paragraph of feedback.",
            "Recommended focus:",
            "- item",
            "- item",
            "- item",
            "",
            f"Accuracy: {completion_report['accuracy']}%",
            f"Tactics: {categories['tactics']['label']} ({categories['tactics']['score']}%)",
            f"Openings: {categories['openings']['label']} ({categories['openings']['score']}%)",
            f"Endgames: {categories['endgames']['label']} ({categories['endgames']['score']}%)",
            f"Next focus: {completion_report['next_focus']}",
            f"Recommended focus items: {', '.join(focus_items)}",
            f"Fallback report: {fallback['body']}",
        ]
    )

    try:
        response = requests.post(
            OPENAI_RESPONSES_URL,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.OPENAI_MODEL,
                "instructions": (
                    "You are a practical chess trainer writing after-session feedback. "
                    f"Personality: {voice['label']}. {voice['instruction']} "
                    "Be specific, encouraging, and direct. Do not invent stats."
                ),
                "input": prompt,
            },
            timeout=25,
        )
        response.raise_for_status()
    except requests.RequestException:
        return None

    text = _extract_text(response.json())
    if not text:
        return None

    return {
        **fallback,
        "source": "openai",
        "body": text,
    }


def build_post_training_report(completion_report: dict, user: User) -> dict:
    fallback = _fallback_report(completion_report=completion_report, user=user)
    openai_report = _openai_report(
        completion_report=completion_report,
        user=user,
        fallback=fallback,
    )

    return openai_report or fallback
