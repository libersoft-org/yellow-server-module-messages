#!/bin/sh

mkdir -p uploads/message-attachments/

~/.bun/bin/bun i --frozen-lockfile  || exit 1

echo "CI: $CI"
echo "HOLLOW: $HOLLOW"

if [ "$HOLLOW" = "true" ]; then
 echo "link yellow-server-common for development"
 rm -rf ./node_modules/yellow-server-common; ln -s ../../yellow-server-common ./node_modules/yellow-server-common
fi

if [ -n "$CI" ]; then
 echo dev_db_init...
  ./dev_db_init.py `hostname` |  mariadb --protocol=tcp --host=$MARIA_HOST --user=root --password=password --force
fi

echo migrate...
~/.bun/bin/bun run knex:migrate || exit 1

if [ -n "$CI" ]; then
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

