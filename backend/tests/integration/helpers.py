"""Shared helpers for integration tests."""


async def _user(db, name):
    conn = await db.get_conn()
    try:
        row = await conn.fetchrow(
            "INSERT INTO users (github_id, username) VALUES ($1, $2) RETURNING id",
            abs(hash(name)) % 10**9, name,
        )
        return str(row["id"])
    finally:
        await db.release_conn(conn)


def _session(name):
    return {"user": {"username": name}, "access_token": "t"}
