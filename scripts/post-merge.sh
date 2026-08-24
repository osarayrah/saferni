#!/bin/bash
set -e
# Merges can legitimately add workspace package specifiers without including
# the generated lockfile. Reconcile manifests here so setup remains repeatable
# instead of failing before migrations can run.
pnpm install --no-frozen-lockfile
pnpm --filter db push
