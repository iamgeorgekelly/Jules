#!/bin/sh

export PORT=${PORT:-8080}

# Substitute PORT in the nginx config template
sed -e "s/\${PORT}/$PORT/g" /etc/nginx/conf.d/default.template.conf > /etc/nginx/conf.d/default.conf

echo "Starting nginx on port $PORT"
cat /etc/nginx/conf.d/default.conf

# Start nginx
nginx -g 'daemon off;'
