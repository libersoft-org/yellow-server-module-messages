#!/bin/sh

[ ! -d "./node_modules/" ] && bun i
bun module-messages.js $1
