/**
 * Which submitted files are worth rendering as text, and which are only worth offering.
 *
 * **There is no MIME type to switch on.** core-api's file listing carries a name, a size and
 * nothing else (`SolutionFilesViewFactory`), and neither does the entry list inside a submitted
 * archive -- so the only thing available before fetching a file's bytes is its name. The operator
 * asked whether this could be done wholesale instead of by enumeration; this is the closest
 * honest answer.
 *
 * **The list names binaries, not text.** Source files have endless extensions -- a new language,
 * a config format, a bare `Makefile` -- and a list of *readable* types would quietly refuse to
 * show a `.zig` file the day somebody submits one. A list of unreadable ones is finite and grows
 * slowly: documents, archives, images, media, compiled artefacts, fonts, databases.
 *
 * **It is not the only guard.** A binary type nobody listed is still fetched, and caught at that
 * point by core-api's own `malformedCharacters` -- the file is then offered rather than shown as
 * mojibake. This list exists to avoid *downloading* a 40 MB video to discover that; correctness
 * does not rest on it being complete.
 */
const BINARY_EXTENSIONS = new Set([
  // Documents and presentations -- what a data-only assignment actually collects.
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "xls",
  "xlsx",
  "ods",
  "ppt",
  "pptx",
  "odp",
  "pages",
  "numbers",
  "key",
  "epub",
  "djvu",
  // Archives. A submitted `.zip` is expanded by core-api and never reaches here as one file, but
  // the others are not, and a `.zip` nested inside one is.
  "zip",
  "gz",
  "bz2",
  "xz",
  "zst",
  "7z",
  "rar",
  "tar",
  "tgz",
  "jar",
  "war",
  // Images.
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "ico",
  "webp",
  "avif",
  "heic",
  "psd",
  // Audio and video.
  "mp3",
  "wav",
  "flac",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "mp4",
  "m4v",
  "mov",
  "avi",
  "mkv",
  "webm",
  "wmv",
  // Compiled and packaged artefacts.
  "exe",
  "dll",
  "so",
  "dylib",
  "o",
  "obj",
  "a",
  "lib",
  "class",
  "pyc",
  "pyo",
  "wasm",
  "bin",
  "img",
  "iso",
  "dmg",
  "deb",
  "rpm",
  "msi",
  "apk",
  // Fonts and databases.
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  "sqlite",
  "sqlite3",
  "db",
  "mdb",
  "accdb",
]);

/**
 * The extension of a file name, lowercased and without the dot; `null` where there is none.
 *
 * A leading dot does not start an extension -- `.gitignore` is a whole name, and treating `gitignore`
 * as its type would be the same mistake as calling `Makefile` extensionless-and-therefore-suspect.
 */
export function fileExtension(name: string): string | null {
  const base = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

/** Whether this name is one of the types above -- offered for download rather than rendered. */
export function isBinaryFilename(name: string): boolean {
  const extension = fileExtension(name);
  return extension !== null && BINARY_EXTENSIONS.has(extension);
}
