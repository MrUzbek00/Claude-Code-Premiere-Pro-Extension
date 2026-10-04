#!/usr/bin/env bash
# Removes the Claude Bridge panel and the Claude Code MCP registration (macOS).
# PlayerDebugMode and ~/.premiere-bridge/token are left in place; delete them manually if you no longer need them.
set -euo pipefail
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.claude.premierebridge"

if [ -L "$DEST" ]; then rm "$DEST"; echo "Removed $DEST"
elif [ -e "$DEST" ]; then rm -rf "$DEST"; echo "Removed $DEST"; fi

if command -v claude >/dev/null; then
  claude mcp remove premiere-bridge --scope user >/dev/null 2>&1 || true
  echo "Removed MCP server 'premiere-bridge' from Claude Code."
fi
