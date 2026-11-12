"""Tiny in-process request metrics in Prometheus text format (no extra dependencies).

Counters are per instance and reset on restart, which is what Prometheus-style scrapers
expect. Labels are the route *template* (never the raw URL), method and status class, so no
identifier or personal data can end up in a label.
"""

from __future__ import annotations

from collections import defaultdict
from threading import Lock

BUCKETS_MS = (25, 50, 100, 250, 500, 1000, 2500, 5000)


class Metrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._requests: dict[tuple[str, str, str], int] = defaultdict(int)
        self._duration_buckets: dict[tuple[str, str], list[int]] = defaultdict(
            lambda: [0] * (len(BUCKETS_MS) + 1)
        )
        self._duration_sum: dict[tuple[str, str], float] = defaultdict(float)
        self._unhandled = 0

    def observe(self, method: str, route: str, status: int, duration_ms: float) -> None:
        status_class = f"{status // 100}xx"
        with self._lock:
            self._requests[(method, route, status_class)] += 1
            key = (method, route)
            buckets = self._duration_buckets[key]
            for index, bound in enumerate(BUCKETS_MS):
                if duration_ms <= bound:
                    buckets[index] += 1
                    break
            else:
                buckets[-1] += 1
            self._duration_sum[key] += duration_ms

    def unhandled_error(self) -> None:
        with self._lock:
            self._unhandled += 1

    def render(self) -> str:
        lines = [
            "# HELP attune_http_requests_total Requests by route template, method and status class.",
            "# TYPE attune_http_requests_total counter",
        ]
        with self._lock:
            for (method, route, status_class), count in sorted(self._requests.items()):
                labels = f'method="{method}",route="{route}",status="{status_class}"'
                lines.append(f"attune_http_requests_total{{{labels}}} {count}")
            lines += [
                "# HELP attune_http_request_duration_ms Request duration in milliseconds.",
                "# TYPE attune_http_request_duration_ms histogram",
            ]
            for (method, route), buckets in sorted(self._duration_buckets.items()):
                labels = f'method="{method}",route="{route}"'
                cumulative = 0
                for bound, count in zip(BUCKETS_MS, buckets, strict=False):
                    cumulative += count
                    lines.append(
                        f'attune_http_request_duration_ms_bucket{{{labels},le="{bound}"}} {cumulative}'
                    )
                cumulative += buckets[-1]
                lines.append(f'attune_http_request_duration_ms_bucket{{{labels},le="+Inf"}} {cumulative}')
                total = round(self._duration_sum[(method, route)], 2)
                lines.append(f"attune_http_request_duration_ms_sum{{{labels}}} {total}")
                lines.append(f"attune_http_request_duration_ms_count{{{labels}}} {cumulative}")
            lines += [
                "# HELP attune_unhandled_errors_total Unhandled exceptions (HTTP 500).",
                "# TYPE attune_unhandled_errors_total counter",
                f"attune_unhandled_errors_total {self._unhandled}",
            ]
        return "\n".join(lines) + "\n"
