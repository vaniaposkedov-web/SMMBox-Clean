import { LEGAL_DOCUMENTS } from '../../legal/details';

// Документы открываются в новой вкладке, чтобы человек не потерял то, что делал на сайте.
export default function LegalLinks({ className = '' }) {
  return (
    <ul className={className}>
      {LEGAL_DOCUMENTS.map(({ path, title }) => (
        <li key={path}>
          <a href={path} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 hover:underline transition-colors">{title}</a>
        </li>
      ))}
    </ul>
  );
}
