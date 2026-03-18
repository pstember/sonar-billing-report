#!/bin/bash
# Quick start script for SonarCloud Billing Report

echo "╔════════════════════════════════════════════════════════╗"
echo "║   SonarCloud Billing Report - Standalone Server       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if dist exists
if [[ ! -d "dist" ]]; then
  echo "📦 Building application..."
  npm run build
  echo ""
fi

echo "🚀 Starting server..."
echo ""
node server.js
