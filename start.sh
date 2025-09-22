#!/bin/sh

export PORT=${PORT:-8080}

# Substitute environment variables in the nginx config template
envsubst '${PORT}' < /etc/nginx/conf.d/default.template.conf > /etc/nginx/conf.d/default.conf

# Start nginx
nginx -g 'daemon off;'
