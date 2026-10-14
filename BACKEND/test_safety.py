
from app.safety_policy import validate_action


def valid_telemetry(**overrides):
    data = {
        "temperature_c": 35.0,
        "humidity_pct": 50.0,
        "vibration_g": 0.2,
        "fan_on": False,
    }
    data.update(overrides)
    return data


def test_fan_on_allowed_with_valid_readings():
    result = validate_action(
        valid_telemetry(),
        action="fan_on",
        confidence=0.9,
    )

    assert result["allowed"] is True
    assert result["approved_action"] == "fan_on"


def test_fan_off_blocked_at_high_temperature():
    result = validate_action(
        valid_telemetry(temperature_c=35.0),
        action="fan_off",
        confidence=0.9,
    )

    assert result["allowed"] is False
    assert result["approved_action"] == "no_action"


def test_low_confidence_blocks_state_change():
    result = validate_action(
        valid_telemetry(),
        action="fan_on",
        confidence=0.3,
    )

    assert result["allowed"] is False


def test_invalid_humidity_is_rejected():
    result = validate_action(
        valid_telemetry(humidity_pct=150),
        action="fan_on",
        confidence=0.9,
    )

    assert result["allowed"] is False


def test_unknown_action_is_rejected():
    result = validate_action(
        valid_telemetry(),
        action="disable_alarm",
        confidence=0.9,
    )

    assert result["allowed"] is False
    assert result["approved_action"] == "no_action"
