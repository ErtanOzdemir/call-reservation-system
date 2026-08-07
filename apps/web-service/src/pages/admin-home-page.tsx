import { Navbar } from '../components/navbar';

export function AdminHomePage() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="workspace">
        <h1>Admin dashboard</h1>
        <p className="workspace-intro">
          You are authenticated as an admin.
        </p>
        <section className="placeholder-card">
          <h2>Pending requests</h2>
          <p>Incoming reservation requests will appear here.</p>
        </section>
      </main>
    </div>
  );
}

export default AdminHomePage;
