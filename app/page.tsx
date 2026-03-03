import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="landing-hero">
        <h1>
          <span className="logo-icon">🧠</span> Mindmap
        </h1>
        <p className="landing-subtitle">
          Create, organize, and export your mindmaps — self-hosted, fully yours.
        </p>
        <div className="landing-actions">
          <Link href="/register" className="btn-primary">
            Get Started
          </Link>
          <Link href="/login" className="btn-secondary">
            Login
          </Link>
        </div>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <span className="feature-icon">🗺</span>
          <h3>Visual Mindmaps</h3>
          <p>Drag-and-drop canvas with keyboard shortcuts</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📝</span>
          <h3>Rich Notes</h3>
          <p>Full rich-text editor per node with attachments</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📤</span>
          <h3>Import / Export</h3>
          <p>Markdown and DOCX round-trip conversion</p>
        </div>
      </div>
    </main>
  );
}
