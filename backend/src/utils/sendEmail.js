const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    // Создаем транспортер с жесткой привязкой типов для порта
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // Для порта 587 должно быть false! (true используется только для 465)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Убедись, что пароль из 16 букв в .env не содержит пробелов!
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"SMMBOXSS" <${process.env.SMTP_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.message,
    };

    // Отправляем письмо
    const info = await transporter.sendMail(mailOptions);
    console.log('Письмо успешно отправлено: %s', info.messageId);

  } catch (error) {
    console.error('❌ ОШИБКА SMTP (NODEMAILER):', error.message);
    // Пробрасываем ошибку дальше, чтобы контроллер знал о сбое
    throw new Error('Не удалось отправить письмо: ' + error.message);
  }
};

module.exports = sendEmail;