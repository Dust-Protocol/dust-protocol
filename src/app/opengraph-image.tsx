import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dust Protocol — Private Transfers & Stealth Addresses on Ethereum";
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                backgroundColor: "#00FF41",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
                color: "#06080F",
              }}
            >
              D
            </div>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "white",
              }}
            >
              DUST PROTOCOL
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <span
              style={{
                fontSize: "52px",
                fontWeight: 700,
                color: "white",
                lineHeight: 1.15,
              }}
            >
              Private Transfers &
            </span>
            <span
              style={{
                fontSize: "52px",
                fontWeight: 700,
                color: "#00FF41",
                lineHeight: 1.15,
              }}
            >
              Stealth Addresses
            </span>
          </div>
          <span
            style={{
              fontSize: "22px",
              color: "rgba(255,255,255,0.6)",
              maxWidth: "700px",
              lineHeight: 1.5,
            }}
          >
            Send and receive crypto privately using zero-knowledge proofs on Ethereum. Non-custodial, open-source.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            {["ERC-5564", "ZK-UTXO", "Uniswap V4", "ERC-4337"].map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "6px 14px",
                  border: "1px solid rgba(0,255,65,0.25)",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "#00FF41",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: "16px",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            dustprotocol.app
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
