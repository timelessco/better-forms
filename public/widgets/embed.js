"use strict";
(() => {
  var o = () => {
      let t = document.querySelectorAll("iframe[data-reform-src]:not([src])");
      for (let e of t) {
        let r = e.dataset.reformSrc;
        r && (e.src = r);
      }
    },
    a = (t) => {
      let e;
      try {
        e = typeof t.data == "string" ? JSON.parse(t.data) : t.data;
      } catch {
        return;
      }
      if (e?.event !== "Reform.Resize" || typeof e.height != "number") return;
      let r = document.querySelectorAll("iframe[data-reform-src]");
      for (let n of r)
        if (n.contentWindow === t.source) {
          n.style.height = `${e.height}px`;
          return;
        }
    };
  window.Reform = { ...window.Reform, loadEmbeds: o };
  window.addEventListener("message", a);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", o) : o();
})();
