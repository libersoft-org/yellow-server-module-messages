#!/bin/sh

mkdir -p uploads/message-attachments/



#[ ! -d "./node_modules/" ] &&
~/.bun/bin/bun i --frozen-lockfile
rm -rf ./node_modules/yellow-server-common; ln -s ../../../yellow-server-common ./node_modules/yellow-server-common
~/.bun/bin/bun module-messages.js --create-database
while true; do
  ~/.bun/bin/bun module-messages.js
done

