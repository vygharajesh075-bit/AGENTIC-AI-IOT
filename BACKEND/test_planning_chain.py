
from app.planning_chain import create_plan


def test_high_temperature_recommends_fan_on():
    result = create_plan(
        telemetry={
            "temperature_c": 35.0,
            "humidity_pct": 50.0,
            "vibration_g": 0.2,
            "fan_on": False,
        },
        confidence=0.9,
        severity="medium",
    )

    assert result["proposed_action"] == "fan_on"
    assert result["requires_safety_check"] is True


def test_invalid_sensor_data_prevents_action():
    result = create_plan(
        telemetry={
            "temperature_c": 35.0,
            "humidity_pct": 50.0,
            "vibration_g": 0.2,
            "fan_on": False,
        },
        confidence=0.9,
        sensor_valid=False,
    )

    assert result["proposed_action"] == "no_action"


def test_human_review_prevents_action():
    result = create_plan(
        telemetry={
            "temperature_c": 35.0,
            "humidity_pct": 50.0,
            "vibration_g": 0.2,
            "fan_on": False,
        },
        confidence=0.9,
        needs_human_review=True,
    )

    assert result["proposed_action"] == "no_action"


def test_cool_temperature_can_recommend_fan_off():
    result = create_plan(
        telemetry={
            "temperature_c": 25.0,
            "humidity_pct": 50.0,
            "vibration_g": 0.2,
            "fan_on": True,
        },
        confidence=0.9,
        severity="low",
    )

    assert result["proposed_action"] == "fan_off"


def test_planner_returns_trace():
    result = create_plan(
        telemetry={
            "temperature_c": 25.0,
            "humidity_pct": 50.0,
            "vibration_g": 0.2,
            "fan_on": False,
        },
        confidence=0.9,
    )

    assert isinstance(result["trace"], list)
    assert result["trace"][-1]["agent"] == "planning"
