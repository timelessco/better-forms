import { THEME_COLORS } from "@/lib/theme/theme-presets";

const DEFAULT_ACCENT = THEME_COLORS.neutral.primary;

const tintHex = (hex: string, alpha = 0.08): string => {
  // satori does NOT support rgba()/oklch() — append two hex digits for alpha.
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
};

export type OgCardProps = {
  title: string;
  description: string;
  icon?: string | null;
  themeColorName?: string | null;
};

export const OgCard = ({ title, description, icon, themeColorName }: OgCardProps) => {
  const accent =
    (themeColorName && THEME_COLORS[themeColorName as keyof typeof THEME_COLORS]?.primary) ||
    DEFAULT_ACCENT;
  const tint = tintHex(accent, 0.08);

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background: tint,
        padding: "64px",
        fontFamily: "Inter",
        color: "#0a0a0a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {icon ? (
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            {icon}
          </div>
        ) : (
          <div style={{ width: "72px", height: "72px" }} />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          marginTop: "32px",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              marginTop: "24px",
              fontSize: "30px",
              lineHeight: 1.4,
              color: "#525252",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            width: "120px",
            height: "6px",
            borderRadius: "999px",
            background: accent,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#737373",
              letterSpacing: "-0.01em",
            }}
          >
            Reform
          </div>
        </div>
      </div>
    </div>
  );
};
