#!/bin/sh

bun i --frozen-lockfile
screen -dmS yellow-module-messages bash -c '
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
while true; do
 bun module-messages.js || exit 1
done
'
