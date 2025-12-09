import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'reservations-data');

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

async function sendConfirmationEmails() {
  try {
    // Verify connection
    console.log('🔐 Verifying Gmail connection...');
    await transporter.verify();
    console.log('✓ Gmail connection verified!\n');

    // Read all reservation files
    const files = fs.readdirSync(dataDir)
      .filter(f => f.startsWith('reservation-'))
      .sort();

    if (files.length === 0) {
      console.log('No reservations found.');
      return;
    }

    console.log(`Found ${files.length} reservation(s). Sending confirmation emails...\n`);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const reservation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { name, email, date, time, guests, notes } = reservation;

      // Email to restaurant
      const restaurantEmail = {
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
              <p><strong>Phone:</strong> ${reservation.phone}</p>
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

      try {
        await transporter.sendMail(restaurantEmail);
        console.log(`✓ Restaurant email sent for ${name}`);

        await transporter.sendMail(confirmationEmail);
        console.log(`✓ Confirmation email sent to ${email}`);
        console.log('');
      } catch (error) {
        console.error(`✗ Failed to send email for ${name}:`, error.message);
      }
    }

    console.log('✅ All emails sent successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sendConfirmationEmails();
