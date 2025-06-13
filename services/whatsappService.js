import { db } from "../db/index.js";
import * as dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

// Twilio WhatsApp Sandbox configuration
const TWILIO_WHATSAPP_NUMBER = '+14155238886';
const FROM = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// WhatsApp number formatting utility
function formatWhatsAppNumber(phone) {
  // Remove any non-digit characters
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Add country code if missing (assuming Sierra Leone +232)
  if (cleaned.startsWith('232')) {
    return `whatsapp:${cleaned}`;
  } else if (cleaned.startsWith('31466865')) {
    return 'whatsapp:+23231466865';
  } else {
    return `whatsapp:+232${cleaned}`;
  }
}

export async function handleWhatsAppMessage(req, res) {
  try {
    const { From, Body, MessageSid } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');
    
    // Create email from phone number
    const email = `whatsapp_${phoneNumber}@pres-track.com`;

    // Find or create user
    let user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: "WhatsApp User",
          role: "guest",
          businessId: "PresTrack-id" // This should be configurable
        }
      });
    }

    // Create or find room for WhatsApp user
    let room = await db.room.findUnique({
      where: { guestId: user.id }
    });

    if (!room) {
      room = await db.room.create({
        data: {
          name: `whatsapp_${phoneNumber}`,
          status: "active",
          businessId: "PresTrack-id",
          guestId: user.id
        }
      });
    }

    // Create message
    const message = await db.message.create({
      data: {
        content: Body,
        senderType: "guest",
        senderId: user.id,
        roomId: room.id,
        timestamp: new Date()
      }
    });

    // Process with AI
    const aiResponse = await processWithAI(Body, user.id);

    // Send AI response back via WhatsApp
    try {
      const message = await twilioClient.messages.create({
        body: aiResponse,
        to: formatWhatsAppNumber(phoneNumber),
        from: FROM
      });
      console.log('WhatsApp message sent:', message.sid);
      return message.sid;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error('Failed to send WhatsApp message');
    }

    res.status(200).send('Message processed');
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    res.status(500).send('Error processing message');
  }
}

async function processWithAI(message, userId) {
  // Your AI integration logic here
  const response = await fetch("https://genistud.io/api/message", {
    method: "POST",
    body: JSON.stringify({
      chatbotId: process.env.CHATBOT_ID,
      email: "whatsapp-user@example.com",
      message: message
    }),
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    throw new Error("AI processing failed");
  }

  const aiResponse = await response.text();
  return aiResponse;
}

export async function sendAppointmentReminder(visitId) {
  try {
    const visit = await db.visitation.findUnique({
      where: { id: visitId },
      include: { guest: true }
    });

    if (!visit) throw new Error("Visit not found");

    const message = `⏰ Reminder: You have a visit scheduled at ${visit.scheduledTime.toLocaleString()}.`;

    try {
      const message = await twilioClient.messages
        .create({
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
          body: message,
          to: formatWhatsAppNumber(visit.guest.phone),
        })
        .then((message) => {
          console.log('WhatsApp reminder sent:', message.sid);
          return message.sid;
        })
        .catch((error) => {
          console.error('Error sending appointment reminder:', error);
          throw new Error('Failed to send appointment reminder');
        });
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    throw error;
  }
}

export async function createAppointmentFromWhatsApp(req, res) {
  try {
    const { From, Body } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');

    // Parse appointment details from message
    // This is a simple example - you might want to use NLP for better parsing
    const [date, time] = Body.match(/\d{1,2}[/\-]\d{1,2}/g) || [];

    if (!date || !time) {
      throw new Error("Invalid appointment format");
    }

    // Create email from phone number
    const email = `whatsapp_${phoneNumber}@pres-track.com`;

    // Find or create user
    let user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: "WhatsApp User",
          role: "guest",
          businessId: "PresTrack-id"
        }
      });
    }

    // Create visitation record
    const visit = await db.visitation.create({
      data: {
        guestId: user.id,
        scheduledTime: new Date(`${date}T${time}:00`),
        notes: "Created via WhatsApp"
      }
    });

    // Send confirmation
    await twilioClient.messages.create({
      from: FROM,
      to: From,
      body: `✅ Appointment scheduled for ${visit.scheduledTime.toLocaleString()}`
    });

    res.status(200).send('Appointment created');
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).send('Error creating appointment');
  }
}
