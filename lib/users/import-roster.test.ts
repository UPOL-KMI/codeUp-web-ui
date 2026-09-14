import { describe, expect, it } from "vitest";

import { parseRoster } from "./import-roster";

/**
 * The import's reader (AD-009). Worth its own tests because everything it gets wrong, it gets
 * wrong silently: a shifted column produces a person, not an error, and a header this file fails
 * to recognise produces an identifier named after it.
 */
describe("parseRoster", () => {
  it("reads the Czech headers a spreadsheet in this department produces", () => {
    const { rows, problems } = parseRoster(
      ["email;jméno;příjmení;titul před;titul za", "novak@upol.cz;Jan;Novák;Bc.;DiS."].join("\n"),
    );

    expect(problems).toEqual([]);
    expect(rows).toEqual([
      {
        email: "novak@upol.cz",
        firstName: "Jan",
        lastName: "Novák",
        titlesBeforeName: "Bc.",
        titlesAfterName: "DiS.",
        externalIds: {},
      },
    ]);
  });

  it("turns any column it does not recognise into an identifier named after it", () => {
    const { rows, identifierKeys } = parseRoster(
      ["email;jméno;příjmení;stag;isic", "novak@upol.cz;Jan;Novák;F230123;1234"].join("\n"),
    );

    expect(identifierKeys).toEqual(["stag", "isic"]);
    expect(rows[0]!.externalIds).toEqual({ stag: "F230123", isic: "1234" });
  });

  it("leaves an empty identifier cell out rather than storing a blank", () => {
    const { rows } = parseRoster(
      ["email;jméno;příjmení;stag", "novak@upol.cz;Jan;Novák;"].join("\n"),
    );

    expect(rows[0]!.externalIds).toEqual({});
  });

  // The reason the comma is the *last* delimiter guessed: `Ph.D., MBA` is one title, not two
  // columns, and a semicolon-delimited file is what a Czech Excel writes anyway.
  it("keeps a comma inside a quoted title", () => {
    const { rows } = parseRoster(
      ["email,firstName,lastName,titlesAfterName", 'novak@upol.cz,Jan,Novák,"Ph.D., MBA"'].join(
        "\n",
      ),
    );

    expect(rows[0]!.titlesAfterName).toBe("Ph.D., MBA");
  });

  it("prefers a tab over a semicolon, so a paste out of a spreadsheet just works", () => {
    const { rows } = parseRoster(["email\tfirstName\tlastName", "a@b.cz\tJan\tNovák"].join("\n"));

    expect(rows[0]!.email).toBe("a@b.cz");
    expect(rows[0]!.lastName).toBe("Novák");
  });

  it("refuses a table with no email column, and says so about the header", () => {
    const { rows, problems } = parseRoster(["jméno;příjmení", "Jan;Novák"].join("\n"));

    expect(rows).toEqual([]);
    expect(problems).toEqual([{ line: 1, reason: "columns" }]);
  });

  // The line numbers count the header, because that is how the reader counts them.
  it("reports a bad address, a missing name and a repeat by line", () => {
    const { rows, problems } = parseRoster(
      [
        "email;jméno;příjmení",
        "novak@upol.cz;Jan;Novák",
        "not-an-address;Petr;Svoboda",
        "dvorak@upol.cz;;Dvořák",
        "NOVAK@upol.cz;Jan;Novák",
      ].join("\n"),
    );

    expect(rows).toHaveLength(1);
    expect(problems).toEqual([
      { line: 3, reason: "email" },
      { line: 4, reason: "name" },
      { line: 5, reason: "duplicate" },
    ]);
  });

  it("reads nothing out of nothing", () => {
    expect(parseRoster("   \n\n")).toEqual({ rows: [], problems: [], identifierKeys: [] });
  });
});
