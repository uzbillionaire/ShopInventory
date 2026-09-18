#!/bin/sh
# Runs every time the web container starts, before the server itself.
# "set -e" aborts on the first failing command, so a broken migration stops
# the container loudly instead of serving a half-updated database.
set -e

echo "==> Applying database migrations"
python manage.py migrate --noinput

echo "==> Starting gunicorn"
# "exec" replaces this shell with gunicorn, so gunicorn becomes process 1 and
# receives Docker's stop signal directly - that means clean, fast shutdowns.
#
# workers  = separate processes, each handling one request at a time (roughly: CPU cores)
# threads  = extra lanes per worker, cheap for apps that mostly wait on the database
# timeout  = kill and restart a worker stuck longer than this many seconds
exec gunicorn root.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --threads "${GUNICORN_THREADS:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile - \
    --capture-output
