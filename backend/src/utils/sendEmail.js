const nodemailer = require('nodemailer');

// Теперь функция правильно принимает 3 отдельных аргумента
const sendEmail = async (email, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465, 
      secure: true, // Для 465 порта строго true
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, 
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"SMMBOX" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject,
      html: message,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Письмо успешно отправлено: %s', info.messageId);

  } catch (error) {
    console.error('❌ ОШИБКА SMTP (NODEMAILER):', error.message);
  }
};

module.exports = sendEmail;