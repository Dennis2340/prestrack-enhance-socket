import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const connections = new Map();
import {
  createGuestUser,
  createRoomForGuest,
  addMessage,
  overrideRoom,
  releaseOverride,
  getRoomMessages,
  agentJoinRoom,
  getOrCreateGlobalAgentRoom,
  updateAgentOnlineStatus,
} from "./services/chatService.js";
import { db } from "./db/index.js";
import { handleWhatsAppMessage, createAppointmentFromWhatsApp } from "./services/whatsappService.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhook

// WhatsApp endpoints
app.post('/whatsapp/incoming', handleWhatsAppMessage);
app.post('/whatsapp/appointment', createAppointmentFromWhatsApp);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("guestJoin", async ({ name, email, businessId }, callback) => {
    try {
      const guest = await createGuestUser(name, email, businessId);
      const room = await createRoomForGuest(guest.id, businessId);
      socket.join(room.id.toString());
      console.log(
        `Guest ${guest.id} joined room ${room.id} for business ${businessId}`
      );
      io.emit("roomCreated", { ...room, businessId }); // Notify all clients
      callback(null, { roomId: room.id, guestId: guest.id });
    } catch (error) {
      console.error("guestJoin error:", error.message);
      callback(error.message);
    }
  });

  socket.on("agentLogin", async ({ name, agentId, businessId }, callback) => {
    try {
      socket.join(`agents-${businessId}`);
      console.log(
        `Agent ${agentId} (${name}) logged in with socket ${socket.id} for business ${businessId}`
      );
      const globalRoom = await getOrCreateGlobalAgentRoom(businessId);
      io.to(`agents-${businessId}`).emit("agentJoined", { agentId, name });
      callback(null, { agentId, name, globalRoomId: globalRoom.id });
    } catch (error) {
      console.error("agentLogin error:", error.message);
      callback(error.message);
    }
  });

  socket.on(
    "joinRoom",
    async ({ roomId, agentId, guestId, businessId }, callback) => {
      try {
        if (!roomId || !businessId)
          throw new Error("roomId and businessId are required.");
        if (!agentId && !guestId)
          throw new Error("Either agentId or guestId is required.");

        const room = await db.room.findUnique({ where: { id: roomId } });
        if (!room || room.businessId !== businessId) {
          throw new Error(
            `Room with ID ${roomId} not found for business ${businessId}`
          );
        }

        let updatedRoom;
        if (agentId) {
          const agent = await db.user.findUnique({ where: { agentId } });
          if (!agent || agent.businessId !== businessId) {
            throw new Error(
              `Agent with ID ${agentId} not found for business ${businessId}`
            );
          }
          updatedRoom = await agentJoinRoom(roomId, agentId);
          io.to(roomId).emit("notification", {
            message: `Agent ${agentId} has joined room ${roomId}`,
            activeAgents: updatedRoom.activeAgents,
            businessId,
          });
        } else if (guestId) {
          const guest = await db.user.findUnique({ where: { id: guestId } });
          if (!guest || guest.businessId !== businessId) {
            throw new Error(
              `Guest with ID ${guestId} not found for business ${businessId}`
            );
          }
          io.to(roomId).emit("notification", {
            message: `Guest ${guestId} has joined room ${roomId}`,
            businessId,
          });
        }

        socket.join(roomId.toString());
        callback(null, {
          success: true,
          activeAgents: updatedRoom?.activeAgents ?? [],
        });
      } catch (error) {
        console.error("Join Room Error:", error.message);
        callback(error.message);
      }
    }
  );

  socket.on(
    "sendMessage",
    async (
      { roomId, senderType, senderId, content, taggedAgents = [], businessId },
      callback
    ) => {
      try {
        const room = await db.room.findUnique({ where: { id: roomId } });
        if (!room || room.businessId !== businessId) {
          throw new Error(`Room not found for business ${businessId}`);
        }
        const message = {
          roomId,
          senderType,
          senderId,
          content,
          timestamp: new Date().toISOString(),
          businessId,
        };
        io.to(roomId).emit("message", message);
        await addMessage({
          roomId,
          senderType,
          senderId,
          content,
          taggedAgents,
          businessId,
        });
        callback(null, message);
      } catch (error) {
        console.error("Error while sending message:", error);
        callback(error.message);
      }
    }
  );

  socket.on("authMessage", async (data) => {
    try {
      const { type, agentId } = data;

      if (!type || !agentId) {
        console.log("Invalid auth message:", data);
        return;
      }

      if (type === "auth") {
        socket.agentId = agentId;
        connections.set(agentId, socket);

        await updateAgentOnlineStatus(agentId, true);
        console.log(`Agent ${agentId} is now ONLINE`);
      }
    } catch (err) {
      console.error("Failed to handle auth message:", err);
    }
  });

  setInterval(async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const clean = await db.agentPresence.updateMany({
      where: {
        isOnline: true,
        lastSeen: { lt: twoMinutesAgo },
      },
      data: { isOnline: false },
    });
    console.log("Stale agent sessions cleaned up", clean);
  }, 120_000);

  socket.on("heartbeat", async () => {
    await db.agentPresence.updateMany({
      where: { agentId: socket.agentId },
      data: { lastSeen: new Date() },
    });
    const agentId = socket.agentId;
    io.emit("agentStatus", {
      agentId,
      isOnline: true,
      lastSeen: new Date().toISOString(),
    });
  });

  socket.on("typing", async (data) => {
    if (
      !data ||
      !data.roomId ||
      !data.senderType ||
      !data.name ||
      !data.businessId
    ) {
      console.error("Invalid typing data:", data);
      return;
    }
    const room = await db.room.findUnique({ where: { id: data.roomId } });
    if (!room || room.businessId !== data.businessId) {
      console.error(
        `Room ${data.roomId} not found or business mismatch for ${data.businessId}`
      );
      return;
    }
    socket.to(data.roomId).emit("typing", data);
  });

  socket.on("toggleAI", async (data) => {
    const { roomId, isAIEnabled, businessId } = data;
    if (!roomId || typeof isAIEnabled !== "boolean" || !businessId) {
      console.error("Invalid toggleAI data:", data);
      return;
    }
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room || room.businessId !== businessId) {
      console.error(
        `Room ${data.roomId} not found or business mismatch for ${businessId}`
      );
      return;
    }
    console.log(
      `AI toggle for room ${roomId}: ${isAIEnabled ? "Enabled" : "Disabled"}`
    );
    io.to(roomId).emit("toggleAI", { roomId, isAIEnabled, businessId });
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const agentId = socket.agentId;

    if (agentId) {
      connections.delete(agentId);
      await updateAgentOnlineStatus(agentId, false);
      console.log(`Agent ${agentId} is now OFFLINE`);
    }
  });
});

app.get("/", (req, res) => {
  res.send("Server is up and running.");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await db.$connect();
    console.log("Database connected successfully.");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
});
