#!/bin/sh

[ ! -d "./node_modules/" ] && ../docker-dev-init.sh

bun module-messages.js --create-database
bun --watch module-messages.js
