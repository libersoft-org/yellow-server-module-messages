#!/bin/sh

mkdir -p uploads/message-attachments/

~/.bun/bin/bun i --frozen-lockfile  || exit 1
rm -rf ./node_modules/yellow-server-common; ln -s ../../yellow-server-common ./node_modules/yellow-server-common

if [ "$CI" = "true" ]; then
  ./dev_db_init.py `hostname` |  mariadb --protocol=tcp --host=localhost --user=root --password=password --force
fi

~/.bun/bin/bun run knex:migrate || exit 1

if [ "$CI" = "true" ]; then
  ./dev_db_populate.py `hostname` |  mariadb --protocol=tcp --host=localhost --user=root --password=password --force
fi

if [ "$CI" = "true" ]; then
  WATCH=""
else
  WATCH="--watch"
fi

while true; do
  ~/.bun/bin/bun --watch src/module-messages.js
  echo "exit code: $?"
  sleep 1
  echo "restarting..."
done

