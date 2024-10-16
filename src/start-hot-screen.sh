#!/bin/sh

[ ! -d "./node_modules/" ] && bun i
screen -dmS yellow-module-messages bun --watch module-messages.js
