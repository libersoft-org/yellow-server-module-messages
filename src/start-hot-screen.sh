#!/bin/sh

screen -dmS yellow-module-messages bash -c "trap bash SIGINT; (./start-hot.sh ; bash);"
