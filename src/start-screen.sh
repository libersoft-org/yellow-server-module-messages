#!/bin/sh

[ ! -d "./node_modules/" ] && bun i
screen -dmS yellow-module-messages bash -c '
while true; do
 bun module-messages.js || exit 1
done
'
