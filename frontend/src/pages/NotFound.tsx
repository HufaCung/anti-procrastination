import { Link } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { EmptyState, useDocumentTitle } from '../components/ui';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <Page label="Not found">
      <section className="card" style={{ marginTop: 40 }}>
        <EmptyState icon="search" title="This page doesn’t exist" body="The link may be old, or the page was moved.">
          <Link to="/" className="btn btn-primary">Back to dashboard</Link>
        </EmptyState>
      </section>
    </Page>
  );
}
