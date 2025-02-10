#!/bin/sh

echo "Starting Nginx server..."
echo "Configuration file loaded from: /etc/nginx/conf.d/default.conf"

# Start Nginx in the foreground
nginx -g 'daemon off;'
