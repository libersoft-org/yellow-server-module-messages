#!/usr/bin/env python3

import sys

host = sys.argv[1]

print(f"""
CREATE USER IF NOT EXISTS username IDENTIFIED BY 'password';
CREATE DATABASE IF NOT EXISTS yellow;
GRANT ALL ON yellow.* TO username;

CREATE USER IF NOT EXISTS 'yellow_module_org_libersoft_messages' IDENTIFIED BY 'password';
CREATE DATABASE IF NOT EXISTS yellow_module_org_libersoft_messages;
GRANT ALL ON yellow_module_org_libersoft_messages.* TO 'yellow_module_org_libersoft_messages';

# CREATE USER  IF NOT EXISTS 'messages2' IDENTIFIED BY 'password';
# CREATE DATABASE IF NOT EXISTS messages2;
# GRANT ALL ON messages2.* TO 'messages2';
# 
# CREATE USER  IF NOT EXISTS 'dating2' IDENTIFIED BY 'password';                                                                                                                                                                 
# CREATE DATABASE IF NOT EXISTS dating2;                                                                                                                                                                                         
# GRANT ALL ON dating2.* TO 'dating2';        


""")


