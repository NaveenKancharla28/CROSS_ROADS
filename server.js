import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get directory name (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// Create reservations data directory
const dataDir = path.join(__dirname, 'reservations-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Email transporter setup with error handling
let transporter = null;
let emailConfigured = false;

// Initialize email transporter
async function initializeEmail() {
  if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    });

    try {
      await transporter.verify();
      console.log('✓ Email service ready');
      emailConfigured = true;
    } catch (error) {
      console.error('⚠ Email service not available:', error.message);
      console.log('✓ Reservations will be saved locally');
    }
  }
}

// POST endpoint for reservations
app.post('/api/reservations', async (req, res) => {
  try {
    const { name, phone, email, date, time, guests, notes } = req.body;

    // Validate required fields
    if (!name || !phone || !email || !date || !time || !guests) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const reservationData = {
      id: Date.now(),
      name,
      phone,
      email,
      date,
      time,
      guests,
      notes,
      submittedAt: new Date().toISOString(),
    };

    // Save to JSON file
    const filePath = path.join(dataDir, `reservation-${reservationData.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(reservationData, null, 2));
    console.log(`✓ Reservation saved: ${name} - ${filePath}`);

    let emailSent = false;

    // Try to send emails if email is configured
    if (emailConfigured && transporter) {
      try {
        // Email to restaurant
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: process.env.GMAIL_USER,
          subject: `New Reservation Request from ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #123326; border-bottom: 2px solid #b78b4b; padding-bottom: 10px;">
                New Reservation Request
              </h2>
              
              <div style="background: #f7f2e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Guest Name:</strong> ${name}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Number of Guests:</strong> ${guests}</p>
                ${notes ? `<p><strong>Special Requests:</strong> ${notes}</p>` : ''}
              </div>

              <p style="color: #555; font-size: 14px;">
                <em>Please contact the guest to confirm this reservation.</em>
              </p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);

        // Email to guest
        const confirmationEmail = {
          from: process.env.GMAIL_USER,
          to: email,
          subject: 'Reservation Request Received - CROSS ROADS Bistro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #123326;">Thank You for Your Reservation Request</h2>
              
              <p>Dear ${name},</p>
              
              <p>We have received your reservation request for CROSS ROADS Bistro. Our team will contact you shortly to confirm your booking.</p>
              
              <div style="background: #f7f2e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Reservation Details:</strong></p>
                <p>Date: ${new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p>Time: ${time}</p>
                <p>Guests: ${guests}</p>
              </div>

              <p>If you need to make any changes, please contact us at:</p>
              <p><strong>Phone:</strong> (214) 555-1234<br />
                 <strong>Email:</strong> reservations@crossroadsbistro.com</p>

              <p style="color: #555; font-size: 14px; margin-top: 30px;">
                <em>CROSS ROADS Bistro - Pan-Indian Fine Dining</em><br />
                2821 Turtle Creek Blvd. | Dallas, TX 75219
              </p>
            </div>
          `,
        };

        await transporter.sendMail(confirmationEmail);
        emailSent = true;
        console.log(`✓ Emails sent to ${process.env.GMAIL_USER} and ${email}`);
      } catch (emailError) {
        console.error('⚠ Email sending failed:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: emailSent 
        ? '✓ Reservation submitted! You will receive a confirmation email shortly.'
        : '✓ Reservation received! We will contact you shortly to confirm.',
    });
  } catch (error) {
    console.error('Error processing reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process reservation. Please try again or call (214) 555-1234',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    emailConfigured: emailConfigured
  });
});

// GET all reservations (for admin viewing)
app.get('/api/reservations', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir);
    const reservations = files
      .filter(f => f.startsWith('reservation-'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')))
      .sort((a, b) => b.submittedAt - a.submittedAt);
    
    res.json({ success: true, reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve reservations' });
  }
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize email and start server
initializeEmail().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`📁 Reservations saved to: ${dataDir}`);
  });
});
