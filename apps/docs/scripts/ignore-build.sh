#!/usr/bin/env bash
# Vercel "Ignored Build Step": skip only if a real previous deployment exists
# AND nothing under the watched paths changed since it. VERCEL_GIT_PREVIOUS_SHA
# is unset on a project's first-ever build, so this always builds then.
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  exit 1
fi
# Vercel only understands 0 (skip) and 1 (build); any other exit code fails the
# deployment. git diff exits 128 when it can't compare — Vercel's clone is
# shallow, so after enough commits the previous deployment's SHA isn't in it
# ("fatal: bad object"). Not being able to tell means build.
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../packages ../playground ../../package.json ../../package-lock.json; then
  exit 0
fi
exit 1
