#!/bin/sh

mkdir -p uploads/message-attachments/

~/.bun/bin/bun i --frozen-lockfile  || exit 1

echo "CI: $CI"
echo "HOLLOW: $HOLLOW"

if [ "$HOLLOW" = "true" ]; then
 echo "link yellow-server-common for development"
 rm -rf ./node_modules/yellow-server-common; ln -s ../../yellow-server-common ./node_modules/yellow-server-common
fi

echo dev_db_init...

# Wait for database to be created and accessible
echo "Waiting for database 'yellow_module_org_libersoft_messages' to be ready..."
for i in $(seq 1 30); do
  if mariadb --protocol=tcp --host=$MARIA_HOST --user=yellow_module_org_libersoft_messages --password=password --database=yellow_module_org_libersoft_messages -e "SELECT 1" >/dev/null 2>&1; then
    echo "Database is ready!"
    break
  fi
  ./dev_db_init.py `hostname` |  mariadb --protocol=tcp --host=$MARIA_HOST --user=root --password=password --force
  echo "Attempt $i/30: Database not ready yet, waiting..."
  sleep 1
done

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

