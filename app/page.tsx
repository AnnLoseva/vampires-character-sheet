'use client';

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
      <h1 style={{ fontSize: "4rem", margin: 0 }}>🩸 VTM</h1>
      <p style={{ fontSize: "1.5rem", marginTop: "20px" }}>
        Лист персонажа Vampire: The Masquerade
      </p>
      <p style={{ marginTop: "40px", color: "#666" }}>
        Если ты видишь эту страницу — деплой работает ✅
      </p>
    </div>
  );
}