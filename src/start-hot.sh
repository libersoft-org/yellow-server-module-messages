#!/bin/sh

bun i
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
bun --watch module-messages.js
