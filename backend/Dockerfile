# Attune API container (FastAPI + Firebase Admin). See docs/deployment.md.
#
# No credentials are baked in. On Google Cloud, attach a service account to the service and the
# Firebase Admin SDK picks it up through Application Default Credentials (workload identity).
# Never copy a service-account key file into this image.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /srv

# Run as an unprivileged user.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin appuser

# Dependencies first, so this layer is cached until requirements.txt changes.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Only the application: no tests, scripts, archive, env files or emulator logs.
COPY app ./app

USER appuser
EXPOSE 8080

# Liveness only (does not touch Firestore). Readiness is /health/ready.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:%s/health/live' % os.environ.get('PORT','8080'), timeout=2)"

# uvicorn honours X-Forwarded-For only from addresses in FORWARDED_ALLOW_IPS (default 127.0.0.1).
# Set it to your proxy/load-balancer addresses so rate limiting sees real client addresses.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
