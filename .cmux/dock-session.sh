#!/usr/bin/env bash
# Dock control helper: run a long-lived command in a persistent tmux session
# so it survives cmux workspace switches (Dock kills the terminal, not tmux).
#
# Usage: dock-session.sh <window> <command...>
#   <window>  tmux window name (one per process, e.g. dev / typecheck)
#   <command> the command to run in that window
#
# Behavior:
#   - One tmux session per project (named after the git root).
#   - One window per process inside that session.
#   - Each Dock panel attaches via its own grouped session so two panels can
#     show two different windows at once instead of mirroring each other.
#   - If the session/window already exists, we just re-attach — no restart.
set -euo pipefail

WINDOW="${1:?window name required}"
shift
CMD="$*"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SESSION="$(basename "$ROOT")"   # base session, e.g. better-form
VIEW="${SESSION}-${WINDOW}"     # per-panel grouped view, e.g. better-form-dev

cd "$ROOT"

# 1. Base session: create it (detached) with the window if missing.
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -n "$WINDOW"
  tmux send-keys -t "$SESSION:$WINDOW" "$CMD" Enter
# 2. Session exists but this window doesn't: add it.
elif ! tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qx "$WINDOW"; then
  tmux new-window -t "$SESSION" -n "$WINDOW"
  tmux send-keys -t "$SESSION:$WINDOW" "$CMD" Enter
fi
# (else: window already running — leave it untouched, just attach below.)

# 3. Per-panel grouped session shares the window set but tracks its own active
#    window, so the dev panel and typecheck panel don't fight over the view.
if ! tmux has-session -t "$VIEW" 2>/dev/null; then
  tmux new-session -d -t "$SESSION" -s "$VIEW"
fi
tmux select-window -t "$VIEW:$WINDOW"

# 4. Attach. Closing the Dock panel only detaches this client; the window keeps
#    running in the base session, ready to re-attach when you return.
exec tmux attach-session -t "$VIEW"
