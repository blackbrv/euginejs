#!/usr/bin/env bash
# Vercel "Ignored Build Step": skip only if a real previous deployment exists
# AND nothing under the watched paths changed since it. VERCEL_GIT_PREVIOUS_SHA
# is unset on a project's first-ever build, so this always builds then.
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  exit 1
fi
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../packages ../playground
