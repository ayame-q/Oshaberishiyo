#!/bin/sh

yarn install --frozen-lockfile;

exec "$@"
