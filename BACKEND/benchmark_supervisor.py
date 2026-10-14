
from statistics import median
from time import perf_counter

from app.supervisor import supervisor_decision

cases = [
    {
        "flags": [],
        "severity": "low",
        "sensor_valid": True,
        "confidence": 0.99,
    },
    {
        "flags": ["high_temperature"],
        "severity": "low",
        "sensor_valid": True,
        "confidence": 0.9,
    },
]

for case in cases:
    timings = []

    for _ in range(5):
        start = perf_counter()
        result = supervisor_decision(case)
        timings.append((perf_counter() - start) * 1000)

    print(
        "Route:", result["next_chain"],
        "| Provider:", result.get("supervisor_provider"),
        "| Median ms:", round(median(timings), 2),
    )
