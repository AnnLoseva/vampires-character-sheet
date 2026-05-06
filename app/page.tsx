'use client';

export default function VampireSheet() {
  return (
    <iframe 
      src="/sheet.html" 
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block"
      }}
      title="VTM Character Sheet v1"
    />
  );
}