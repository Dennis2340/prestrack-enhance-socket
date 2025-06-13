import { db } from "../db/index.js";

/**
 * Ensure a Business exists for the given businessId, creating it if necessary.
 */
async function ensureBusinessExists(
  businessId,
  businessName = "Default Business"
) {
  try {
    let business = await db.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      business = await db.business.create({
        data: {
          id: businessId, // Use the provided businessId
          name: businessName,
        },
      });
      console.log(`Created new business with ID: ${businessId}`);
    }
    return business;
  } catch (error) {
    console.error("Error ensuring business exists:", error);
    throw new Error(`Failed to ensure business exists: ${error.message}`);
  }
}

/**
 * Get or create the global agent room for a business.
 */
export async function getOrCreateGlobalAgentRoom(businessId) {
  try {
    await ensureBusinessExists(businessId);
    let room = await db.room.findFirst({
      where: { name: "agents", businessId },
    });
    if (!room) {
      room = await db.room.create({
        data: {
          name: "agents",
          status: "active",
          businessId,
        },
      });
    }
    return room;
  } catch (error) {
    console.error("Error in getOrCreateGlobalAgentRoom:", error);
    throw error;
  }
}

/**
 * Create a guest user.
 */
export async function createGuestUser(name, email, businessId) {
  try {
    if (!email || !businessId) {
      throw new Error(
        "Email and businessId are required to create a guest user."
      );
    }

    await ensureBusinessExists(businessId);

    let user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name,
          role: "guest",
          businessId,
        },
      });
    }

    return user;
  } catch (error) {
    console.error("Error creating guest user:", error);
    throw error;
  }
}

/**
 * Create a room for a guest user.
 */
export async function createRoomForGuest(guestId, businessId) {
  try {
    if (!guestId || !businessId) {
      throw new Error("Guest ID and businessId are required to create a room.");
    }

    await ensureBusinessExists(businessId);

    // check if user has a an active room
    const roomExistForUser = await db.room.findUnique({
      where: {
        guestId,
      },
    });

    console.log("roomExistForUser", roomExistForUser);

    if (roomExistForUser) {
      return roomExistForUser;
    }

    const room = await db.room.create({
      data: {
        guestId,
        businessId,
      },
    });

    if (room) {
      await db.notification.create({
        data: {
          title: `A guest room was created`,
          description: `A customer created a room, see if you can join the conversation.`,
          priority: "HIGH",
          time: new Date(),
          roomId: room.id,
        },
      });
    }

    return room;
  } catch (error) {
    console.error("Error creating room for guest:", error);
    throw error;
  }
}

/**
 * Agent joins a room.
 */
export async function agentJoinRoom(roomId, agentId) {
  try {
    const [room, agent] = await Promise.all([
      db.room.findUnique({ where: { id: roomId } }),
      db.user.findUnique({ where: { agentId } }),
    ]);

    if (!room) throw new Error(`Room with ID ${roomId} not found.`);
    if (!agent) throw new Error(`Agent with ID ${agentId} not found.`);

    return await db.room.update({
      where: { id: roomId },
      data: {
        activeAgents: { connect: { id: agent.id } },
      },
      include: { activeAgents: true },
    });
  } catch (error) {
    console.error("Error in agentJoinRoom:", error);
    throw new Error(`Failed to join room: ${error.message}`);
  }
}

/**
 * Override room.
 */
export async function overrideRoom(roomId, agentId) {
  try {
    const room = await db.room.update({
      where: { id: roomId },
      data: {
        currentOverride: { connect: { id: agentId } },
        activeAgents: { connect: { id: agentId } },
      },
    });
    return room;
  } catch (error) {
    console.error("Error in overrideRoom:", error);
    throw error;
  }
}

/**
 * Release override.
 */
export async function releaseOverride(roomId, agentId) {
  try {
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { currentOverrideId: true },
    });
    if (!room) throw new Error("Room not found");
    if (room.currentOverrideId !== agentId) {
      throw new Error("Agent is not overriding this room");
    }
    const updatedRoom = await db.room.update({
      where: { id: roomId },
      data: { currentOverride: { disconnect: true } },
    });
    return updatedRoom;
  } catch (error) {
    console.error("Error in releaseOverride:", error);
    throw error;
  }
}

/**
 * Add a message to a room.
 */
export async function addMessage({
  roomId,
  senderType,
  senderId,
  content,
  taggedAgents = [],
  businessId,
}) {
  try {
    const room = await db.room.findUnique({
      where: { id: roomId },
    });
    if (!room || room.businessId !== businessId) {
      throw new Error(
        `Room with ID ${roomId} not found for business ${businessId}`
      );
    }

    let senderConnect;
    if (senderId && senderType !== "ai") {
      let user;
      if (senderId.startsWith("AGT")) {
        user = await db.user.findUnique({
          where: { agentId: senderId },
        });
        if (!user || user.businessId !== businessId) {
          throw new Error(
            `Sender with agentId ${senderId} not found for business ${businessId}`
          );
        }
        senderConnect = { id: user.id };
      } else {
        user = await db.user.findUnique({
          where: { id: senderId },
        });
        if (!user || user.businessId !== businessId) {
          throw new Error(
            `Sender with ID ${senderId} not found for business ${businessId}`
          );
        }
        senderConnect = { id: senderId };
      }
    }

    const message = await db.message.create({
      data: {
        room: { connect: { id: roomId } },
        senderType,
        content,
        sender: senderConnect ? { connect: senderConnect } : undefined,
        taggedAgents:
          taggedAgents && taggedAgents.length > 0
            ? { connect: taggedAgents.map((id) => ({ id })) }
            : undefined,
      },
    });

    return message;
  } catch (error) {
    console.error("Error while adding message:", error);
    throw error;
  }
}

/**
 * Retrieve all messages for a room.
 */
export async function getRoomMessages(roomId) {
  try {
    const messages = await db.message.findMany({
      where: { roomId },
      orderBy: { timestamp: "asc" },
    });
    return messages;
  } catch (error) {
    console.error("Error in getRoomMessages:", error);
    throw error;
  }
}

/**
 * Register an agent's online or offline status.
 * @param {string} agentId - The ID of the agent
 * @param {boolean} isOnline - True if the agent is online, false if offline
 * @returns {Promise<Object>} - The updated AgentPresence object
 */
export async function updateAgentOnlineStatus(agentId, isOnline) {
  console.log(agentId);
  try {
    // First check if the agent exists
    const agent = await db.user.findUnique({
      where: { agentId },
      select: { id: true, businessId: true }
    });

    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found in system`);
    }

    // Now create/update the agent presence
    const updatedPresence = await db.agentPresence.upsert({
      where: { agentId },
      update: { isOnline },
      create: {
        agent: { connect: { agentId } },
        isOnline,
      },
      include: { agent: true },
    });

    return updatedPresence;
  } catch (error) {
    console.error("Error updating agent online status:", error);
    throw error;
  }
}
