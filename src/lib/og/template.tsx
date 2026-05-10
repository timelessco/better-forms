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
        // takumi (and Satori) require an explicit font-family — there's no
        // bundled-default fallback like @vercel/og's Geist.
        fontFamily: "Inter",
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
          // Brand mark fallback. Previously rendered in italic-serif (relying
          // on @vercel/og's bundled Geist as the serif source); takumi only has
          // the Inter weights we explicitly bundle, so this falls back to a
          // bold Inter glyph instead.
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "140px",
              fontWeight: 800,
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
          // `space-between` so the brand footer always sits at the bottom
          // regardless of how much title/description content is above it.
          // (`marginTop: "auto"` worked under @vercel/og's Satori flex impl
          // but renders inconsistently under takumi when content is short.)
          justifyContent: "space-between",
          marginLeft: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              // Inter ExtraBold (800) is the heaviest weight we bundle; takumi
              // doesn't synthesize bolder weights.
              fontWeight: 800,
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
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
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
