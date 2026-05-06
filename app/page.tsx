export default function Home() {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#0a0a0a",
      color: "#ff3131",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ fontSize: "5rem", margin: 0 }}>🩸 VTM</h1>
      <p style={{ fontSize: "2rem", marginTop: "20px" }}>
        Лист персонажа успешно загружен
      </p>
      <p style={{ marginTop: "50px", color: "#666", fontSize: "1.1rem" }}>
        Если ты видишь эту страницу — всё работает
      </p>
    </div>
  );
}
