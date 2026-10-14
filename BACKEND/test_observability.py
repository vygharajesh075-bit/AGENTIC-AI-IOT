
from app.observability import Observability


def test_successful_agent_run_is_recorded():
    monitor = Observability()

    monitor.record_agent_run(
        action="fan_on",
        duration_seconds=0.25,
        success=True,
    )

    snapshot = monitor.get_snapshot()

    assert snapshot["agent_runs"] == 1
    assert snapshot["agent_failures"] == 0
    assert snapshot["actions"]["fan_on"] == 1
    assert snapshot["failure_rate"] == 0.0


def test_failed_run_and_error_are_recorded():
    monitor = Observability()

    monitor.record_agent_run(
        action="no_action",
        duration_seconds=0.1,
        success=False,
    )
    monitor.record_error(
        RuntimeError("test error"),
        component="planning",
    )

    snapshot = monitor.get_snapshot()

    assert snapshot["status"] == "degraded"
    assert snapshot["agent_failures"] == 1
    assert snapshot["errors_by_component"]["planning"] == 1


def test_invalid_duration_is_safely_handled():
    monitor = Observability()

    monitor.record_agent_run(duration_seconds=float("nan"))

    snapshot = monitor.get_snapshot()
    assert snapshot["average_duration_seconds"] == 0.0


def test_reset_clears_metrics():
    monitor = Observability()
    monitor.record_agent_run(action="fan_on")
    monitor.reset()

    snapshot = monitor.get_snapshot()

    assert snapshot["agent_runs"] == 0
    assert snapshot["actions"] == {}
    assert snapshot["recent_events"] == []
