#!/usr/bin/env python3

import sys

host = sys.argv[1]

def messages(host):
    print(f"""
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (2, '0.b09dmbtebth0.utiw7sn3k9f0.0o0g0hg9eed0.7rgwhndqm9q{host}', 'user2@{host}', 'user1@{host}', 'ABC', '2024-10-26 23:29:33', '2024-10-26 23:21:15');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (1, '0.b09dmbtebth0.utiw7sn3k9f0.0o0g0hg9eed0.7rgwhndqm9q{host}', 'user2@{host}', 'user1@{host}', 'ABC', '2024-10-26 23:29:33', '2024-10-26 23:21:16');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (3, '0.b4j19b5zex70.a72knqivskn0.kr3vzg48xfn0.m08j39zy1or{host}', 'user3@{host}', 'user1@{host}', 'hello fron user3', '2024-10-26 23:29:08', '2024-10-26 23:28:29');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (1, '0.b4j19b5zex70.a72knqivskn0.kr3vzg48xfn0.m08j39zy1or{host}', 'user3@{host}', 'user1@{host}', 'hello fron user3', '2024-10-26 23:29:08', '2024-10-26 23:28:29');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (1, '0.nm8szdn6l3l0.23osj3k5imw0.7htrja5b4380.jc7x8267fo{host}', 'user1@{host}', 'user3@{host}', 'good to see you user3', null, '2024-10-26 23:29:20');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (3, '0.nm8szdn6l3l0.23osj3k5imw0.7htrja5b4380.jc7x8267fo{host}', 'user1@{host}', 'user3@{host}', 'good to see you user3', null, '2024-10-26 23:29:20');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (1, '0.4pvy92zmo2a0.907pal1cgf50.4zionrttiri0.p3uny72ata{host}', 'user1@{host}', 'user2@{host}', 'RARARARARERERERERRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRH!', null, '2024-10-26 23:30:03');
    # INSERT INTO yellow_module_org_libersoft_messages.messages (id_users, uid, address_from, address_to, message, seen, created) VALUES (2, '0.4pvy92zmo2a0.907pal1cgf50.4zionrttiri0.p3uny72ata{host}', 'user1@{host}', 'user2@{host}', 'RARARARARERERERERRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRH!', null, '2024-10-26 23:30:03');

    """)

messages('example.com')
messages(host)
