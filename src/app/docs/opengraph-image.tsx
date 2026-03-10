import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dust Protocol Documentation — Privacy Protocol for Ethereum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: "#06080F",
          padding: "60px 80px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "8px",
                backgroundColor: "#00FF41",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
                color: "#06080F",
              }}
            >
              D
            </div>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "white",
              }}
            >
              DUST PROTOCOL
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.3)",
                marginLeft: "12px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              DOCUMENTATION
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "30px",
            }}
          >
            <span
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "white",
                lineHeight: 1.15,
              }}
            >
              Stealth Addresses, Privacy Pools
            </span>
            <span
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "#00FF41",
                lineHeight: 1.15,
              }}
            >
              & Private Swaps
            </span>
          </div>
          <span
            style={{
              fontSize: "20px",
              color: "rgba(255,255,255,0.55)",
              maxWidth: "750px",
              lineHeight: 1.5,
              marginTop: "8px",
            }}
          >
            Technical documentation for ERC-5564 stealth addresses, ZK-UTXO privacy pools with Groth16 proofs, and atomic private swaps via Uniswap V4 hooks.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            {["How It Works", "Key Management", "Smart Contracts", "FAQ"].map((page) => (
              <span
                key={page}
                style={{
                  padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {page}
              </span>
            ))}
          </div>
          <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)" }}>
            dustprotocol.app/docs
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
