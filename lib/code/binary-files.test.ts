import { describe, expect, it } from "vitest";

import { fileExtension, isBinaryFilename } from "./binary-files";

describe("fileExtension", () => {
  it("reads the extension off a plain name", () => {
    expect(fileExtension("report.PDF")).toBe("pdf");
  });

  it("has none for a file without one", () => {
    expect(fileExtension("Makefile")).toBeNull();
  });

  it("does not mistake a dotfile's name for an extension", () => {
    expect(fileExtension(".gitignore")).toBeNull();
  });

  it("has none for a name that ends in a dot", () => {
    expect(fileExtension("weird.")).toBeNull();
  });

  it("reads the last extension of several", () => {
    expect(fileExtension("archive.tar.gz")).toBe("gz");
  });

  it("looks only at the last path segment", () => {
    expect(fileExtension("src.d/main")).toBeNull();
    expect(fileExtension("solution.zip#docs/report.docx")).toBe("docx");
  });
});

describe("isBinaryFilename", () => {
  it("catches the documents a data-only assignment collects", () => {
    for (const name of ["a.pdf", "b.docx", "c.pptx", "d.xlsx", "e.odt"]) {
      expect(isBinaryFilename(name)).toBe(true);
    }
  });

  it("leaves source files alone, including ones nobody listed", () => {
    for (const name of ["main.py", "main.zig", "Makefile", ".gitignore", "notes.md", "data.csv"]) {
      expect(isBinaryFilename(name)).toBe(false);
    }
  });

  it("ignores the case of the extension", () => {
    expect(isBinaryFilename("Scan.PDF")).toBe(true);
  });

  it("judges an entry inside a submitted archive by its own name", () => {
    expect(isBinaryFilename("solution.zip#img/diagram.png")).toBe(true);
    expect(isBinaryFilename("solution.zip#src/main.c")).toBe(false);
  });
});
