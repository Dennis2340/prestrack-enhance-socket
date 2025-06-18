# Prestrack-Socket

A real-time chat application backend built with Socket.IO, Express, and Prisma for handling multi-doctor chat rooms with Doctor support, so patients and doctors can have realtime communication and also AI enabled communication, so the doctor can communicate with the Doctor's data based on the medical profile and past interactions and get a wholistic view of the patient with talking the patient.

## Overview

Prestrack-Socket provides a robust backend for real-time chat applications with support for:

- Guest and agent user types
- Doctor-specific chat rooms
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
- **Whatsapp integration**: Option for users be able to interact with the AI agent via whatsapp, and schedule a visit, with the doctor and get basic guidelines
- **Patient Data Chat session**: Doctors can have realtime time analysis of patients data and past conversation which enabled fast diagnosis of certain diseases affecting the doctor, while aid by the AI

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
   cd prestrack-enhance-socket
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

- **User**: Represents users (patient, doctor, admins)
- **Room**: Chat rooms for conversations
- **Message**: Individual chat messages
- **AgentPresence**: Tracks agent online status

## API Endpoints

- `GET /`: Health check endpoint

## License

ISC
