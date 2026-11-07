// Все запросы к Telegram идут только через этот клиент.
// Если задан TELEGRAM_PROXY_URL, запросы уходят по зашифрованному каналу через промежуточный сервер.
// Шифрование идёт от сайта до самого Telegram, поэтому тот сервер видит только адрес Telegram:
// ни ключа бота, ни постов он прочитать не может. Другие сервисы через него не ходят.
const axios = require('axios');
const https = require('https');
const tls = require('tls');

const TUNNEL_TIMEOUT_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 120 * 1000;
const MAX_ANSWER_HEAD_BYTES = 8 * 1024;
const TUNNEL_ERROR = 'Нет связи с Telegram через промежуточный сервер';

const parseProxyUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    // В тексте исходной ошибки был бы весь адрес вместе с паролем.
    url = null;
  }
  if (!url || url.protocol !== 'https:') {
    throw new Error('TELEGRAM_PROXY_URL указан неверно: нужен адрес вида https://имя:пароль@сервер');
  }
  const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
  return {
    host: url.hostname,
    port: Number(url.port) || 443,
    authorization: url.username ? `Proxy-Authorization: Basic ${Buffer.from(credentials).toString('base64')}\r\n` : '',
  };
};

class TelegramTunnelAgent extends https.Agent {
  constructor(proxyUrl) {
    super();
    this.proxy = parseProxyUrl(proxyUrl);
  }

  createConnection(options, callback) {
    const { host, port, authorization } = this.proxy;
    const target = `${options.host}:${options.port}`;
    const outer = tls.connect({ host, port, servername: host, ALPNProtocols: ['http/1.1'] });
    let answer = Buffer.alloc(0);
    let finished = false;

    const fail = () => {
      if (finished) return;
      finished = true;
      outer.destroy();
      callback(new Error(TUNNEL_ERROR));
    };

    const onReadable = () => {
      let chunk = outer.read();
      while (chunk !== null) {
        answer = Buffer.concat([answer, chunk]);
        chunk = outer.read();
      }
      const headEnd = answer.indexOf('\r\n\r\n');
      if (headEnd < 0) {
        if (answer.length > MAX_ANSWER_HEAD_BYTES) fail();
        return;
      }
      if (!/^HTTP\/1\.[01] 200\b/.test(answer.toString('latin1', 0, headEnd))) {
        fail();
        return;
      }

      finished = true;
      outer.removeListener('readable', onReadable);
      outer.removeListener('error', fail);
      outer.removeListener('close', fail);
      outer.setTimeout(0);
      const rest = answer.subarray(headEnd + 4);
      if (rest.length > 0) outer.unshift(rest);

      const inner = tls.connect({ socket: outer, servername: options.servername || options.host });
      outer.once('error', () => inner.destroy(new Error(TUNNEL_ERROR)));
      callback(null, inner);
    };

    outer.setTimeout(TUNNEL_TIMEOUT_MS, fail);
    outer.once('error', fail);
    outer.once('close', fail);
    outer.on('readable', onReadable);
    outer.once('secureConnect', () => {
      outer.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${authorization}\r\n`);
    });
  }
}

const proxyUrl = String(process.env.TELEGRAM_PROXY_URL || '').replace(/['"]/g, '').trim();

const telegramHttp = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  ...(proxyUrl ? { proxy: false, httpsAgent: new TelegramTunnelAgent(proxyUrl) } : {}),
});

module.exports = { telegramHttp, TUNNEL_ERROR };
