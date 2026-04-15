// backend/src/utils/emailTemplates.js

const getBaseTemplate = (content) => `
  <div style="background-color: #0f172a; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f8fafc;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #1e293b; border-radius: 24px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
      <tr>
        <td align="center" style="padding: 40px 0 20px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff;">
            SADOVOD<span style="color: #3b82f6;">PS</span>
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 40px 40px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="padding: 20px 40px; background-color: #0f172a; text-align: center; color: #64748b; font-size: 12px;">
          © 2026 SMMBOXSS. Все права защищены.<br>
          Это автоматическое письмо, на него не нужно отвечать.
        </td>
      </tr>
    </table>
  </div>
`;

exports.passwordResetTemplate = (resetUrl) => getBaseTemplate(`
  <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 16px; text-align: center;">
    Восстановление доступа
  </h2>
  <p style="font-size: 16px; line-height: 24px; color: #94a3b8; margin-bottom: 32px; text-align: center;">
    Вы получили это письмо, потому что запросили сброс пароля для вашего аккаунта. Нажмите на кнопку ниже, чтобы установить новый пароль:
  </p>
  <div style="text-align: center; margin-bottom: 32px;">
    <a href="${resetUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">
      Сбросить пароль
    </a>
  </div>
  <p style="font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
    Ссылка действительна в течение <b>1 часа</b>. <br>
    Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
  </p>
`);

exports.welcomeTemplate = (name, id) => getBaseTemplate(`
  <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 16px; text-align: center;">
    Добро пожаловать, ${name}!
  </h2>
  <p style="font-size: 16px; line-height: 24px; color: #94a3b8; margin-bottom: 24px; text-align: center;">
    Регистрация прошла успешно. Теперь вам доступны все функции автопостинга SMMBOXSS.
  </p>
  <div style="background-color: #0f172a; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #334155;">
    <p style="margin: 0; color: #64748b; font-size: 14px;">Ваш уникальный ID:</p>
    <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 24px; font-weight: 800; font-family: monospace;">#${id}</p>
  </div>
`);