#!/usr/bin/env bash
# Generate self-signed certificates for local HTTPS development.
# Certs are valid for localhost, 127.0.0.1, 192.168.0.30, and 192.168.0.* range.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/certs"

mkdir -p "$CERTS_DIR"

CERT_FILE="$CERTS_DIR/localhost-cert.pem"
KEY_FILE="$CERTS_DIR/localhost-key.pem"

if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
  echo "Certificates already exist at $CERTS_DIR"
  echo "  $CERT_FILE"
  echo "  $KEY_FILE"
  echo "Delete them and re-run this script to regenerate."
  exit 0
fi

echo "Generating self-signed certificate..."

openssl req -x509 \
  -newkey rsa:2048 \
  -nodes \
  -sha256 \
  -days 365 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.0.30,IP:192.168.0.1,IP:192.168.0.2,IP:192.168.0.3,IP:192.168.0.4,IP:192.168.0.5,IP:192.168.0.6,IP:192.168.0.7,IP:192.168.0.8,IP:192.168.0.9,IP:192.168.0.10,IP:192.168.0.11,IP:192.168.0.12,IP:192.168.0.13,IP:192.168.0.14,IP:192.168.0.15,IP:192.168.0.16,IP:192.168.0.17,IP:192.168.0.18,IP:192.168.0.19,IP:192.168.0.20,IP:192.168.0.21,IP:192.168.0.22,IP:192.168.0.23,IP:192.168.0.24,IP:192.168.0.25,IP:192.168.0.26,IP:192.168.0.27,IP:192.168.0.28,IP:192.168.0.29,IP:192.168.0.31,IP:192.168.0.32,IP:192.168.0.33,IP:192.168.0.34,IP:192.168.0.35,IP:192.168.0.36,IP:192.168.0.37,IP:192.168.0.38,IP:192.168.0.39,IP:192.168.0.40,IP:192.168.0.41,IP:192.168.0.42,IP:192.168.0.43,IP:192.168.0.44,IP:192.168.0.45,IP:192.168.0.46,IP:192.168.0.47,IP:192.168.0.48,IP:192.168.0.49,IP:192.168.0.50"

echo ""
echo "Certificates generated successfully:"
echo "  Certificate: $CERT_FILE"
echo "  Private key: $KEY_FILE"
echo ""
echo "NOTE: Since this is a self-signed certificate, you will need to"
echo "accept the browser security warning when first accessing the site,"
echo "or install the certificate as a trusted root CA on your client machine."
