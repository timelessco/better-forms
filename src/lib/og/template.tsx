import { MAX_OG_TITLE_LENGTH, clampOgText } from "@/lib/og/limits";
import { THEME_COLORS } from "@/lib/theme/theme-presets";

const DEFAULT_ACCENT = THEME_COLORS.neutral.primary;

const BG = "#0a0a0a";
const FG = "#fafafa";
const FG_MUTED = "#a3a3a3";
const FG_DIM = "#525252";

export type OgCardProps = {
  title: string;
  description: string;
  /** Absolute URL or data URL for the icon. Sprite names are pre-resolved by the handler. */
  iconUrl?: string | null;
  themeColorName?: string | null;
};

export const OgCard = ({ title, description, iconUrl, themeColorName }: OgCardProps) => {
  const accent =
    (themeColorName && THEME_COLORS[themeColorName as keyof typeof THEME_COLORS]?.primary) ||
    DEFAULT_ACCENT;

  // Clamp at render time only (post-hash, so existing OG URLs stay valid).
  const renderedTitle = clampOgText(title, MAX_OG_TITLE_LENGTH);

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        background: BG,
        padding: "80px",
        color: FG,
      }}
    >
      <div
        style={{
          width: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {iconUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={iconUrl} width={140} height={140} style={{ opacity: 0.9 }} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "serif",
              fontStyle: "italic",
              fontSize: "140px",
              fontWeight: 400,
              color: FG_DIM,
              lineHeight: 1,
            }}
          >
            f.
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginLeft: "40px",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: FG,
            display: "flex",
          }}
        >
          {renderedTitle}
        </div>
        {description ? (
          <div
            style={{
              marginTop: "28px",
              fontSize: "30px",
              lineHeight: 1.4,
              color: FG_MUTED,
              display: "flex",
            }}
          >
            {description}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "auto",
            paddingTop: "48px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "4px",
              borderRadius: "999px",
              background: accent,
            }}
          />
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: FG_MUTED,
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
