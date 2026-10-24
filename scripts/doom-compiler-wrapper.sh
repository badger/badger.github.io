#!/bin/sh
set -eu
: "${EMSDK:?Source emsdk_env.sh before building Doom}"
compiler="$1"
shift
exec "$compiler" "-ffile-prefix-map=$EMSDK=/emsdk" "$@"
