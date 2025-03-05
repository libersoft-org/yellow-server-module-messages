# Yellow Server Module Messages API Documentation

This document describes the API endpoints available in the Yellow Server Module Messages.

## WebSocket API

All API calls are made through WebSocket connections. The general format for requests is:

```json
{
  "type": "request",
  "requestID": "unique-request-id",
  "data": {
    "command": "command_name",
    "params": {
      // command-specific parameters
    }
  }
}
```

Responses follow this format:

```json
{
  "type": "response",
  "requestID": "unique-request-id",
  "error": false, // or error code number
  "message": "Success message or error description",
  // Additional data specific to the command
}
```

## Available Commands

### Message Operations

#### `message_send`
Send a message to another user.

**Parameters:**
- `address` (string): Recipient address in format "username@domain"
- `message` (string): Message content
- `format` (string, optional): Message format, defaults to "plaintext". Can be "plaintext" or "html"
- `uid` (string): Unique identifier for the message

**Response:**
- Success: `{ "error": false, "message": "Message sent", "uid": "message-uid" }`
- Error: Error object with code and message

#### `message_seen`
Mark a message as seen.

**Parameters:**
- `uid` (string): Unique identifier of the message to mark as seen

**Response:**
- Success: `{ "error": false, "message": "Seen flag set successfully" }`
- Error: Error object with code and message

#### `messages_list`
Get a list of messages in a conversation.

**Parameters:**
- `address` (string): Address of the conversation partner
- `base` (number|string, optional): Base message ID or "unseen" to start from first unseen message
- `prev` (number, optional): Number of messages to fetch before the base message
- `next` (number, optional): Number of messages to fetch after the base message

**Response:**
- Success: `{ "error": false, "data": { "messages": [...] } }`
- Error: Error object with code and message

#### `conversations_list`
Get a list of all conversations.

**Parameters:** None

**Response:**
- Success: `{ "error": false, "data": { "conversations": [...] } }`
- Error: Error object with code and message

### File Transfer Operations

#### `upload_begin`
Initialize a file upload.

**Parameters:**
- `records` (array): Array of file records with metadata
  - `id` (string): Unique identifier for the upload
  - `fileOriginalName` (string): Original file name
  - `fileMimeType` (string): MIME type of the file
  - `fileSize` (number): Size of the file in bytes
  - `type` (string): Type of upload ("P2P" or "SERVER")
  - `chunkSize` (number): Size of each chunk in bytes
  - `fromUserUid` (string): UID of the sender
- `recipients` (array): Array of recipient addresses

**Response:**
- Success: `{ "error": false, "message": "Upload started", "allowedRecords": [...], "disallowedRecords": [...] }`
- Error: Error object with code and message

#### `upload_chunk`
Upload a chunk of a file.

**Parameters:**
- `chunk` (object): Chunk data
  - `chunkId` (number): ID of the chunk
  - `uploadId` (string): ID of the upload
  - `checksum` (string): Checksum of the chunk
  - `data` (string): Base64-encoded chunk data

**Response:**
- Success: `{ "error": false, "message": "Chunk accepted" }`
- Error: Error object with code and message

#### `upload_get`
Get information about an upload.

**Parameters:**
- `id` (string): ID of the upload

**Response:**
- Success: `{ "error": false, "data": { "record": {...}, "uploadData": {...} } }`
- Error: Error object with code and message

#### `upload_cancel`
Cancel an upload.

**Parameters:**
- `uploadId` (string): ID of the upload to cancel

**Response:**
- Success: `{ "error": false, "message": "Upload canceled" }`
- Error: Error object with code and message

#### `upload_update_status`
Update the status of an upload.

**Parameters:**
- `uploadId` (string): ID of the upload
- `status` (string): New status ("CANCELED", "PAUSED", "UPLOADING", "ERROR")

**Response:**
- Success: `{ "error": false, "message": "Upload updated" }`
- Error: Error object with code and message

#### `download_chunk`
Download a chunk of a file.

**Parameters:**
- `uploadId` (string): ID of the upload
- `offsetBytes` (number): Offset in bytes
- `chunkSize` (number): Size of the chunk to download

**Response:**
- Success: `{ "error": false, "chunk": {...} }`
- Error: Error object with code and message

## Events

The following events can be subscribed to using the `subscribe` command:

- `new_message`: Triggered when a new message is received
- `seen_message`: Triggered when a message is marked as seen by the recipient
- `seen_inbox_message`: Triggered when a message in the inbox is marked as seen
- `upload_update`: Triggered when an upload status is updated
- `download_chunk`: Triggered when a chunk is downloaded
- `ask_for_chunk`: Triggered when a chunk is requested

### Subscribing to Events

**Request:**
```json
{
  "type": "request",
  "requestID": "unique-request-id",
  "data": {
    "command": "subscribe",
    "params": {
      "event": "event_name"
    }
  }
}
```

**Response:**
```json
{
  "type": "response",
  "requestID": "unique-request-id",
  "error": false,
  "message": "Event subscribed"
}
```

### Unsubscribing from Events

**Request:**
```json
{
  "type": "request",
  "requestID": "unique-request-id",
  "data": {
    "command": "unsubscribe",
    "params": {
      "event": "event_name"
    }
  }
}
```

**Response:**
```json
{
  "type": "response",
  "requestID": "unique-request-id",
  "error": false,
  "message": "Event unsubscribed"
}
```
