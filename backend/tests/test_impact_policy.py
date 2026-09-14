import pytest

from impact_policy import allocate_equally, split_net_proceeds


def test_split_preserves_every_kobo_when_percentage_has_a_fraction():
    assert split_net_proceeds(101) == (80, 21)


def test_split_rejects_negative_proceeds():
    with pytest.raises(ValueError, match="non-negative"):
        split_net_proceeds(-1)


def test_equal_allocation_caps_a_nearly_funded_campaign_and_redistributes_excess():
    result = allocate_equally(1_000, [
        {"id": "b", "goal_kobo": 10_000, "raised_kobo": 0},
        {"id": "a", "goal_kobo": 100, "raised_kobo": 0},
    ])

    assert result == {
        "allocations": [
            {"campaign_id": "a", "amount_kobo": 100, "remaining_goal_snapshot_kobo": 100},
            {"campaign_id": "b", "amount_kobo": 900, "remaining_goal_snapshot_kobo": 10_000},
        ],
        "allocated_kobo": 1_000,
        "rollover_kobo": 0,
    }


def test_equal_allocation_is_deterministic_and_preserves_remainder_kobo():
    campaigns = [
        {"id": "c", "goal_kobo": 10, "raised_kobo": 0},
        {"id": "a", "goal_kobo": 10, "raised_kobo": 0},
        {"id": "b", "goal_kobo": 10, "raised_kobo": 0},
    ]

    forward = allocate_equally(5, campaigns)
    reverse = allocate_equally(5, list(reversed(campaigns)))

    assert forward == reverse == {
        "allocations": [
            {"campaign_id": "a", "amount_kobo": 2, "remaining_goal_snapshot_kobo": 10},
            {"campaign_id": "b", "amount_kobo": 2, "remaining_goal_snapshot_kobo": 10},
            {"campaign_id": "c", "amount_kobo": 1, "remaining_goal_snapshot_kobo": 10},
        ],
        "allocated_kobo": 5,
        "rollover_kobo": 0,
    }


def test_equal_allocation_rolls_over_money_after_every_campaign_reaches_its_cap():
    result = allocate_equally(1_000, [
        {"id": "a", "goal_kobo": 300, "raised_kobo": 200},
        {"id": "b", "goal_kobo": 250, "raised_kobo": 200},
    ])

    assert result["allocated_kobo"] == 150
    assert result["rollover_kobo"] == 850
    assert [row["amount_kobo"] for row in result["allocations"]] == [100, 50]


@pytest.mark.parametrize("available,campaigns", [
    (0, [{"id": "a", "goal_kobo": 100, "raised_kobo": 0}]),
    (500, []),
    (500, [{"id": "done", "goal_kobo": 100, "raised_kobo": 100}]),
])
def test_equal_allocation_handles_zero_capacity(available, campaigns):
    result = allocate_equally(available, campaigns)
    assert result == {"allocations": [], "allocated_kobo": 0, "rollover_kobo": available}


def test_equal_allocation_rejects_negative_available_amount():
    with pytest.raises(ValueError, match="non-negative"):
        allocate_equally(-1, [])
