#!/usr/bin/env bash
# Installs the Claude Bridge panel for the current user (macOS) and registers the MCP server with Claude Code.
#   --copy      copy the panel instead of symlinking it (default: symlink, so `git pull` updates the panel)
#   --skip-mcp  do not run `claude mcp add`
# Restart Premiere Pro afterwards.
set -euo pipefail

COPY=0; SKIP_MCP=0
for arg in "$@"; do
  case "$arg" in
    --copy) COPY=1 ;;
    --skip-mcp) SKIP_MCP=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
SERVER="$ROOT/mcp/server.js"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.claude.premierebridge"

command -v node >/dev/null || { echo "Node.js 18+ is required. Install it from https://nodejs.org" >&2; exit 1; }
if [ "$(node -p "process.versions.node.split('.')[0]")" -lt 18 ]; then
  echo "Node.js 18+ is required (found $(node --version))." >&2; exit 1
fi

mkdir -p "$(dirname "$DEST")"
if [ -L "$DEST" ]; then rm "$DEST"; elif [ -e "$DEST" ]; then rm -rf "$DEST"; fi

if [ "$COPY" = 1 ]; then
  cp -R "$SRC" "$DEST"; echo "Copied panel to $DEST"
else
  ln -s "$SRC" "$DEST"; echo "Linked $DEST -> $SRC"
fi

# Unsigned panels load only with PlayerDebugMode. CSXS 9-12 covers Premiere Pro 2019 and later.
for v in 9 10 11 12; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
echo "PlayerDebugMode enabled for CSXS 9-12."

if [ "$SKIP_MCP" = 0 ]; then
  if command -v claude >/dev/null; then
    claude mcp remove premiere-bridge --scope user >/dev/null 2>&1 || true
    claude mcp add premiere-bridge --scope user -- node "$SERVER"
    echo "Registered MCP server 'premiere-bridge' with Claude Code (user scope)."
  else
    echo "Claude Code CLI not found. Register the server manually:"
    echo "  claude mcp add premiere-bridge --scope user -- node \"$SERVER\""
  fi
fi

echo
echo "Done. Restart Premiere Pro, then open Window > Extensions (Legacy) > Claude Bridge."
echo "Check the setup any time with: npm run doctor"
