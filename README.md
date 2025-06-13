# Saful-Pay-Socket

A real-time chat application backend built with Socket.IO, Express, and Prisma for handling multi-agent chat rooms with business support.

## Overview

Saful-Pay-Socket provides a robust backend for real-time chat applications with support for:

- Guest and agent user types
- Business-specific chat rooms
- Real-time messaging with Socket.IO
- Agent presence tracking
- Room management and overrides
- AI integration capabilities

## Features

- **Real-time Communication**: Powered by Socket.IO for instant messaging
- **Multi-User Support**: Handles guests, agents, and admins
- **Business Segregation**: Isolates chats by business ID
- **Agent Presence**: Tracks online status and last seen timestamps
- **Room Management**: Create and manage chat rooms for guests and agents
- **Message Tagging**: Support for tagging agents in messages
- **Typing Indicators**: Real-time typing status updates
- **AI Toggle**: Option to enable/disable AI assistance in chat rooms

## Tech Stack

- **Node.js**: JavaScript runtime
- **Express**: Web server framework
- **Socket.IO**: Real-time bidirectional event-based communication
- **Prisma**: Database ORM
- **PostgreSQL**: Database

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd saful-pay-socket
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
   PORT=5000
   ```

4. Generate Prisma client:
   ```
   npx prisma generate
   ```

5. Run database migrations:
   ```
   npx prisma migrate dev
   ```

## Usage

### Development

```
npm run dev
```

### Production

```
npm start
```

## Socket Events

### Guest Events
- `guestJoin`: Register a new guest user and create a chat room
- `joinRoom`: Join an existing chat room as a guest

### Agent Events
- `agentLogin`: Register an agent and join the global agent room
- `joinRoom`: Join a guest's chat room as an agent
- `authMessage`: Authenticate an agent and track presence
- `heartbeat`: Update agent's last seen timestamp
- `disconnect`: Handle agent disconnection and update status

### Messaging Events
- `sendMessage`: Send a message to a room
- `typing`: Broadcast typing indicators
- `toggleAI`: Enable or disable AI assistance in a room

## Database Schema

The application uses a PostgreSQL database with the following main models:

- **Business**: Represents a business entity
- **User**: Represents users (guests, agents, admins)
- **Room**: Chat rooms for conversations
- **Message**: Individual chat messages
- **AgentPresence**: Tracks agent online status

## API Endpoints

- `GET /`: Health check endpoint

## License

ISC
