#include <drogon/drogon.h>

int main()
{
    drogon::app().loadConfigFile("config.json");

    drogon::app().registerBeginningAdvice([]() {
        LOG_INFO << "initializing schema";
        auto db = drogon::app().getDbClient();

        db->execSqlSync(R"SQL(
            CREATE TABLE IF NOT EXISTS sessions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at   INTEGER NOT NULL,
                duration_ms  INTEGER,
                tz           TEXT,
                hour         INTEGER,
                weekday      INTEGER,
                lang         TEXT,
                viewport_w   INTEGER,
                viewport_h   INTEGER,
                q_mood       TEXT,
                q_time       TEXT,
                q_help       TEXT,
                q_word_len   INTEGER,
                route        TEXT,
                created_at   INTEGER NOT NULL
            )
        )SQL");

        db->execSqlSync(R"SQL(
            CREATE TABLE IF NOT EXISTS session_themes (
                session_id   INTEGER NOT NULL,
                theme        TEXT    NOT NULL,
                PRIMARY KEY (session_id, theme)
            )
        )SQL");

        db->execSqlSync(R"SQL(
            CREATE TABLE IF NOT EXISTS session_events (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id   INTEGER NOT NULL,
                event        TEXT    NOT NULL,
                t_ms         INTEGER,
                step         INTEGER,
                payload      TEXT
            )
        )SQL");

        db->execSqlSync("CREATE INDEX IF NOT EXISTS idx_sessions_route   ON sessions(route)");
        db->execSqlSync("CREATE INDEX IF NOT EXISTS idx_sessions_hour    ON sessions(hour)");
        db->execSqlSync("CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at)");
        db->execSqlSync("CREATE INDEX IF NOT EXISTS idx_themes_theme     ON session_themes(theme)");
        db->execSqlSync("CREATE INDEX IF NOT EXISTS idx_events_session   ON session_events(session_id)");

        LOG_INFO << "schema ready";
    });

    LOG_INFO << "caderno starting";
    drogon::app().run();
    return 0;
}
