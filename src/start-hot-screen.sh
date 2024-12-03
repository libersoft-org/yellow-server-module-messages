#!/bin/sh

[ ! -d "./node_modules/" ] && bun i
screen -dmS yellow-module-messages bash -c '
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
bun --watch module-messages.js
'
