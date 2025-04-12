const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendApprovalEmail = async (email, name, password) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Account Approved - Welcome to Our Platform',
    text: `Hello ${name},\n\nYour account has been approved! You can now log in using the following credentials:\n\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password after logging in.\n\nThank you!`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Approval email sent to ${email}`);
  } catch (error) {
    console.error('Error sending approval email:', error);
  }
}
  
  const sendResetPasswordEmail = async (email, resetToken) => {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `You have requested to reset your password. Click the link below to reset it:
  
  https://e-commerce-frontend-blue-mu.vercel.app/reset-password/${resetToken}
  
  If you did not request this, please ignore this email.`,
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Reset password email sent to ${email}`);
    } catch (error) {
      console.error('Error sending reset password email:', error);
    }
  };

  const sendDocumentRejectionEmail = async (email, reason) => {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Document Rejected - Action Required',
      text: `Hello,
  
  Your submitted documents have been reviewed and were found to be incorrect or insufficient.
  
  Reason: ${reason}
  
  Please resubmit the correct documents for approval.
  
  Thank you.`,
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Document rejection email sent to ${email}`);
    } catch (error) {
      console.error('Error sending document rejection email:', error);
    }
  };  

module.exports = { sendApprovalEmail, sendResetPasswordEmail, sendDocumentRejectionEmail };