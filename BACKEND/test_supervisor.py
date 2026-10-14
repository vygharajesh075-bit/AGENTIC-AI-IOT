
from app.agent_graph import route_after_supervisor, human_review_node


def test_supervisor_route_mapping():
    assert route_after_supervisor({"next_chain": "monitor"}) == "healthy"
    assert route_after_supervisor({"next_chain": "investigate"}) == "diagnosis"
    assert route_after_supervisor({"next_chain": "plan"}) == "planning"
    assert route_after_supervisor({"next_chain": "human_review"}) == "human_review"


def test_unknown_route_falls_back_to_diagnosis():
    assert route_after_supervisor({"next_chain": "unexpected"}) == "diagnosis"


def test_human_review_never_authorizes_action():
    state = {
        "trace": [],
        "telemetry": {"temperature_c": 45, "fan_on": False},
        "severity": "high",
        "sensor_valid": True,
        "flags": ["critical_temperature"],
    }

    result = human_review_node(state)

    assert result["needs_human_review"] is True
    assert result["approved_action"] == "no_action"
    assert result["safety_allowed"] is False
    assert result["after"]["fan_on"] is False
