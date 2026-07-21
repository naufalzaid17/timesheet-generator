#!/usr/bin/env bash
#
# deploy_and_commit.sh
#
# Atomically commits the working tree using Conventional Commits, then deploys
# the stack to the remote host over SSH. The remote host publishes the app on
# the first free port found by scanning upward from a base port (default 2000),
# so multiple instances can coexist without collisions.
#
# Usage:
#   ./deploy_and_commit.sh "feat(portal): add passkey login"
#   ./deploy_and_commit.sh                # prompts for a message
#
# Environment overrides:
#   REMOTE_HOST   (default 192.168.0.2)
#   REMOTE_PORT   (default 222)          # SSH port of the deploy host
#   REMOTE_USER   (default deploy)
#   REMOTE_DIR    (default ~/timesheet-portal)
#   BASE_PORT     (default 2000)         # port scan starts here
#   PORT_SCAN_MAX (default 2100)         # inclusive upper bound of the scan
#   BRANCH        (default current branch)

set -euo pipefail

# ---- Configuration -----------------------------------------------------------
REMOTE_HOST="${REMOTE_HOST:-192.168.0.2}"
REMOTE_PORT="${REMOTE_PORT:-222}"
REMOTE_USER="${REMOTE_USER:-deploy}"
REMOTE_DIR="${REMOTE_DIR:-~/timesheet-portal}"
BASE_PORT="${BASE_PORT:-2000}"
PORT_SCAN_MAX="${PORT_SCAN_MAX:-2100}"
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"

SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS="-p ${REMOTE_PORT} -o StrictHostKeyChecking=accept-new"

green() { printf "\033[0;32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$1"; }
red() { printf "\033[0;31m%s\033[0m\n" "$1"; }

# ---- 1. Commit (Conventional Commits) ---------------------------------------
COMMIT_MSG="${1:-}"

if git diff --quiet && git diff --cached --quiet; then
  yellow "No changes to commit; proceeding straight to deploy."
else
  if [[ -z "${COMMIT_MSG}" ]]; then
    read -rp "Conventional commit message (e.g. feat(scope): summary): " COMMIT_MSG
  fi

  # Validate the Conventional Commits prefix.
  if ! [[ "${COMMIT_MSG}" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\ .+ ]]; then
    red "Commit message is not a valid Conventional Commit."
    red "Expected: <type>(optional-scope): <description>"
    exit 1
  fi

  green "Committing: ${COMMIT_MSG}"
  git add -A
  git commit -m "${COMMIT_MSG}"
fi

green "Pushing ${BRANCH} to origin…"
git push -u origin "${BRANCH}"

# ---- 2. Discover a free port on the remote host -----------------------------
green "Scanning ${REMOTE_HOST} for a free port starting at ${BASE_PORT}…"

# Ask the remote host which port in [BASE_PORT, PORT_SCAN_MAX] is free.
CHOSEN_PORT="$(ssh ${SSH_OPTS} "${SSH_TARGET}" bash -s -- "${BASE_PORT}" "${PORT_SCAN_MAX}" <<'REMOTE_SCAN'
set -euo pipefail
base="$1"; max="$2"
for port in $(seq "$base" "$max"); do
  # A port is free if nothing is listening on it.
  if ! (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -qE "[:.]$port\$"; then
    echo "$port"
    exit 0
  fi
done
echo "NONE"
REMOTE_SCAN
)"

if [[ "${CHOSEN_PORT}" == "NONE" || -z "${CHOSEN_PORT}" ]]; then
  red "No free port found in range ${BASE_PORT}-${PORT_SCAN_MAX} on ${REMOTE_HOST}."
  exit 1
fi

green "Selected remote port: ${CHOSEN_PORT}"

# ---- 3. Deploy on the remote host -------------------------------------------
green "Deploying to ${SSH_TARGET}:${REMOTE_DIR} …"

ssh ${SSH_OPTS} "${SSH_TARGET}" \
  APP_PORT="${CHOSEN_PORT}" REMOTE_DIR="${REMOTE_DIR}" BRANCH="${BRANCH}" \
  REPO_URL="$(git config --get remote.origin.url)" bash -s <<'REMOTE_DEPLOY'
set -euo pipefail

: "${APP_PORT:?}"; : "${REMOTE_DIR:?}"; : "${BRANCH:?}"; : "${REPO_URL:?}"

# Expand ~ in REMOTE_DIR.
REMOTE_DIR="${REMOTE_DIR/#\~/$HOME}"

if [[ ! -d "${REMOTE_DIR}/.git" ]]; then
  echo "Cloning ${REPO_URL} into ${REMOTE_DIR}"
  git clone "${REPO_URL}" "${REMOTE_DIR}"
fi

cd "${REMOTE_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

# Publish the app on the discovered host port; the container still listens on
# 8080 internally.
export APP_PORT
echo "Bringing up the stack on host port ${APP_PORT} (container :8080)…"

# Prefer 'docker compose' (v2), fall back to docker-compose (v1).
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

APP_HOST_PORT="${APP_PORT}" ${DC} -f docker-compose.yml up -d --build

echo "Deployment complete. App published on port ${APP_PORT}."
REMOTE_DEPLOY

green "Done. The portal is deployed on ${REMOTE_HOST}:${CHOSEN_PORT}."
