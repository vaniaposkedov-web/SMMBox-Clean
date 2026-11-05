const nodemailer = require('nodemailer');

// Returns true when the mail server accepted the letter, so callers can tell the user the truth.
const sendEmail = async (email, subject, message) => {
  try {
    const port = Number(process.env.SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"SADOVODPS" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html: message,
    });
    console.log('Письмо успешно отправлено: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Ошибка SMTP:', error.message);
    return false;
  }
};

module.exports = sendEmail;
