#!/bin/sh

mkdir -p uploads/message-attachments/

~/.bun/bin/bun i --frozen-lockfile  || exit 1
rm -rf ../node_modules/yellow-server-common; ln -s ../../../yellow-server-common ../node_modules/yellow-server-common
~/.bun/bin/bun run knex:migrate || exit 1
while true; do
  ~/.bun/bin/bun --watch src/module-messages.js
  echo "exit code: $?"
  sleep 1
  echo "restarting..."
done

