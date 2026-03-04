import os
import sys

import psycopg2


def _missing_required_env():
    required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"]
    missing = [name for name in required if not os.environ.get(name)]
    return missing


def main():
    if os.environ.get("USE_POSTGRES", "false").lower() != "true":
        print("USE_POSTGRES is not true, skip PostgreSQL connection check.")
        return 0

    missing = _missing_required_env()
    if missing:
        print(f"Missing required env vars for PostgreSQL: {', '.join(missing)}")
        return 1

    try:
        conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASS"],
            connect_timeout=5,
        )
        conn.close()
        print("PostgreSQL connection check passed.")
        return 0
    except Exception as exc:
        print(f"PostgreSQL connection check failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

