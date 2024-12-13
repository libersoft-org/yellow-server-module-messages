#!/bin/sh

bun i
screen -dmS yellow-server-module-messages bash -c '
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
bun --watch module-messages.js
'
