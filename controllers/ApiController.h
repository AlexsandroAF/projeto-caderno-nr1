#pragma once

#include <drogon/HttpController.h>

class ApiController : public drogon::HttpController<ApiController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(ApiController::submit, "/api/submit", drogon::Post);
    ADD_METHOD_TO(ApiController::stats,  "/api/stats",  drogon::Get);
    METHOD_LIST_END

    void submit(const drogon::HttpRequestPtr& req,
                std::function<void(const drogon::HttpResponsePtr&)>&& cb);

    void stats(const drogon::HttpRequestPtr& req,
               std::function<void(const drogon::HttpResponsePtr&)>&& cb);
};
