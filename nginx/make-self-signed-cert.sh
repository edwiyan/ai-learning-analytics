#!/bin/sh
# Create a self-signed certificate for the pilot deployment (see nginx/README.md).
# Usage: sh nginx/make-self-signed-cert.sh [hostname]
set -e
HOST="${1:-localhost}"
DIR="$(dirname "$0")/certs"
mkdir -p "$DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/privkey.pem" -out "$DIR/fullchain.pem" \
  -subj "/CN=$HOST" -addext "subjectAltName=DNS:$HOST,DNS:localhost,IP:127.0.0.1"
echo "Wrote $DIR/fullchain.pem and $DIR/privkey.pem for $HOST"
