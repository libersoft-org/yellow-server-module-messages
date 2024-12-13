#!/bin/sh

screen -dmS yellow-server-module-messages bash -c "trap bash SIGINT; (./start-hot.sh ; bash);"
