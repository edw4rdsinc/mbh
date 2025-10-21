// Import the Resend library
import { Resend } from 'resend';

// Initialize Resend with your API key from environment variables
// Vercel will automatically make this available in your function
const resend = new Resend(process.env.RESEND_API_KEY);

// This is the main function Vercel will run
export default async function handler(req, res) {
  // Only allow POST requests, reject anything else
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Extract the form data from the request body
    const { 
      name, 
      email, 
      audience, 
      company, 
      groupCount, 
      employerName, 
      message, 
      urgency 
    } = req.body;

    // Construct a clear subject line
    const subject = `New Contact Form Submission: ${audience} (${urgency})`;

    // Construct the email body using the submitted data
    // This creates a clean, readable email.
    const emailBody = `
      <p>You have a new contact form submission:</p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Inquiry Type:</strong> ${audience}</li>
        <li><strong>Urgency:</strong> ${urgency}</li>
        ${company ? `<li><strong>Agency Name:</strong> ${company}</li>` : ''}
        ${groupCount ? `<li><strong>Approx. Groups:</strong> ${groupCount}</li>` : ''}
        ${employerName ? `<li><strong>Employer/Group Name:</strong> ${employerName}</li>` : ''}
      </ul>
      <hr>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;
    
    // Use Resend to send the email
    // NOTE: Update the 'from' address to use your verified domain in Resend
    // Example: 'Contact Form <noreply@mybenefitshelp.net>' after domain verification
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Contact Form <noreply@mybenefitshelp.net>',
      to: ['info@mybenefitshelp.net'], // The destination address
      subject: subject,
      html: emailBody,
      reply_to: email, // Set the "Reply-To" to the user's email
    });

    // If there's an error from Resend, return an error response
    if (error) {
      console.error({ error });
      return res.status(400).json({ error: 'There was a problem sending the email.' });
    }

    // If successful, return a success response
    return res.status(200).json({ message: 'Message sent successfully!' });

  } catch (error) {
    // Handle any other unexpected errors
    console.error(error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

