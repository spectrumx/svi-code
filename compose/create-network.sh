#!/usr/bin/env bash
# Defines a standalone docker network for jupyter containers to attach to.
# Run this before running `docker compose up` or similar.
# You may run this script multiple times.

set -euo pipefail

NETWORK_NAME="${1:-spectrumx_network}"
QUIET="false"

function _log() {
    ts=$(date +"%Y-%m-%d %H:%M:%S")
    if [ "${QUIET}" = "false" ]; then
        echo -e "${ts} | ${1}"
    fi
}

function log_info() {
    _log "\033[0;34m${1}\033[0m"
}

function main() {

    if ! docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
        docker network create \
            --driver bridge \
            --attachable \
            --internal=false \
            "${NETWORK_NAME}"
        log_info "Created docker network '${NETWORK_NAME}':"
    else
        log_info "Network '${NETWORK_NAME}' already exists, skipping creation:"
    fi

    inspect_cmd="docker network inspect ${NETWORK_NAME}"
    if [ "${QUIET}" = "false" ]; then
        # run inspect to show the network details
        if command -v jq >/dev/null 2>&1; then
            ${inspect_cmd} | jq .
        else
            ${inspect_cmd}
        fi
    else
        # run inspect just to get the return code
        ${inspect_cmd} >/dev/null 2>&1
    fi

}

main "$@"
