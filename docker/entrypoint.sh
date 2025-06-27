#!/bin/sh
set -e

echo "🚀 Starting Google Calendar Stateless MCP Server initialization..."

# OAuth Token Injection Architecture - no OAuth credentials required during startup
echo "✅ OAuth Token Injection Architecture - credentials passed per request"

# Stateless architecture - no database or Redis dependencies

# Start the application
echo "🎯 Starting Google Calendar Stateless MCP Server..."
exec "$@"