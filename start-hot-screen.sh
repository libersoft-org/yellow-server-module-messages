#!/bin/sh

screen -dmS yellow-server-module-messages bash -c ". ./colors.sh; trap bash SIGINT; (./start-hot.sh ; bash);"
