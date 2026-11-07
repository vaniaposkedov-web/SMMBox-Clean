// Редакция документов на сайте. Если меняются соглашение или согласие, поменяйте дату здесь и во frontend/src/legal/details.js.
// После этого сайт попросит всех клиентов принять новую редакцию.
const LEGAL_VERSION = '2026-11-07';

const CONSENT_REQUIRED_ERROR = 'Чтобы продолжить, примите соглашение и дайте согласие на обработку персональных данных.';

// Отметки должны быть именно поставлены человеком, поэтому строки и другие значения не считаются согласием.
const hasLegalConsent = ({ acceptTerms, personalDataConsent } = {}) => acceptTerms === true && personalDataConsent === true;

// Согласие на обработку данных и соглашение записываются отдельно: это разные документы.
const consentRecords = (userId) => ['TERMS', 'PERSONAL_DATA'].map((document) => ({ userId, document, version: LEGAL_VERSION }));

module.exports = { LEGAL_VERSION, CONSENT_REQUIRED_ERROR, hasLegalConsent, consentRecords };
