export default function NotFound() {
  return (
    <html>
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}>
          <h1 style={{ fontSize: "6rem", fontWeight: "bold", margin: 0 }}>
            404
          </h1>
          <p style={{ fontSize: "1.25rem", color: "#666", marginBottom: "2rem" }}>
            Page not found
          </p>
          <a
            href="/"
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#000",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
