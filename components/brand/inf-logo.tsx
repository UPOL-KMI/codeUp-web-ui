/**
 * The department's "iNF" mark, traced from inf.upol.cz. The letters take the surrounding text
 * colour so the mark survives dark mode; only the dot and the diagonal keep the brand blue.
 */
export function InfLogo({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="72 139 145 148"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path
        fill="currentColor"
        d="M206.53,197.18c4.42,0,8-3.58,8-8v-12.87h-31.99c-.09,0-.19.01-.28.02h-18.25c-4.42,0-8,3.58-8,8v44.7l27.1,55.28v-46.32h23.42c4.42,0,8-3.58,8-8v-12.87h-31.42v-19.94h23.42Z"
      />
      <path
        fill="currentColor"
        d="M103.07,176.34h-27.1v99.93c0,4.42,3.58,8,8,8h11.1c4.42,0,8-3.58,8-8v-99.93Z"
      />
      <circle className="fill-primary" cx="89.52" cy="155.96" r="15.46" />
      <path
        className="fill-primary"
        d="M103.07,176.34h22.12c3.05,0,5.84,1.73,7.19,4.47l50.74,103.5h-22.12c-3.05,0-5.84-1.74-7.19-4.48l-50.74-103.49Z"
      />
    </svg>
  );
}
