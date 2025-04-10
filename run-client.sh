#!/bin/bash
# Script to run the client with the necessary environment variables

# Set Anchor provider URL to Solana devnet
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"

# Set the wallet to use - this will use the keypair.json in the project root
# Make sure it's funded with devnet SOL using `solana airdrop 2`
export ANCHOR_WALLET="$(pwd)/keypair.json"

# Select which client to run
if [ "$1" == "full" ]; then
  echo "Running full client with TypeScript type checking disabled"
  npx ts-node --transpile-only app/client.ts
else
  echo "Running simple client with TypeScript type checking disabled"
  npx ts-node --transpile-only app/simple-client.ts
fi 