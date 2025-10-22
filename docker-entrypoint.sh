#!/bin/sh
set -e

DB_PATH_DEFAULT="/app/data/app.db"
DATABASE_URL_VALUE="${DATABASE_URL:-data/app.db}"

# Normalise relative path to /app/...
case "$DATABASE_URL_VALUE" in
  /*) DB_PATH="$DATABASE_URL_VALUE" ;;
  *)
    # Strip leading ./ if present
    CLEAN_PATH="${DATABASE_URL_VALUE#./}"
    DB_PATH="/app/$CLEAN_PATH"
    ;;
esac

if [ "${RESET_DB_ON_START:-true}" = "true" ]; then
  # Only wipe if it resolves inside /app/data or matches default; guard against accidental deletes.
  case "$DB_PATH" in
    /app/data/*)
      if [ -f "$DB_PATH" ]; then
        echo "[entrypoint] Removing existing SQLite database at $DB_PATH"
        rm -f "$DB_PATH"
      else
        echo "[entrypoint] No SQLite database found at $DB_PATH (nothing to remove)"
      fi
      ;;
    *)
      echo "[entrypoint] Skipping database reset for path $DB_PATH (outside /app/data)"
      ;;
  esac
fi

exec "$@"
