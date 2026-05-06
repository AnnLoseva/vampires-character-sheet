export default function Home() {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#000",
      color: "#ff3131",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      fontFamily: "Arial"
    }}>
      <h1 style={{fontSize: "4.5rem", margin: 0}}>🩸 VTM</h1>
      <p style={{fontSize: "1.8rem", marginTop: "20px"}}>
        Лист персонажа
      </p>
      <p style={{marginTop: "80px", color: "#666"}}>
        Если видишь эту страницу — деплой работает
      </p>
    </div>
  );
}
