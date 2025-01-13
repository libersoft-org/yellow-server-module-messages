#!/bin/sh

bun i --frozen-lockfile
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
bun --watch module-messages.js
