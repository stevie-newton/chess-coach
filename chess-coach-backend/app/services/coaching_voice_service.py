COACH_PERSONALITIES = {
    "friendly": {
        "label": "Friendly Coach",
        "instruction": (
            "Use a warm, encouraging trainer voice. Praise the useful idea first, then explain the correction "
            "in plain language with one concrete next step."
        ),
        "correct": "Good tactical vision.",
        "incorrect": "Good try. The key idea was a little sharper here.",
        "illegal": "Let's reset the position first.",
    },
    "strict": {
        "label": "Strict Coach",
        "instruction": (
            "Use a direct, disciplined trainer voice. Be concise, name the missed pattern, and give a clear rule "
            "the player should apply before moving."
        ),
        "correct": "Correct. That is the disciplined move.",
        "incorrect": "This misses the critical resource.",
        "illegal": "Illegal move. Check the board before calculating.",
    },
    "grandmaster": {
        "label": "Grandmaster Style Coach",
        "instruction": (
            "Use a grandmaster-style voice. Emphasize candidate moves, forcing moves, king safety, conversion, "
            "and positional consequences while staying readable."
        ),
        "correct": "Excellent. You found the position's main forcing idea.",
        "incorrect": "The move is playable, but it misses the position's strongest candidate.",
        "illegal": "That candidate is not legal, so it leaves calculation immediately.",
    },
}


def normalize_coach_personality(value: str | None) -> str:
    key = (value or "friendly").strip().lower().replace(" ", "_").replace("-", "_")
    if key in {"friendly_coach", "friendly"}:
        return "friendly"
    if key in {"strict_coach", "strict"}:
        return "strict"
    if key in {"grandmaster_style_coach", "grandmaster_style", "grandmaster"}:
        return "grandmaster"
    return "friendly"


def coach_voice(personality: str | None) -> dict:
    return COACH_PERSONALITIES[normalize_coach_personality(personality)]


def trainer_reaction(is_correct: bool, is_legal: bool, personality: str | None, theme: str | None = None) -> str:
    voice = coach_voice(personality)
    if not is_legal:
        return voice["illegal"]

    base = voice["correct"] if is_correct else voice["incorrect"]
    theme_text = (theme or "").lower()

    if is_correct and "endgame" in theme_text:
        return "Excellent endgame conversion."
    if not is_correct and "king" in theme_text:
        return "Your king safety was weak."
    if not is_correct and "discovered" in theme_text:
        return "You missed a discovered attack."

    return base
