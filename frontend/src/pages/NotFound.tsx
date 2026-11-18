import { useCopy } from '../i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { EmptyState, useDocumentTitle } from '../components/ui';

export function NotFoundPage() {
  const copy = useCopy();
  useDocumentTitle(copy("Not found"));
  return (
    <Page label={copy("Not found")}>
      <section className="card" style={{ marginTop: 40 }}>
        <EmptyState icon="search" title={copy("This page doesn’t exist")} body={copy("The link may be old, or the page was moved.")}>
          <Link to="/" className="btn btn-primary">{copy("Back to dashboard")}</Link>
        </EmptyState>
      </section>
    </Page>
  );
}
