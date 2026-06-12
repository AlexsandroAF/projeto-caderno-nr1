#include "ApiController.h"

#include <drogon/drogon.h>
#include <drogon/orm/DbClient.h>
#include <drogon/orm/Exception.h>
#include <json/json.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <ctime>
#include <memory>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>

using namespace drogon;
using namespace drogon::orm;

namespace
{
// Os três espelhos (+ o recorte), na ordem das páginas. O índice na lista + 1
// corresponde ao `step` que o frontend emite em step_enter (1=sozinho … 4=recorte).
const std::vector<std::pair<std::string, std::string>> MIRROR_STEPS = {
    {"sozinho", "prefiro ficar sozinho(a)"},
    {"emocoes", "não sinto as emoções como os outros"},
    {"confiar", "dificuldade em confiar ou se abrir"},
    {"recorte", "chegaram ao recorte"},
};

int64_t nowMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

std::string isoFromMs(int64_t ms)
{
    if (ms <= 0) return {};
    std::time_t t = ms / 1000;
    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return std::string(buf);
}

std::string extractRoute(const Json::Value& events)
{
    if (!events.isArray()) return {};
    for (const auto& e : events) {
        if (e.isObject() && e.get("e", "").asString() == "route_shown") {
            return e.get("route", "").asString();
        }
    }
    return {};
}

std::string serializeEvent(const Json::Value& v)
{
    Json::StreamWriterBuilder b;
    b["indentation"] = "";
    return Json::writeString(b, v);
}

HttpResponsePtr noContent()
{
    auto resp = HttpResponse::newHttpResponse();
    resp->setStatusCode(k204NoContent);
    return resp;
}

HttpResponsePtr badRequest(const std::string& msg)
{
    Json::Value j;
    j["error"] = msg;
    auto resp = HttpResponse::newHttpJsonResponse(j);
    resp->setStatusCode(k400BadRequest);
    return resp;
}

HttpResponsePtr serverError()
{
    Json::Value j;
    j["error"] = "stats unavailable";
    auto resp = HttpResponse::newHttpJsonResponse(j);
    resp->setStatusCode(k500InternalServerError);
    return resp;
}

}  // namespace

// ----------------------------------------------------------------------------
// POST /api/submit
// ----------------------------------------------------------------------------
void ApiController::submit(const HttpRequestPtr& req,
                           std::function<void(const HttpResponsePtr&)>&& cb)
{
    auto json = req->getJsonObject();
    if (!json) {
        cb(badRequest("invalid json"));
        return;
    }
    const auto& payload = *json;

    int64_t duration_ms = payload.get("duration_ms", 0).asInt64();
    std::string tz      = payload.get("tz", "").asString();
    int hour            = payload.get("hour", -1).asInt();
    int weekday         = payload.get("weekday", -1).asInt();
    std::string lang    = payload.get("lang", "").asString();

    int viewport_w = 0, viewport_h = 0;
    if (payload.isMember("viewport") && payload["viewport"].isObject()) {
        viewport_w = payload["viewport"].get("w", 0).asInt();
        viewport_h = payload["viewport"].get("h", 0).asInt();
    }

    Json::Value answers = payload.get("answers", Json::Value(Json::objectValue));
    Json::Value events  = payload.get("events",  Json::Value(Json::arrayValue));

    std::string q_mood = answers.get("q_mood", "").asString();
    std::string q_time = answers.get("q_time", "").asString();
    std::string q_help = answers.get("q_help", "").asString();
    int q_word_len     = answers.get("q_word_len", 0).asInt();
    std::string route  = extractRoute(events);

    int64_t now        = nowMs();
    int64_t started_at = now - duration_ms;

    auto db = drogon::app().getDbClient();
    try {
        auto trans = db->newTransaction();

        auto rows = trans->execSqlSync(
            "INSERT INTO sessions "
            "(started_at, duration_ms, tz, hour, weekday, lang, "
            " viewport_w, viewport_h, q_mood, q_time, q_help, q_word_len, route, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            started_at, duration_ms, tz, hour, weekday, lang,
            viewport_w, viewport_h,
            q_mood, q_time, q_help, q_word_len, route, now);

        int64_t sid = static_cast<int64_t>(rows.insertId());

        // multi-select themes
        if (answers.isMember("q_themes") && answers["q_themes"].isArray()) {
            for (const auto& t : answers["q_themes"]) {
                if (!t.isString()) continue;
                trans->execSqlSync(
                    "INSERT OR IGNORE INTO session_themes (session_id, theme) VALUES (?, ?)",
                    sid, t.asString());
            }
        }

        // events
        if (events.isArray()) {
            for (const auto& e : events) {
                if (!e.isObject()) continue;
                trans->execSqlSync(
                    "INSERT INTO session_events "
                    "(session_id, event, t_ms, step, payload) VALUES (?,?,?,?,?)",
                    sid,
                    e.get("e", "").asString(),
                    e.get("t", 0).asInt64(),
                    e.get("step", 0).asInt(),
                    serializeEvent(e));
            }
        }
    }
    catch (const DrogonDbException& ex) {
        LOG_ERROR << "submit failed (db): " << ex.base().what();
        cb(serverError());
        return;
    }
    catch (const std::exception& ex) {
        LOG_ERROR << "submit failed: " << ex.what();
        cb(serverError());
        return;
    }

    cb(noContent());
}

// ----------------------------------------------------------------------------
// GET /api/stats
// ----------------------------------------------------------------------------
void ApiController::stats(const HttpRequestPtr& /*req*/,
                          std::function<void(const HttpResponsePtr&)>&& cb)
{
    auto db = drogon::app().getDbClient();
    Json::Value out;

    try {
        // total = sessões registradas (visitantes que passaram da acolhida)
        int64_t total = 0;
        {
            auto rows = db->execSqlSync("SELECT COUNT(*) AS n FROM sessions");
            if (!rows.empty()) total = rows[0]["n"].as<int64_t>();
        }
        out["total"] = static_cast<Json::Int64>(total);

        // last update timestamp
        {
            auto rows = db->execSqlSync(
                "SELECT MAX(created_at) AS t FROM sessions");
            int64_t maxt = 0;
            if (!rows.empty() && !rows[0]["t"].isNull()) {
                maxt = rows[0]["t"].as<int64_t>();
            }
            out["updated"] = isoFromMs(maxt > 0 ? maxt : nowMs());
        }

        const auto pct = [&](int64_t n) -> int {
            if (total <= 0) return 0;
            return static_cast<int>(std::round(100.0 * static_cast<double>(n) /
                                               static_cast<double>(total)));
        };

        // mirrors — quantas sessões alcançam cada espelho (funil por step_enter)
        {
            std::unordered_map<int, int64_t> perStep;
            auto rows = db->execSqlSync(
                "SELECT step, COUNT(DISTINCT session_id) AS n FROM session_events "
                "WHERE event = 'step_enter' GROUP BY step");
            for (const auto& r : rows) {
                perStep[r["step"].as<int>()] = r["n"].as<int64_t>();
            }
            Json::Value arr(Json::arrayValue);
            int stepIdx = 1;  // 1=sozinho, 2=emoções, 3=confiar, 4=recorte
            for (const auto& [key, label] : MIRROR_STEPS) {
                int64_t n = perStep.count(stepIdx) ? perStep[stepIdx] : 0;
                Json::Value row;
                row["key"]   = key;
                row["label"] = label;
                row["pct"]   = pct(n);
                arr.append(row);
                ++stepIdx;
            }
            out["mirrors"] = arr;
        }

        // facets — leituras (transtornos) mais abertas; % de pessoas que abriram.
        // o nome do transtorno vem no payload do evento facet_open.
        {
            auto rows = db->execSqlSync(
                "SELECT session_id, payload FROM session_events "
                "WHERE event = 'facet_open'");
            std::unordered_map<std::string, std::set<int64_t>> bySession;
            Json::CharReaderBuilder rb;
            for (const auto& r : rows) {
                std::string p = r["payload"].as<std::string>();
                int64_t sid   = r["session_id"].as<int64_t>();
                Json::Value ev;
                std::string errs;
                std::unique_ptr<Json::CharReader> reader(rb.newCharReader());
                if (reader->parse(p.c_str(), p.c_str() + p.size(), &ev, &errs)) {
                    std::string facet = ev.get("facet", "").asString();
                    if (!facet.empty()) bySession[facet].insert(sid);
                }
            }
            struct Item { std::string label; int64_t n; };
            std::vector<Item> items;
            items.reserve(bySession.size());
            for (const auto& [facet, ids] : bySession) {
                std::string label = facet;
                if (label.rfind("No ", 0) == 0) label = label.substr(3);  // tira "No "
                items.push_back({label, static_cast<int64_t>(ids.size())});
            }
            std::sort(items.begin(), items.end(),
                      [](const Item& a, const Item& b) { return a.n > b.n; });
            Json::Value arr(Json::arrayValue);
            for (const auto& it : items) {
                Json::Value row;
                row["label"] = it.label;
                row["pct"]   = pct(it.n);
                arr.append(row);
            }
            out["facets"] = arr;
        }

        // hours — 24-bin, todas as sessões
        {
            std::vector<int64_t> hours(24, 0);
            auto rows = db->execSqlSync(
                "SELECT hour, COUNT(*) AS n FROM sessions "
                "WHERE hour BETWEEN 0 AND 23 GROUP BY hour");
            for (const auto& r : rows) {
                int h = r["hour"].as<int>();
                if (h >= 0 && h < 24) hours[h] = r["n"].as<int64_t>();
            }
            Json::Value arr(Json::arrayValue);
            for (auto v : hours) arr.append(static_cast<Json::Int64>(v));
            out["hours"] = arr;
        }
    }
    catch (const DrogonDbException& ex) {
        LOG_ERROR << "stats failed: " << ex.base().what();
        cb(serverError());
        return;
    }

    auto resp = HttpResponse::newHttpJsonResponse(out);
    resp->addHeader("Cache-Control", "public, max-age=60");
    cb(resp);
}
