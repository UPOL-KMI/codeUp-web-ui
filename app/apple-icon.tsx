import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The favicon's tile, rendered to the PNG iOS insists on. Same shapes as `icon.svg` and
// `components/brand/inf-logo.tsx`; the colours are the brand blue and its tint, written out because
// nothing here can read a CSS token.
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#016bab",
      }}
    >
      <svg viewBox="72 139 145 148" width="126" height="129">
        <path
          fill="#ffffff"
          d="M206.53,197.18c4.42,0,8-3.58,8-8v-12.87h-31.99c-.09,0-.19.01-.28.02h-18.25c-4.42,0-8,3.58-8,8v44.7l27.1,55.28v-46.32h23.42c4.42,0,8-3.58,8-8v-12.87h-31.42v-19.94h23.42Z"
        />
        <path
          fill="#ffffff"
          d="M103.07,176.34h-27.1v99.93c0,4.42,3.58,8,8,8h11.1c4.42,0,8-3.58,8-8v-99.93Z"
        />
        <circle fill="#bfe1f6" cx="89.52" cy="155.96" r="15.46" />
        <path
          fill="#bfe1f6"
          d="M103.07,176.34h22.12c3.05,0,5.84,1.73,7.19,4.47l50.74,103.5h-22.12c-3.05,0-5.84-1.74-7.19-4.48l-50.74-103.49Z"
        />
      </svg>
    </div>,
    size,
  );
}
