#!/bin/sh
# Regenerate clients/ios/signer.js = signer.head.js + the shared crypto + signer.tail.js
set -e
cd "$(dirname "$0")"
{
  cat ios/signer.head.js
  grep -v 'module.exports' lib/hmac-sha256.js
  cat ios/signer.tail.js
} > ios/signer.js
echo "wrote ios/signer.js ($(wc -l < ios/signer.js) lines)"
