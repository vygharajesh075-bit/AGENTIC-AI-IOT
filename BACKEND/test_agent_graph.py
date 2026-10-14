
import pytest

from app.agent_graph import run_agents


@pytest.fixture
def normal_telemetry():
    return {
        "temperature_c": 25.0,
        "humidity_pct": 50.0,
        "vibration_g": 0.2,
        "fan_on": False,
    }


def test_graph_returns_state(normal_telemetry):
    result = run_agents(normal_telemetry)

    assert isinstance(result, dict)


def test_graph_does_not_crash_on_previous_reading(normal_telemetry):
    previous = {
        "temperature_c": 24.0,
        "humidity_pct": 48.0,
        "vibration_g": 0.2,
        "fan_on": False,
    }

    result = run_agents(normal_telemetry, previous)

    assert isinstance(result, dict)


def test_graph_handles_high_temperature():
    telemetry = {
        "temperature_c": 42.0,
        "humidity_pct": 50.0,
        "vibration_g": 0.2,
        "fan_on": False,
    }

    result = run_agents(telemetry)

    assert isinstance(result, dict)
    assert isinstance(result.get("trace", []), list)
