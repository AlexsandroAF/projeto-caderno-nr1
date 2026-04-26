# syntax=docker/dockerfile:1.6

# ============================================================================
# stage 1 — builder: compile Drogon (static) + the caderno binary
# ============================================================================
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ca-certificates \
        libjsoncpp-dev libssl-dev uuid-dev zlib1g-dev libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# --- Drogon (static build, no extras) ---------------------------------------
WORKDIR /tmp
RUN git clone --depth 1 --branch master --recurse-submodules \
        https://github.com/drogonframework/drogon.git \
    && cmake -S drogon -B drogon/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_DOC=OFF \
        -DBUILD_CTL=OFF \
        -DBUILD_POSTGRESQL=OFF \
        -DBUILD_MYSQL=OFF \
        -DBUILD_REDIS=OFF \
    && cmake --build drogon/build -j"$(nproc)" \
    && cmake --install drogon/build \
    && rm -rf /tmp/drogon

# --- app build --------------------------------------------------------------
WORKDIR /src
COPY CMakeLists.txt main.cc ./
COPY controllers ./controllers

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build -j"$(nproc)"

# ============================================================================
# stage 2 — runtime: tiny Ubuntu with only the .so deps + the binary
# ============================================================================
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        libjsoncpp25 libssl3 libsqlite3-0 zlib1g uuid-runtime ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data

WORKDIR /app
COPY --from=builder /src/build/caderno /app/caderno
COPY config.json /app/config.json
COPY public      /app/public

VOLUME ["/data"]
EXPOSE 80

CMD ["/app/caderno"]
