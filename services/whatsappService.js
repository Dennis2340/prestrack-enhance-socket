import { db } from "../db/index.js";
import * as dotenv from 'dotenv';
import { ensureBusinessExists } from './chatService.js';

dotenv.config();

// WhatsApp number formatting utility
function formatWhatsAppNumber(phone) {
  // Remove any non-digit characters
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Add country code if missing (assuming Sierra Leone +232)
  if (cleaned.startsWith('232')) {
    return cleaned;
  } else if (cleaned.startsWith('31466865')) {
    return '23231466865';
  } else if (!cleaned.startsWith('232')) {
    return `232${cleaned}`;
  }
  return cleaned;
}

export async function handleWhatsAppMessage(req, res) {
  try {
    const messages = req.body.messages;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    for (const message of messages) {
      if (message.from_me) continue;
      
      const phoneNumber = message.chat_id.split('@')[0];
      const messageText = message.text?.body;
      
      if (!messageText) continue;
      
      // Create email from phone number
      const email = `whatsapp_${phoneNumber}@pres-track.com`;

      try {
        // Ensure business exists using the existing helper function
        // Using a default business ID for WhatsApp messages
        const business = await ensureBusinessExists(process.env.BUSINESS_ID || "PresTrack-id",);
        if (!business) {
          throw new Error('Failed to ensure business exists');
        }

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
              businessId: business.id
            }
          });
        }

        // Create or find room for WhatsApp user
        let room = await db.room.findFirst({
          where: { 
            guestId: user.id,
            businessId: business.id
          }
        });

        if (!room) {
          room = await db.room.create({
            data: {
              name: `whatsapp_${phoneNumber}`,
              status: "active",
              businessId: business.id,
              guestId: user.id
            }
          });
        }

        // Create message in database
        await db.message.create({
          data: {
            content: messageText,
            senderType: "guest",
            senderId: user.id,
            roomId: room.id,
            timestamp: new Date()
          }
        });

        try {
          // Process with AI
          const aiResponse = await processWithAI(messageText, phoneNumber);

          // Send AI response back via WhatsApp
          const response = await fetch('https://gate.whapi.cloud/messages/text', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'authorization': `Bearer ${process.env.BEARER_TOKEN}`
            },
            body: JSON.stringify({
              typing_time: 10,
              to: phoneNumber,
              body: aiResponse
            })
          });

          // Save AI response to database
          if (aiResponse) {
            await db.message.create({
              data: {
                content: aiResponse,
                senderType: "agent",
                senderId: user.id, // Or system user ID if available
                roomId: room.id,
                timestamp: new Date()
              }
            });
          }

          const data = await response.json();
          console.log('AI response sent via WhatsApp:', data);
          
        } catch (aiError) {
          console.error('Error processing AI response:', aiError);
          // Continue with next message even if AI fails
        }

      } catch (error) {
        console.error('Error processing message:', error);
        // Continue with next message on error
        continue;
      }
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    res.status(500).json({ 
      error: 'Error processing message',
      details: error.message 
    });
  }
}

async function processWithAI(message, phoneNumber) {
  try {
    const email = `whatsapp_${phoneNumber}@pres-track.com`;
    
    const response = await fetch("https://genistud.io/api/message", {
      method: "POST",
      body: JSON.stringify({
        chatbotId: process.env.CHATBOT_ID,
        email: email,
        message: message
      }),
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`AI processing failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No reader available for streaming response");
    }

    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value, { stream: true });
    }

    console.log("AI Response:", fullResponse);
    return fullResponse;
  } catch (error) {
    console.error('Error in processWithAI:', error);
    throw error;
  }
}

export async function sendAppointmentReminder(visitId) {
  try {
    const visit = await db.visitation.findUnique({
      where: { id: visitId },
      include: { guest: true }
    });

    if (!visit) throw new Error("Visit not found");

    const message = `⏰ Reminder: You have a visit scheduled at ${visit.scheduledTime.toLocaleString()}.`;
    const toNumber = formatWhatsAppNumber(visit.guest.phone);

    const response = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': `Bearer ${process.env.BEARER_TOKEN}`
      },
      body: JSON.stringify({
        typing_time: 10,
        to: toNumber,
        body: message
      })
    });

    const data = await response.json();
    console.log('Appointment reminder sent via WhatsApp:', data);
    return data;
  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    throw error;
  }
}

export async function createAppointmentFromWhatsApp(req, res) {
  try {
    const messages = req.body.messages;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("No valid messages found");
    }

    const message = messages[0];
    const phoneNumber = message.chat_id.split('@')[0];
    const messageText = message.text?.body;

    if (!messageText) {
      throw new Error("No message text found");
    }

    // Parse appointment details from message
    // This is a simple example - you might want to use NLP for better parsing
    const [date, time] = messageText.match(/\d{1,2}[/\-]\d{1,2}/g) || [];

    if (!date || !time) {
      // Send error message back via WhatsApp
      await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${process.env.BEARER_TOKEN}`
        },
        body: JSON.stringify({
          typing_time: 10,
          to: phoneNumber,
          body: '❌ Invalid appointment format. Please use format: DD/MM HH:MM'
        })
      });
      return res.status(400).json({ error: 'Invalid appointment format' });
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

    // Send confirmation via WhatsApp
    await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': `Bearer ${process.env.BEARER_TOKEN}`
      },
      body: JSON.stringify({
        typing_time: 10,
        to: phoneNumber,
        body: `✅ Appointment scheduled for ${visit.scheduledTime.toLocaleString()}`
      })
    });

    res.status(200).send('Appointment created');
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).send('Error creating appointment');
  }
}
