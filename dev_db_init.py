#!/usr/bin/env python3

import sys

host = sys.argv[1]

print(f"""
CREATE USER IF NOT EXISTS 'yellow_module_org_libersoft_messages' IDENTIFIED BY 'password';
CREATE DATABASE IF NOT EXISTS yellow_module_org_libersoft_messages;
GRANT ALL ON yellow_module_org_libersoft_messages.* TO 'yellow_module_org_libersoft_messages';
""")


