# Error reporting, metrics and alerting

Status: **implemented in the API and tested; not wired to any monitoring service.** Nothing
here has run against a real Prometheus, Cloud Monitoring or paging system; the alert rules
below are examples to adapt.

## What the API records

- **Request logs** (`attune.http`): one line per request with request ID, method, route
  *template*, status and duration. No tokens, request bodies, trial events or message content.
- **Unhandled errors**: any unexpected exception returns a generic 500 with the request ID
  (no internals) and is logged as `unhandled_error request_id=… error_type=…`. The request ID
  in the user-visible error lets support find the exact log line.
- **Metrics**: `GET /metrics` in Prometheus text format, **disabled unless `METRICS_TOKEN` is
  set**; callers must send `Authorization: Bearer <token>`. Labels are route templates, method
  and status class only, so no identifier or personal data appears in a label.

| Metric | Type | Meaning |
|---|---|---|
| `attune_http_requests_total{method,route,status}` | counter | Requests by status class (`2xx`, `4xx`, `5xx`) |
| `attune_http_request_duration_ms_*{method,route}` | histogram | Latency buckets 25 ms … 5 s |
| `attune_unhandled_errors_total` | counter | Unhandled exceptions (HTTP 500) |

Counters are per instance and reset on restart (standard for scrapers; use `rate()`).
The edge/in-process limiter rejections appear as `4xx` on route `unmatched` or the route hit.

## Scraping

```yaml
scrape_configs:
  - job_name: attune-api
    metrics_path: /metrics
    authorization: { type: Bearer, credentials_file: /etc/attune/metrics-token }
    static_configs: [{ targets: ["attune-api:8080"] }]
```

On Cloud Run use Managed Service for Prometheus or a sidecar; or rely on Cloud Logging
log-based metrics over the `request_completed` / `unhandled_error` lines instead.

## Example alert rules

```yaml
groups:
  - name: attune-api
    rules:
      - alert: AttuneApiErrorRateHigh
        expr: sum(rate(attune_http_requests_total{status="5xx"}[5m])) / sum(rate(attune_http_requests_total[5m])) > 0.02
        for: 10m
        labels: { severity: page }
        annotations: { summary: "More than 2% of API requests are failing (5xx) for 10 minutes" }
      - alert: AttuneApiUnhandledErrors
        expr: increase(attune_unhandled_errors_total[15m]) > 0
        labels: { severity: ticket }
        annotations: { summary: "Unhandled exception in the API; find the request ID in the logs" }
      - alert: AttuneApiSlow
        expr: histogram_quantile(0.95, sum by (le) (rate(attune_http_request_duration_ms_bucket[5m]))) > 1000
        for: 15m
        labels: { severity: ticket }
        annotations: { summary: "API p95 latency above 1 s for 15 minutes" }
      - alert: AttuneApiDown
        expr: up{job="attune-api"} == 0
        for: 3m
        labels: { severity: page }
      - alert: AttuneRateLimitingSpike
        expr: sum(rate(attune_http_requests_total{status="4xx"}[5m])) > 20
        for: 10m
        labels: { severity: ticket }
        annotations: { summary: "Sustained 4xx volume (possible abuse or a broken client)" }
```

Also alert on the platform's own signals: container restarts, `/health/ready` failing (the
data store is unreachable), and Firestore quota or billing alerts in the Firebase project.

## Browser error reporting

The frontend has no third-party error reporter, on purpose: a hosted reporter would receive
page URLs and error text from participants and needs a privacy review and a data-processing
agreement first. Until one is chosen, browser problems are visible through the API (request
IDs shown in user-facing error messages) and through the end-to-end tests. To add a reporter
later, wire it in `src/app/error.tsx`-style boundaries and scrub URLs and messages before
sending.
