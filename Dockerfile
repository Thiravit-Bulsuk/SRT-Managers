FROM asia-southeast1-docker.pkg.dev/dji-flight-parser/dji-parser/dji-parser:amd64 AS dji-parser

FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4 libssl3 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=dji-parser /parse_flyrecord/dji-flightrecord-kit/build/Ubuntu/FRSample/FRSample /opt/dji/FRSample
RUN chmod +x /opt/dji/FRSample

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY public ./public

ENV PORT=8080
ENV TEMP_DIR=/tmp
ENV DJI_PARSER_COMMAND=/opt/dji/FRSample
ENV DJI_PARSER_ARGS={input}

EXPOSE 8080
WORKDIR /app/server
CMD ["node", "server.js"]
