import { describe, expect, it } from "vitest";

import { fileLinkUrl, replaceLinkKeys } from "./file-links";

describe("file link substitution", () => {
  const links = {
    fig1: fileLinkUrl("http://recodex.local/api/v1", "abc"),
    data: fileLinkUrl("http://recodex.local/api/v1/", "def"),
  };

  it("builds the public address core-api resolves a link at", () => {
    expect(links.fig1).toBe("http://recodex.local/api/v1/uploaded-files/link/abc");
    // A trailing slash on the configured base does not become a double slash.
    expect(links.data).toBe("http://recodex.local/api/v1/uploaded-files/link/def");
  });

  it("replaces every occurrence, including inside a link target", () => {
    const text = "See ![figure](%%fig1%%) and [again](%%fig1%%), plus %%data%%.";
    expect(replaceLinkKeys(text, links)).toBe(
      "See ![figure](http://recodex.local/api/v1/uploaded-files/link/abc) and " +
        "[again](http://recodex.local/api/v1/uploaded-files/link/abc), plus " +
        "http://recodex.local/api/v1/uploaded-files/link/def.",
    );
  });

  it("leaves a placeholder with no link as it is, so a broken reference stays visible", () => {
    expect(replaceLinkKeys("before %%missing%% after", links)).toBe("before %%missing%% after");
  });

  it("does nothing to a text with no placeholders, or with no links defined", () => {
    expect(replaceLinkKeys("plain text", links)).toBe("plain text");
    expect(replaceLinkKeys("%%fig1%%", {})).toBe("%%fig1%%");
    expect(replaceLinkKeys("", links)).toBe("");
  });
});
