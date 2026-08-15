FROM rust:latest AS build
WORKDIR /src
COPY Cargo.toml .
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/dji-worker /usr/local/bin/dji-worker
ENTRYPOINT ["dji-worker"]
