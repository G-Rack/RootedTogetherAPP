#!/bin/bash
# Publishes a small change to the TestFlight / Play testers in about two minutes.
# Usage:  ./shipapp.sh "what changed"
# Only works for JavaScript changes (screens, text, colours). If a change adds a
# new native library or edits app.json, make a fresh build instead.
set -e
cd "$(dirname "$0")"
MSG="${1:-App update}"
git add -A -- . ':(exclude)_reels_parked'
git commit -m "$MSG" || echo "(nothing new to commit)"
git push
eas update --channel production --message "$MSG"
