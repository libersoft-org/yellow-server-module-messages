#!/bin/sh

[ ! -d "./node_modules/" ] && bun i --frozen-lockfile
rm -rf ./node_modules/yellow-server-common; ln -s ../../../yellow-server-common ./node_modules/yellow-server-common
bun module-messages.js --create-database
mkdir -p uploads/message-attachments/
bun --watch module-messages.js
