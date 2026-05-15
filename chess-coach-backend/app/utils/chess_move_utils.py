def parse_uci_move(uci_move: str | None):
    if not uci_move:
        return None

    if len(uci_move) < 4:
        return None

    from_square = uci_move[0:2]
    to_square = uci_move[2:4]
    promotion = uci_move[4:] if len(uci_move) > 4 else None

    return {
        "from_square": from_square,
        "to_square": to_square,
        "promotion": promotion
    }