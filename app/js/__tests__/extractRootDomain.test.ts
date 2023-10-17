import { extractRootDomain } from "../util";

describe("extractRootDomain", () => {
  test("extracts from 2-character TLDs", () => {
    expect(extractRootDomain("https://ssorallen.github.io/react-todos/")).toEqual("github.io");
  });

  test("extracts country code TLDs", () => {
    expect(extractRootDomain("https://www.bbc.co.uk/")).toEqual("bbc.co.uk");
  });

  test("extracts one of those shenanigans TLDs", () => {
    expect(extractRootDomain("http://www.diy.guru/")).toEqual("diy.guru");
  });
});
