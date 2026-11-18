import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from './LanguageContext';
import { RiskPill } from '../components/ui';
import { formatRiskReason } from './progress';

afterEach(() => vi.unstubAllGlobals());

it('renders a Vietnamese risk label alongside unchanged workspace content', () => {
  vi.stubGlobal('localStorage', { getItem: () => 'vi' });
  const title = 'Meet Mon about May report';
  const html = renderToStaticMarkup(createElement(LanguageProvider, {
    children: createElement('div', null, createElement('span', { title }, title), createElement(RiskPill, { risk: 'at_risk' })),
  }));
  expect(html).toContain(`title="${title}">${title}</span>`);
  expect(html).toContain('Có rủi ro');
});

it('formats the same pace reason in English and Vietnamese', () => {
  const reason = { kind: 'pace', actual: 10, needed: 40 } as const;
  expect(formatRiskReason(reason, 'en')).toContain('10 min/day');
  expect(formatRiskReason(reason, 'vi')).toContain('10 phút/ngày');
});
