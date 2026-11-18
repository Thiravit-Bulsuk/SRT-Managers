FROM nginx:alpine

COPY . /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY cloudrun-entrypoint.sh /docker-entrypoint.d/40-config.sh

RUN chmod +x /docker-entrypoint.d/40-config.sh \
    && rm -f /usr/share/nginx/html/config.js \
        /usr/share/nginx/html/Dockerfile \
        /usr/share/nginx/html/nginx.conf \
        /usr/share/nginx/html/cloudrun-entrypoint.sh