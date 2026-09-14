"""Pure financial policy for the GoodCause Impact Commitment."""


def split_net_proceeds(net_proceeds_kobo: int) -> tuple[int, int]:
    """Return whole-kobo (impact, operations) amounts without losing money."""
    if net_proceeds_kobo < 0:
        raise ValueError("Net proceeds must be non-negative")
    impact = net_proceeds_kobo * 80 // 100
    return impact, net_proceeds_kobo - impact


def allocate_equally(available_kobo: int, campaigns: list[dict]) -> dict:
    """Allocate equally up to each campaign's remaining goal."""
    if available_kobo < 0:
        raise ValueError("Available impact must be non-negative")

    capacities = {
        campaign["id"]: max(0, campaign["goal_kobo"] - campaign.get("raised_kobo", 0))
        for campaign in campaigns
    }
    allocated = {campaign_id: 0 for campaign_id in capacities}
    remaining = available_kobo
    active = sorted(campaign_id for campaign_id, capacity in capacities.items() if capacity > 0)

    while remaining > 0 and active:
        share, bonus_count = divmod(remaining, len(active))
        spent = 0
        for index, campaign_id in enumerate(active):
            proposed = share + (1 if index < bonus_count else 0)
            room = capacities[campaign_id] - allocated[campaign_id]
            amount = min(proposed, room)
            allocated[campaign_id] += amount
            spent += amount
        remaining -= spent
        active = [
            campaign_id
            for campaign_id in active
            if allocated[campaign_id] < capacities[campaign_id]
        ]
        if spent == 0:
            break

    rows = [
        {
            "campaign_id": campaign_id,
            "amount_kobo": allocated[campaign_id],
            "remaining_goal_snapshot_kobo": capacities[campaign_id],
        }
        for campaign_id in sorted(allocated)
        if allocated[campaign_id] > 0
    ]
    total = sum(row["amount_kobo"] for row in rows)
    return {
        "allocations": rows,
        "allocated_kobo": total,
        "rollover_kobo": available_kobo - total,
    }
