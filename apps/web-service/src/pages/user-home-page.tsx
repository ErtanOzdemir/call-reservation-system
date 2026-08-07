import { Navbar } from '../components/navbar';

export function UserHomePage() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="workspace">
        <h1>User workspace</h1>
        <p className="workspace-intro">
          You are authenticated.
        </p>
        <section className="placeholder-card">
          <h2>Reservation calendar</h2>
          <p>Future 30-minute slots will appear here.</p>
        </section>
      </main>
    </div>
  );
}

export default UserHomePage;
