# syntax=docker/dockerfile:1

# A Docker image is a snapshot of a tiny Linux machine with your app already installed.
# "slim" is the small Debian variant: enough to run Python, without compilers or extras.
FROM python:3.14-slim

# PYTHONDONTWRITEBYTECODE: skip .pyc files, they are useless in a throwaway container.
# PYTHONUNBUFFERED: print logs immediately instead of holding them in a buffer.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copy ONLY requirements first. Docker caches each step and reuses this expensive
# install whenever requirements.txt has not changed - even if all your code did.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Now the application code, which changes on nearly every build.
COPY . .

# Gather Django's own static files (admin, API docs) into /app/staticfiles.
# DEBUG is off here, so the settings guards demand a key and a host; these are
# throwaway build-time values that never reach the running container.
RUN DJANGO_DEBUG=0 \
    DJANGO_SECRET_KEY=build-time-only-not-a-real-secret \
    DJANGO_ALLOWED_HOSTS=build.invalid \
    python manage.py collectstatic --noinput

# Run as a normal user, not root: if the app is ever compromised, the attacker
# does not automatically own the whole container.
RUN useradd --system --create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app/media \
    && chown -R app:app /app
USER app

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
