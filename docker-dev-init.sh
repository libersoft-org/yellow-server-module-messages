#!/bin/sh
bun i

rm -rf ./node_modules/yellow-server-common
ln -s /app/lib/yellow-server-common ./node_modules/

