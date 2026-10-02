"use client";
import { useEffect, useRef } from "react";
import { api } from "@/services/api";
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
        },
      ) => string;
      remove: (id: string) => void;
    };
  }
}
export default function Captcha({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    let disposed = false;
    let id: string | undefined;
    let script: HTMLScriptElement | undefined;
    api<{ captchaSiteKey: string | null }>("/config")
      .then(({ captchaSiteKey }) => {
        if (!captchaSiteKey || disposed) return;
        function render() {
          if (!disposed && ref.current && window.turnstile)
            id = window.turnstile.render(ref.current, {
              sitekey: captchaSiteKey!,
              callback: (token) => callback.current(token),
              "expired-callback": () => callback.current(""),
            });
        }
        if (window.turnstile) render();
        else {
          script = document.createElement("script");
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.onload = render;
          document.head.append(script);
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (id) window.turnstile?.remove(id);
      script?.remove();
    };
  }, []);
  return <div ref={ref} />;
}
