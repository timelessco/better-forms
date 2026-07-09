"use strict";
(() => {
  var L = (t, e, n) => {
      if (document.head.querySelector(`link[rel="${t}"][href="${e}"]`)) return;
      let i = document.createElement("link");
      ((i.rel = t),
        (i.href = e),
        n !== void 0 && (i.crossOrigin = n),
        document.head.appendChild(i));
    },
    T = (t) => {
      t !== window.location.origin && (L("preconnect", t, "anonymous"), L("dns-prefetch", t));
    },
    k = (t, e) => {
      let n = !1,
        o = () => {
          n || ((n = !0), e());
        },
        i = { once: !0, passive: !0 };
      (t.addEventListener("pointerenter", o, i),
        t.addEventListener("focus", o, i),
        t.addEventListener("touchstart", o, i));
    };
  var z = /^[A-Za-z0-9]{7}$/,
    V = new Set([
      "formId",
      "position",
      "width",
      "darkOverlay",
      "overlay",
      "hideTitle",
      "alignLeft",
      "autoClose",
      "trigger",
      "delay",
    ]),
    Y = 3e3,
    W = 0.5,
    X = /^(?:\p{Extended_Pictographic}\uFE0F?){1,3}$/u,
    K = new Set(["button", "auto", "scroll", "delay", "exit-intent"]),
    q = () => {
      let t = document.getElementsByTagName("script");
      for (let e = t.length - 1; e >= 0; e--)
        if ((t[e].src || "").includes("/embed/popup.js")) return t[e];
      return null;
    },
    J = (t) => {
      if (t?.src)
        try {
          return new URL(t.src).origin;
        } catch {}
      return window.location.origin;
    },
    Z = (t) => {
      let e = t.dataset || {},
        n = e.formId && z.test(e.formId) ? e.formId : "";
      if (!n) return null;
      let o = Object.create(null);
      for (let [l, a] of Object.entries(e)) !V.has(l) && typeof a == "string" && (o[l] = a);
      let i = e.position,
        r = i === "bottom-left" || i === "center" ? i : "bottom-right",
        s = e.trigger && K.has(e.trigger) ? e.trigger : "button";
      return {
        formId: n,
        position: r,
        width: e.width ? parseInt(e.width, 10) : 376,
        darkOverlay: e.darkOverlay === "1" || e.overlay === "1",
        hideTitle: e.hideTitle === "1",
        alignLeft: e.alignLeft === "1",
        autoClose: e.autoClose ? parseInt(e.autoClose, 10) : 0,
        trigger: s,
        delay: e.delay ? parseInt(e.delay, 10) : Y,
        hiddenFields: o,
      };
    },
    Q = async (t, e) => {
      try {
        let n = await fetch(`${t}/api/forms/${encodeURIComponent(e)}/meta`, {
          method: "GET",
          credentials: "omit",
        });
        return n.ok ? await n.json() : null;
      } catch {
        return null;
      }
    },
    v = "http://www.w3.org/2000/svg",
    C = () => {
      let t = document.createElementNS(v, "svg");
      (t.setAttribute("class", "bf-bubble__icon"),
        t.setAttribute("viewBox", "0 0 24 24"),
        t.setAttribute("fill", "none"),
        t.setAttribute("stroke", "currentColor"),
        t.setAttribute("stroke-width", "2"),
        t.setAttribute("stroke-linecap", "round"),
        t.setAttribute("stroke-linejoin", "round"));
      let e = document.createElementNS(v, "path");
      (e.setAttribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"),
        t.appendChild(e));
      let n = document.createElementNS(v, "polyline");
      return (n.setAttribute("points", "14 2 14 8 20 8"), t.appendChild(n), t);
    },
    b = (t, e) => {
      for (; t.firstChild; ) t.removeChild(t.firstChild);
      t.appendChild(e);
    },
    O = (t, e, n) => {
      if (n && /^(https?:\/\/|\/)/.test(n)) {
        let i = document.createElement("img");
        ((i.className = "bf-bubble__icon"), (i.src = n), (i.alt = ""), b(t, i));
        return;
      }
      if (n && X.test(n)) {
        let i = document.createElement("span");
        ((i.className = "bf-bubble__emoji"), (i.textContent = n), b(t, i));
        return;
      }
      if (!(n && /^[a-z0-9-]+$/i.test(n))) {
        b(t, C());
        return;
      }
      (b(t, C()),
        fetch(`${e}/api/icons/${n}`)
          .then((i) => (i.ok ? i.text() : null))
          .then((i) => {
            if (!i) return;
            let s = new DOMParser().parseFromString(i, "image/svg+xml").documentElement;
            !s ||
              s.tagName.toLowerCase() !== "svg" ||
              (s.setAttribute("class", "bf-bubble__icon"), b(t, document.importNode(s, !0)));
          })
          .catch(() => {}));
    },
    ee = (t, e, n) => {
      let o = document.createElement("button");
      return (
        (o.type = "button"),
        (o.className = `bf-bubble bf-bubble--${t.position}`),
        o.setAttribute("aria-label", e?.title || "Open form"),
        O(o, n, e?.icon),
        document.body.appendChild(o),
        o
      );
    },
    H = (t, e) => {
      let n = q();
      if (!n) return;
      let o = Z(n);
      if (!o) return;
      let i = J(n);
      T(i);
      let r = ee(o, null, i),
        s = {
          position: o.position,
          width: o.width,
          hideTitle: o.hideTitle,
          alignLeft: o.alignLeft,
          overlay: o.darkOverlay,
          autoClose: o.autoClose,
          hiddenFields: o.hiddenFields,
        };
      (k(r, () => e(o.formId, s)),
        Q(i, o.formId).then((a) => {
          a && (a.title && r.setAttribute("aria-label", a.title), a.icon && O(r, i, a.icon));
        }));
      let l = () => {
        (r.classList.add("bf-bubble--hidden"),
          t(o.formId, {
            ...s,
            onClose: () => {
              r.classList.remove("bf-bubble--hidden");
            },
          }));
      };
      (r.addEventListener("click", l), o.trigger !== "button" && te(o, l));
    },
    te = (t, e) => {
      let n = !1,
        o = () => {
          n || ((n = !0), e());
        };
      switch (t.trigger) {
        case "auto":
          o();
          break;
        case "delay":
          window.setTimeout(o, t.delay);
          break;
        case "scroll": {
          let i = () => {
            let r = document.documentElement.scrollHeight - window.innerHeight;
            (r > 0 ? window.scrollY / r : 1) >= W && (window.removeEventListener("scroll", i), o());
          };
          window.addEventListener("scroll", i, { passive: !0 });
          break;
        }
        case "exit-intent": {
          let i = (r) => {
            r.clientY <= 0 &&
              !r.relatedTarget &&
              (document.removeEventListener("mouseout", i), o());
          };
          document.addEventListener("mouseout", i);
          break;
        }
      }
    };
  var oe = () => {
      let t = document.getElementsByTagName("script");
      for (let e = t.length - 1; e >= 0; e--) {
        let n = t[e].src;
        if (n?.includes("/embed/popup.js"))
          try {
            return new URL(n).origin;
          } catch {}
      }
      return window.location.origin;
    },
    ne = (t, e) => {
      let n = oe(),
        o = new URLSearchParams();
      if (
        (o.set("popup", "true"),
        o.set("originPage", window.location.pathname),
        o.set("transparent", "true"),
        o.set("transparentBackground", "false"),
        o.set("hideTitle", e.hideTitle ? "true" : "false"),
        o.set("alignLeft", e.alignLeft ? "true" : "false"),
        o.set("dynamicHeight", "false"),
        o.set("dynamicWidth", "false"),
        e.hiddenFields)
      )
        for (let [r, s] of Object.entries(e.hiddenFields)) o.set(r, s);
      return (
        new URLSearchParams(window.location.search).forEach((r, s) => {
          o.has(s) || o.set(s, r);
        }),
        `${n}/forms/${t}?${o.toString()}`
      );
    },
    x = (t, e, n) => {
      let o = document.createElement("iframe");
      ((o.className = "bf-iframe"),
        o.setAttribute("title", "Reform"),
        o.setAttribute("frameborder", "0"),
        o.setAttribute("allow", "fullscreen"),
        o.setAttribute("data-bf-form-id", t),
        (o.style.height = "400px"));
      let i = ne(t, e);
      return ((o.src = i), n.appendChild(o), o);
    };
  var M = (t, e) => {
      let n = Math.min(600, window.innerHeight - 40),
        o = Math.min(e + 2, n);
      t.style.height = `${o}px`;
    },
    P = (t) => {
      t.remove();
    };
  var ie =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Close popup</title><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var E = (t, e, n, o = {}) => {
      let i = e.layout === "modal" || e.position === "center",
        r = e.overlay !== !1 || i,
        s = e.position || "bottom-right",
        l = e.width || 376,
        a = document.createElement("div");
      ((a.className = `bf-overlay ${r ? "" : "bf-overlay--no-bg"}`),
        a.setAttribute("data-bf-form-id", t),
        o.startHidden && j(a),
        r &&
          a.addEventListener("click", (G) => {
            G.target === a && n();
          }));
      let c = document.createElement("div");
      ((c.className = `bf-popup bf-popup--${i ? "center" : s}`),
        Object.assign(c.style, { width: `${l}px`, maxHeight: "600px" }));
      let d = document.createElement("button");
      ((d.className = "bf-close-btn"),
        (d.innerHTML = ie),
        d.setAttribute("aria-label", "Close form"),
        d.addEventListener("click", n));
      let m = document.createElement("div");
      m.className = "bf-iframe-container";
      let f = document.createElement("div");
      ((f.className = "bf-loading"), (f.innerHTML = '<div class="bf-loading-spinner"></div>'));
      let u;
      return (
        e.emoji?.text &&
          ((u = document.createElement("div")),
          (u.className = `bf-emoji ${re(e.emoji.animation)}`),
          (u.textContent = e.emoji.text)),
        c.appendChild(d),
        c.appendChild(f),
        c.appendChild(m),
        u && c.appendChild(u),
        a.appendChild(c),
        r && !o.startHidden && (document.body.style.overflow = "hidden"),
        document.body.appendChild(a),
        { overlay: a, popup: c, iframeContainer: m, closeBtn: d, loadingEl: f, emojiEl: u }
      );
    },
    I = (t, e) => {
      let n = e.layout === "modal" || e.position === "center",
        o = e.overlay !== !1 || n;
      ((t.style.visibility = ""),
        (t.style.pointerEvents = ""),
        (t.style.animation = ""),
        o && (document.body.style.overflow = "hidden"));
    },
    j = (t) => {
      ((t.style.visibility = "hidden"),
        (t.style.pointerEvents = "none"),
        (t.style.animation = "none"));
    },
    A = (t) => {
      ((document.body.style.overflow = ""), j(t));
    },
    R = (t) => {
      ((document.body.style.overflow = ""),
        (t.style.opacity = "0"),
        (t.style.transition = "opacity 0.15s ease"),
        setTimeout(() => {
          t.remove();
        }, 150));
    },
    S = (t, e) => {
      let n = Math.min(600, window.innerHeight - 40),
        o = Math.min(e, n);
      ((t.style.height = `${o}px`), (t.style.maxHeight = `${o}px`));
    },
    y = (t) => {
      t.style.display = "none";
    },
    re = (t) => {
      switch (t) {
        case "wave":
          return "bf-emoji--wave";
        case "bounce":
          return "bf-emoji--bounce";
        case "pulse":
          return "bf-emoji--pulse";
        default:
          return "";
      }
    },
    _ = (t) => {
      t && (t.style.display = "none");
    };
  var se = `
/* Keyframe Animations */
@keyframes bf-wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(20deg); }
  75% { transform: rotate(-10deg); }
}

@keyframes bf-bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-20px); }
  60% { transform: translateY(-10px); }
}

@keyframes bf-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

@keyframes bf-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes bf-fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bf-slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bf-scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Overlay */
.bf-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  /* Dark overlay (Figma 27196-14471): black 24% + 6px backdrop blur. */
  background-color: rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: bf-fadeIn 0.2s ease-out;
}

.bf-overlay--no-bg {
  background-color: transparent;
  pointer-events: none;
}

/* Popup Container - Base */
.bf-popup {
  position: fixed;
  z-index: 2147483001;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: bf-slideUp 0.3s ease-out;
  pointer-events: auto;
}

/* Position Variants */
.bf-popup--bottom-right {
  bottom: 20px;
  right: 20px;
}

.bf-popup--bottom-left {
  bottom: 20px;
  left: 20px;
}

.bf-popup--center {
  position: relative;
  animation: bf-scaleIn 0.3s ease-out;
}

/* Iframe Container */
.bf-iframe-container {
  flex: 1;
  overflow: hidden;
  border-radius: 12px;
}

.bf-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* Close Button */
.bf-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, transform 0.15s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.bf-close-btn:hover {
  background-color: rgba(255, 255, 255, 1);
  transform: scale(1.05);
}

.bf-close-btn svg {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

/* Loading Indicator */
.bf-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bf-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: bf-spin 0.8s linear infinite;
}

/* Auto-mounted floating Bubble \u2014 script-tag trigger */
.bf-bubble {
  position: fixed;
  z-index: 2147483000;
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  background-color: #111827;
  color: #ffffff;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  animation: bf-fadeIn 0.2s ease-out;
}
.bf-bubble:hover { transform: scale(1.06); }
.bf-bubble--bottom-right { bottom: 20px; right: 20px; }
.bf-bubble--bottom-left { bottom: 20px; left: 20px; }
.bf-bubble--center { bottom: 20px; right: 20px; }
.bf-bubble__icon {
  width: 28px;
  height: 28px;
  display: block;
  object-fit: contain;
}
.bf-bubble__emoji { font-size: 28px; line-height: 1; }
.bf-bubble--hidden { opacity: 0; pointer-events: none; transform: scale(0.6); }

/* Emoji Bubble */
.bf-emoji {
  position: absolute;
  top: -16px;
  left: -16px;
  font-size: 32px;
  line-height: 1;
  z-index: 5;
}

.bf-emoji--wave {
  animation: bf-wave 1s ease-in-out infinite;
}

.bf-emoji--bounce {
  animation: bf-bounce 1.5s ease infinite;
}

.bf-emoji--pulse {
  animation: bf-pulse 1.5s ease-in-out infinite;
}

/* Responsive Adjustments */
@media (max-width: 640px) {
  .bf-popup--bottom-right,
  .bf-popup--bottom-left {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto !important;
  }

  .bf-popup--center {
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 40px);
  }

  .bf-emoji {
    top: -12px;
    left: -12px;
    font-size: 24px;
  }
}

/* Hide scrollbar but allow scrolling */
.bf-iframe-container::-webkit-scrollbar {
  display: none;
}

.bf-iframe-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
`,
    F = () => {
      if (document.getElementById("bf-popup-styles")) return;
      let t = document.createElement("style");
      ((t.id = "bf-popup-styles"), (t.textContent = se), document.head.appendChild(t));
    };
  var ae = (t) => {
      let e = {},
        n = t.dataset.layout;
      (n === "modal" || n === "default") && (e.layout = n);
      let o = t.dataset.position;
      (o === "bottom-right" || o === "bottom-left" || o === "center") && (e.position = o);
      let i = t.dataset.width;
      (i && (e.width = parseInt(i, 10)),
        t.dataset.alignLeft === "1" && (e.alignLeft = !0),
        t.dataset.hideTitle === "1" && (e.hideTitle = !0),
        t.dataset.overlay === "1" && (e.overlay = !0));
      let r = t.dataset.emojiText,
        s = t.dataset.emojiAnimation;
      r && (e.emoji = { text: r, animation: s || "none" });
      let l = t.dataset.autoClose;
      l && (e.autoClose = parseInt(l, 10));
      let a = {};
      for (let [c, d] of Object.entries(t.dataset))
        [
          "formId",
          "layout",
          "position",
          "width",
          "alignLeft",
          "hideTitle",
          "overlay",
          "emojiText",
          "emojiAnimation",
          "autoClose",
        ].includes(c) ||
          (d !== void 0 && (a[c] = d));
      return (Object.keys(a).length > 0 && (e.hiddenFields = a), e);
    },
    w = (t) => {
      let e = new URLSearchParams(t.replace(/^#/, "")),
        n = e.get("form-open"),
        o = {},
        i = e.get("position");
      ((i === "bottom-right" || i === "bottom-left" || i === "center") && (o.position = i),
        e.get("align-left") === "1" && (o.alignLeft = !0),
        e.get("hide-title") === "1" && (o.hideTitle = !0),
        e.get("overlay") === "1" && (o.overlay = !0));
      let r = e.get("width");
      r && (o.width = parseInt(r, 10));
      let s = e.get("emoji-text"),
        l = e.get("emoji-animation");
      s && (o.emoji = { text: s, animation: l || "none" });
      let a = e.get("auto-close");
      a && (o.autoClose = parseInt(a, 10));
      let c = {},
        d = new Set([
          "form-open",
          "position",
          "align-left",
          "hide-title",
          "overlay",
          "width",
          "emoji-text",
          "emoji-animation",
          "auto-close",
        ]);
      return (
        e.forEach((m, f) => {
          d.has(f) || (c[f] = m);
        }),
        Object.keys(c).length > 0 && (o.hiddenFields = c),
        { formId: n, options: o }
      );
    },
    B = (t) => {
      document.addEventListener("click", (e) => {
        let n = e.target,
          o = n.closest("[data-form-id]");
        if (o) {
          e.preventDefault();
          let r = o.dataset.formId;
          if (r) {
            let s = ae(o);
            t(r, s);
          }
          return;
        }
        let i = n.closest("a");
        if (i?.href?.includes("form-open=")) {
          e.preventDefault();
          let r = i.href.indexOf("#");
          if (r !== -1) {
            let s = i.href.substring(r),
              { formId: l, options: a } = w(s);
            l && t(l, a);
          }
        }
      });
    },
    N = (t) => {
      let { hash: e } = window.location;
      if (e?.includes("form-open=")) {
        let { formId: n, options: o } = w(e);
        n &&
          setTimeout(() => {
            t(n, o);
          }, 100);
      }
    },
    $ = (t) => {
      window.addEventListener("hashchange", () => {
        let { hash: e } = window.location;
        if (e?.includes("form-open=")) {
          let { formId: n, options: o } = w(e);
          n && t(n, o);
        }
      });
    };
  var p = new Map(),
    D = (t) => {
      if (t.onOpen)
        try {
          t.onOpen();
        } catch (e) {
          console.error("[Reform] onOpen callback error:", e);
        }
    },
    le = (t, e = {}) => {
      if (p.has(t)) return;
      let n = E(t, e, () => h(t), { startHidden: !0 }),
        o = x(t, e, n.iframeContainer),
        i = {
          formId: t,
          options: e,
          container: n.popup,
          iframe: o,
          overlay: n.overlay,
          loadingEl: n.loadingEl,
          hidden: !0,
        };
      (p.set(t, i),
        o.addEventListener("load", () => {
          y(n.loadingEl);
        }));
    },
    g = (t, e = {}) => {
      let n = p.get(t);
      if (n) {
        if (!n.hidden) {
          console.warn(`[Reform] Popup for form ${t} is already open`);
          return;
        }
        ((n.options = e), (n.hidden = !1), n.overlay && I(n.overlay, e), D(e));
        return;
      }
      let o = E(t, e, () => h(t)),
        i = x(t, e, o.iframeContainer),
        r = {
          formId: t,
          options: e,
          container: o.popup,
          iframe: i,
          overlay: o.overlay,
          loadingEl: o.loadingEl,
        };
      (p.set(t, r),
        i.addEventListener("load", () => {
          y(o.loadingEl);
        }),
        D(e));
    },
    h = (t) => {
      let e = p.get(t);
      if (!(!e || e.hidden) && (e.overlay && A(e.overlay), (e.hidden = !0), e.options.onClose))
        try {
          e.options.onClose();
        } catch (n) {
          console.error("[Reform] onClose callback error:", n);
        }
    },
    ce = (t) => {
      let e = p.get(t);
      e && (P(e.iframe), e.overlay && R(e.overlay), p.delete(t));
    },
    de = (t) => {
      let e;
      try {
        e = typeof t.data == "string" ? JSON.parse(t.data) : t.data;
      } catch {
        return;
      }
      if (!e?.event?.startsWith("Reform.")) return;
      let n;
      for (let o of p.values())
        if (o.iframe.contentWindow === t.source) {
          n = o;
          break;
        }
      if (n)
        switch (e.event) {
          case "Reform.FormLoaded":
            if ((n.loadingEl && y(n.loadingEl), e.frameRadius)) {
              n.container.style.borderRadius = e.frameRadius;
              let o = n.iframe.parentElement;
              o && (o.style.borderRadius = e.frameRadius);
            }
            break;
          case "Reform.Resize":
            if (typeof e.height == "number") {
              let o = Math.max(n.maxContentHeight ?? 0, e.height);
              ((n.maxContentHeight = o), M(n.iframe, o), S(n.container, o));
            }
            break;
          case "Reform.FormSubmitted":
            if (n.options.onSubmit)
              try {
                n.options.onSubmit(e.payload);
              } catch (o) {
                console.error("[Reform] onSubmit callback error:", o);
              }
            n.options.autoClose &&
              n.options.autoClose > 0 &&
              setTimeout(() => {
                h(n?.formId);
              }, n.options.autoClose);
            break;
          case "Reform.PageView":
            if (n.options.onPageView && "page" in e)
              try {
                n.options.onPageView(e.page);
              } catch (o) {
                console.error("[Reform] onPageView callback error:", o);
              }
            if ("page" in e && e.page > 1) {
              let o = n.overlay;
              if (o) {
                let i = o.querySelector(".bf-emoji");
                i && _(i);
              }
            }
            break;
          case "Reform.Close":
            h(n.formId);
            break;
        }
    },
    U = () => {
      (F(), B(g), N(g), $(g), window.addEventListener("message", de), H(g, le));
    };
  window.Reform = { openPopup: g, closePopup: h, destroyPopup: ce };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", U) : U();
})();
