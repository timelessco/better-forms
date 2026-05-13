"use strict";
(() => {
  var L = (e, t, n) => {
      if (document.head.querySelector(`link[rel="${e}"][href="${t}"]`)) return;
      let i = document.createElement("link");
      ((i.rel = e),
        (i.href = t),
        n !== void 0 && (i.crossOrigin = n),
        document.head.appendChild(i));
    },
    T = (e) => {
      e !== window.location.origin && (L("preconnect", e, "anonymous"), L("dns-prefetch", e));
    },
    C = (e, t) => {
      let n = !1,
        o = () => {
          n || ((n = !0), t());
        },
        i = { once: !0, passive: !0 };
      (e.addEventListener("pointerenter", o, i),
        e.addEventListener("focus", o, i),
        e.addEventListener("touchstart", o, i));
    };
  var G = /^[a-zA-Z0-9_-]{1,128}$/,
    V = new Set([
      "formId",
      "position",
      "width",
      "darkOverlay",
      "overlay",
      "hideTitle",
      "alignLeft",
      "autoClose",
    ]),
    W = /^(?:\p{Extended_Pictographic}\uFE0F?){1,3}$/u,
    Y = () => {
      let e = document.getElementsByTagName("script");
      for (let t = e.length - 1; t >= 0; t--)
        if ((e[t].src || "").includes("/embed/popup.js")) return e[t];
      return null;
    },
    X = (e) => {
      if (e?.src)
        try {
          return new URL(e.src).origin;
        } catch {}
      return window.location.origin;
    },
    K = (e) => {
      let t = e.dataset || {},
        n = t.formId && G.test(t.formId) ? t.formId : "";
      if (!n) return null;
      let o = Object.create(null);
      for (let [s, a] of Object.entries(t)) !V.has(s) && typeof a == "string" && (o[s] = a);
      let i = t.position;
      return {
        formId: n,
        position: i === "bottom-left" || i === "center" ? i : "bottom-right",
        width: t.width ? parseInt(t.width, 10) : 376,
        darkOverlay: t.darkOverlay === "1" || t.overlay === "1",
        hideTitle: t.hideTitle === "1",
        alignLeft: t.alignLeft === "1",
        autoClose: t.autoClose ? parseInt(t.autoClose, 10) : 0,
        hiddenFields: o,
      };
    },
    q = async (e, t) => {
      try {
        let n = await fetch(`${e}/api/forms/${encodeURIComponent(t)}/meta`, {
          method: "GET",
          credentials: "omit",
        });
        return n.ok ? await n.json() : null;
      } catch {
        return null;
      }
    },
    v = "http://www.w3.org/2000/svg",
    O = () => {
      let e = document.createElementNS(v, "svg");
      (e.setAttribute("class", "bf-bubble__icon"),
        e.setAttribute("viewBox", "0 0 24 24"),
        e.setAttribute("fill", "none"),
        e.setAttribute("stroke", "currentColor"),
        e.setAttribute("stroke-width", "2"),
        e.setAttribute("stroke-linecap", "round"),
        e.setAttribute("stroke-linejoin", "round"));
      let t = document.createElementNS(v, "path");
      (t.setAttribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"),
        e.appendChild(t));
      let n = document.createElementNS(v, "polyline");
      return (n.setAttribute("points", "14 2 14 8 20 8"), e.appendChild(n), e);
    },
    b = (e, t) => {
      for (; e.firstChild; ) e.removeChild(e.firstChild);
      e.appendChild(t);
    },
    k = (e, t, n) => {
      if (n && /^(https?:\/\/|\/)/.test(n)) {
        let i = document.createElement("img");
        ((i.className = "bf-bubble__icon"), (i.src = n), (i.alt = ""), b(e, i));
        return;
      }
      if (n && W.test(n)) {
        let i = document.createElement("span");
        ((i.className = "bf-bubble__emoji"), (i.textContent = n), b(e, i));
        return;
      }
      if (!(n && /^[a-z0-9-]+$/i.test(n))) {
        b(e, O());
        return;
      }
      (b(e, O()),
        fetch(`${t}/api/icons/${n}`)
          .then((i) => (i.ok ? i.text() : null))
          .then((i) => {
            if (!i) return;
            let s = new DOMParser().parseFromString(i, "image/svg+xml").documentElement;
            !s ||
              s.tagName.toLowerCase() !== "svg" ||
              (s.setAttribute("class", "bf-bubble__icon"), b(e, document.importNode(s, !0)));
          })
          .catch(() => {}));
    },
    J = (e, t, n) => {
      let o = document.createElement("button");
      return (
        (o.type = "button"),
        (o.className = `bf-bubble bf-bubble--${e.position}`),
        o.setAttribute("aria-label", t?.title || "Open form"),
        k(o, n, t?.icon),
        document.body.appendChild(o),
        o
      );
    },
    H = (e, t) => {
      let n = Y();
      if (!n) return;
      let o = K(n);
      if (!o) return;
      let i = X(n);
      T(i);
      let r = J(o, null, i),
        s = {
          position: o.position,
          width: o.width,
          hideTitle: o.hideTitle,
          alignLeft: o.alignLeft,
          overlay: o.darkOverlay,
          autoClose: o.autoClose,
          hiddenFields: o.hiddenFields,
        };
      (C(r, () => t(o.formId, s)),
        q(i, o.formId).then((a) => {
          a && (a.title && r.setAttribute("aria-label", a.title), a.icon && k(r, i, a.icon));
        }),
        r.addEventListener("click", () => {
          (r.classList.add("bf-bubble--hidden"),
            e(o.formId, {
              position: o.position,
              width: o.width,
              hideTitle: o.hideTitle,
              alignLeft: o.alignLeft,
              overlay: o.darkOverlay,
              autoClose: o.autoClose,
              hiddenFields: o.hiddenFields,
              onClose: () => {
                r.classList.remove("bf-bubble--hidden");
              },
            }));
        }));
    };
  var Z = () => {
      let e = document.getElementsByTagName("script");
      for (let t = e.length - 1; t >= 0; t--) {
        let n = e[t].src;
        if (n?.includes("/embed/popup.js"))
          try {
            return new URL(n).origin;
          } catch {}
      }
      return window.location.origin;
    },
    Q = (e, t) => {
      let n = Z(),
        o = new URLSearchParams();
      if (
        (o.set("popup", "true"),
        o.set("originPage", window.location.pathname),
        o.set("transparent", "true"),
        o.set("transparentBackground", "false"),
        o.set("hideTitle", t.hideTitle ? "true" : "false"),
        o.set("alignLeft", t.alignLeft ? "true" : "false"),
        o.set("dynamicHeight", "false"),
        o.set("dynamicWidth", "false"),
        t.hiddenFields)
      )
        for (let [r, s] of Object.entries(t.hiddenFields)) o.set(r, s);
      return (
        new URLSearchParams(window.location.search).forEach((r, s) => {
          o.has(s) || o.set(s, r);
        }),
        `${n}/forms/${e}?${o.toString()}`
      );
    },
    x = (e, t, n) => {
      let o = document.createElement("iframe");
      ((o.className = "bf-iframe"),
        o.setAttribute("title", "Reform"),
        o.setAttribute("frameborder", "0"),
        o.setAttribute("allow", "fullscreen"),
        o.setAttribute("data-bf-form-id", e),
        (o.style.height = "400px"));
      let i = Q(e, t);
      return ((o.src = i), n.appendChild(o), o);
    };
  var I = (e, t) => {
      let n = Math.min(600, window.innerHeight - 40),
        o = Math.min(t + 2, n);
      e.style.height = `${o}px`;
    },
    M = (e) => {
      e.remove();
    };
  var ee =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Close popup</title><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var E = (e, t, n, o = {}) => {
      let i = t.layout === "modal" || t.position === "center",
        r = t.overlay !== !1 || i,
        s = t.position || "bottom-right",
        a = t.width || 376,
        l = document.createElement("div");
      ((l.className = `bf-overlay ${r ? "" : "bf-overlay--no-bg"}`),
        l.setAttribute("data-bf-form-id", e),
        o.startHidden && j(l),
        r &&
          l.addEventListener("click", (z) => {
            z.target === l && n();
          }));
      let c = document.createElement("div");
      ((c.className = `bf-popup bf-popup--${i ? "center" : s}`),
        Object.assign(c.style, { width: `${a}px`, maxHeight: "600px" }));
      let d = document.createElement("button");
      ((d.className = "bf-close-btn"),
        (d.innerHTML = ee),
        d.setAttribute("aria-label", "Close form"),
        d.addEventListener("click", n));
      let m = document.createElement("div");
      m.className = "bf-iframe-container";
      let f = document.createElement("div");
      ((f.className = "bf-loading"), (f.innerHTML = '<div class="bf-loading-spinner"></div>'));
      let u;
      return (
        t.emoji?.text &&
          ((u = document.createElement("div")),
          (u.className = `bf-emoji ${te(t.emoji.animation)}`),
          (u.textContent = t.emoji.text)),
        c.appendChild(d),
        c.appendChild(f),
        c.appendChild(m),
        u && c.appendChild(u),
        l.appendChild(c),
        r && !o.startHidden && (document.body.style.overflow = "hidden"),
        document.body.appendChild(l),
        { overlay: l, popup: c, iframeContainer: m, closeBtn: d, loadingEl: f, emojiEl: u }
      );
    },
    P = (e, t) => {
      let n = t.layout === "modal" || t.position === "center",
        o = t.overlay !== !1 || n;
      ((e.style.visibility = ""),
        (e.style.pointerEvents = ""),
        (e.style.animation = ""),
        o && (document.body.style.overflow = "hidden"));
    },
    j = (e) => {
      ((e.style.visibility = "hidden"),
        (e.style.pointerEvents = "none"),
        (e.style.animation = "none"));
    },
    A = (e) => {
      ((document.body.style.overflow = ""), j(e));
    },
    F = (e) => {
      ((document.body.style.overflow = ""),
        (e.style.opacity = "0"),
        (e.style.transition = "opacity 0.15s ease"),
        setTimeout(() => {
          e.remove();
        }, 150));
    },
    _ = (e, t) => {
      let n = Math.min(600, window.innerHeight - 40),
        o = Math.min(t, n);
      ((e.style.height = `${o}px`), (e.style.maxHeight = `${o}px`));
    },
    y = (e) => {
      e.style.display = "none";
    },
    te = (e) => {
      switch (e) {
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
    R = (e) => {
      e && (e.style.display = "none");
    };
  var oe = `
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
  background-color: rgba(0, 0, 0, 0.5);
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
    S = () => {
      if (document.getElementById("bf-popup-styles")) return;
      let e = document.createElement("style");
      ((e.id = "bf-popup-styles"), (e.textContent = oe), document.head.appendChild(e));
    };
  var ne = (e) => {
      let t = {},
        n = e.dataset.layout;
      (n === "modal" || n === "default") && (t.layout = n);
      let o = e.dataset.position;
      (o === "bottom-right" || o === "bottom-left" || o === "center") && (t.position = o);
      let i = e.dataset.width;
      (i && (t.width = parseInt(i, 10)),
        e.dataset.alignLeft === "1" && (t.alignLeft = !0),
        e.dataset.hideTitle === "1" && (t.hideTitle = !0),
        e.dataset.overlay === "1" && (t.overlay = !0));
      let r = e.dataset.emojiText,
        s = e.dataset.emojiAnimation;
      r && (t.emoji = { text: r, animation: s || "none" });
      let a = e.dataset.autoClose;
      a && (t.autoClose = parseInt(a, 10));
      let l = {};
      for (let [c, d] of Object.entries(e.dataset))
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
          (d !== void 0 && (l[c] = d));
      return (Object.keys(l).length > 0 && (t.hiddenFields = l), t);
    },
    w = (e) => {
      let t = new URLSearchParams(e.replace(/^#/, "")),
        n = t.get("form-open"),
        o = {},
        i = t.get("position");
      ((i === "bottom-right" || i === "bottom-left" || i === "center") && (o.position = i),
        t.get("align-left") === "1" && (o.alignLeft = !0),
        t.get("hide-title") === "1" && (o.hideTitle = !0),
        t.get("overlay") === "1" && (o.overlay = !0));
      let r = t.get("width");
      r && (o.width = parseInt(r, 10));
      let s = t.get("emoji-text"),
        a = t.get("emoji-animation");
      s && (o.emoji = { text: s, animation: a || "none" });
      let l = t.get("auto-close");
      l && (o.autoClose = parseInt(l, 10));
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
        t.forEach((m, f) => {
          d.has(f) || (c[f] = m);
        }),
        Object.keys(c).length > 0 && (o.hiddenFields = c),
        { formId: n, options: o }
      );
    },
    N = (e) => {
      document.addEventListener("click", (t) => {
        let n = t.target,
          o = n.closest("[data-form-id]");
        if (o) {
          t.preventDefault();
          let r = o.dataset.formId;
          if (r) {
            let s = ne(o);
            e(r, s);
          }
          return;
        }
        let i = n.closest("a");
        if (i?.href?.includes("form-open=")) {
          t.preventDefault();
          let r = i.href.indexOf("#");
          if (r !== -1) {
            let s = i.href.substring(r),
              { formId: a, options: l } = w(s);
            a && e(a, l);
          }
        }
      });
    },
    B = (e) => {
      let { hash: t } = window.location;
      if (t?.includes("form-open=")) {
        let { formId: n, options: o } = w(t);
        n &&
          setTimeout(() => {
            e(n, o);
          }, 100);
      }
    },
    $ = (e) => {
      window.addEventListener("hashchange", () => {
        let { hash: t } = window.location;
        if (t?.includes("form-open=")) {
          let { formId: n, options: o } = w(t);
          n && e(n, o);
        }
      });
    };
  var p = new Map(),
    U = (e) => {
      if (e.onOpen)
        try {
          e.onOpen();
        } catch (t) {
          console.error("[Reform] onOpen callback error:", t);
        }
    },
    ie = (e, t = {}) => {
      if (p.has(e)) return;
      let n = E(e, t, () => g(e), { startHidden: !0 }),
        o = x(e, t, n.iframeContainer),
        i = {
          formId: e,
          options: t,
          container: n.popup,
          iframe: o,
          overlay: n.overlay,
          loadingEl: n.loadingEl,
          hidden: !0,
        };
      (p.set(e, i),
        o.addEventListener("load", () => {
          y(n.loadingEl);
        }));
    },
    h = (e, t = {}) => {
      let n = p.get(e);
      if (n) {
        if (!n.hidden) {
          console.warn(`[Reform] Popup for form ${e} is already open`);
          return;
        }
        ((n.options = t), (n.hidden = !1), n.overlay && P(n.overlay, t), U(t));
        return;
      }
      let o = E(e, t, () => g(e)),
        i = x(e, t, o.iframeContainer),
        r = {
          formId: e,
          options: t,
          container: o.popup,
          iframe: i,
          overlay: o.overlay,
          loadingEl: o.loadingEl,
        };
      (p.set(e, r),
        i.addEventListener("load", () => {
          y(o.loadingEl);
        }),
        U(t));
    },
    g = (e) => {
      let t = p.get(e);
      if (!(!t || t.hidden) && (t.overlay && A(t.overlay), (t.hidden = !0), t.options.onClose))
        try {
          t.options.onClose();
        } catch (n) {
          console.error("[Reform] onClose callback error:", n);
        }
    },
    re = (e) => {
      let t = p.get(e);
      t && (M(t.iframe), t.overlay && F(t.overlay), p.delete(e));
    },
    se = (e) => {
      let t;
      try {
        t = typeof e.data == "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!t?.event?.startsWith("Reform.")) return;
      let n;
      for (let o of p.values())
        if (o.iframe.contentWindow === e.source) {
          n = o;
          break;
        }
      if (n)
        switch (t.event) {
          case "Reform.FormLoaded":
            n.loadingEl && y(n.loadingEl);
            break;
          case "Reform.Resize":
            typeof t.height == "number" && (I(n.iframe, t.height), _(n.container, t.height));
            break;
          case "Reform.FormSubmitted":
            if (n.options.onSubmit)
              try {
                n.options.onSubmit(t.payload);
              } catch (o) {
                console.error("[Reform] onSubmit callback error:", o);
              }
            n.options.autoClose &&
              n.options.autoClose > 0 &&
              setTimeout(() => {
                g(n?.formId);
              }, n.options.autoClose);
            break;
          case "Reform.PageView":
            if (n.options.onPageView && "page" in t)
              try {
                n.options.onPageView(t.page);
              } catch (o) {
                console.error("[Reform] onPageView callback error:", o);
              }
            if ("page" in t && t.page > 1) {
              let o = n.overlay;
              if (o) {
                let i = o.querySelector(".bf-emoji");
                i && R(i);
              }
            }
            break;
          case "Reform.Close":
            g(n.formId);
            break;
        }
    },
    D = () => {
      (S(), N(h), B(h), $(h), window.addEventListener("message", se), H(h, ie));
    };
  window.Reform = { openPopup: h, closePopup: g, destroyPopup: re };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", D) : D();
})();
