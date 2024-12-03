#!/bin/sh

[ ! -d "./node_modules/" ] && bun i
echo -ne "\033]0;YELLOW MODULE MESSAGES\007"
bun module-messages.js $1
