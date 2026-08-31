import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Dexlyy — AI voice interviews for FiveM communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(
  join(process.cwd(), "public", "dexlyy-logo.png"),
  "base64",
);
const logoSrc = `data:image/png;base64,${logoData}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        overflow: "hidden",
        padding: "72px 80px",
        color: "#f4fff8",
        background: "#071812",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          right: -90,
          top: -130,
          borderRadius: 999,
          background: "#126a4b",
          opacity: 0.62,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          right: 30,
          bottom: -190,
          borderRadius: 999,
          border: "2px solid #5ed49a",
          opacity: 0.34,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", width: 820 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 45,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 58,
              height: 58,
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #8bdcb2",
              borderRadius: 17,
              background: "#e9f8ef",
            }}
          >
            <img src={logoSrc} width={52} height={52} alt="" />
          </div>
          <span style={{ fontSize: 28, fontWeight: 700 }}>Dexlyy</span>
        </div>
        <span
          style={{
            color: "#62d69d",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          FIVEM WHITELIST INTERVIEWS · 24/7
        </span>
        <h1
          style={{
            maxWidth: 840,
            margin: "22px 0 20px",
            fontSize: 70,
            lineHeight: 0.98,
            letterSpacing: -4,
          }}
        >
          Meet the right players. Without living in interviews.
        </h1>
        <p
          style={{
            maxWidth: 700,
            margin: 0,
            color: "#9db8ab",
            fontSize: 25,
            lineHeight: 1.45,
          }}
        >
          AI voice interviews, Discord verification, and human approval in one
          polished workflow.
        </p>
      </div>
    </div>,
    size,
  );
}
