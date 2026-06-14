import { parseJSONC } from "../../../src/internal/core";
import { describe, test, expect } from "../../util/testFramework";

// Note that the parser is based on the package strip-json-comments. Tests are here for sanity.

describe("JSONC parser works", () => {
  test("Parse plain JSON", () => {
    expect(parseJSONC("{}")).toEqual({});
    expect(parseJSONC('{"name": "test"}')).toEqual({ name: "test" });
    expect(parseJSONC('{"name": "test", "version": "1.0.0"}')).toEqual({
      name: "test",
      version: "1.0.0",
    });
    expect(parseJSONC('{"number":42}')).toEqual({ number: 42 });
    expect(parseJSONC('{"number" : 42}')).toEqual({ number: 42 });
    expect(parseJSONC('{"number":  42  }')).toEqual({ number: 42 });
    expect(parseJSONC('{"boolean":true}')).toEqual({ boolean: true });
    expect(parseJSONC('{"boolean": false}')).toEqual({ boolean: false });
    expect(parseJSONC('{"null":null}')).toEqual({ null: null });
    expect(parseJSONC('{"null" : \nnull }')).toEqual({ null: null });
    expect(parseJSONC('{"array":[]}')).toEqual({ array: [] });
    expect(parseJSONC('{"array": [1,2,3]}')).toEqual({ array: [1, 2, 3] });
    expect(parseJSONC('{"array" : [ "a" , "b" , "c" ] }')).toEqual({
      array: ["a", "b", "c"],
    });
    expect(parseJSONC('{"nested":{"key":"value"}}')).toEqual({
      nested: { key: "value" },
    });
    expect(parseJSONC('{"nested" : { "key" : "value" } }')).toEqual({
      nested: { key: "value" },
    });
    expect(
      parseJSONC('{"mixed":[1,"string",\ntrue,false,null,{"obj":42},[1,2]]}'),
    ).toEqual({
      mixed: [1, "string", true, false, null, { obj: 42 }, [1, 2]],
    });
    expect(
      parseJSONC(
        '{"mixed" : [ 1 , "string" , true ,\nfalse , null , { "obj" : 42 } , [ 1 , 2 ] ] }',
      ),
    ).toEqual({
      mixed: [1, "string", true, false, null, { obj: 42 }, [1, 2]],
    });
    expect(parseJSONC('{"numbers":[0,-1,3.14,-2.5,1e10]}')).toEqual({
      numbers: [0, -1, 3.14, -2.5, 1e10],
    });
    expect(parseJSONC('{"emptyString":""}')).toEqual({ emptyString: "" });
    expect(parseJSONC('{"emptyArray":[],"emptyObject":{}}')).toEqual({
      emptyArray: [],
      emptyObject: {},
    });
  });

  test("Parse JSONC with comments", () => {
    expect(parseJSONC('{"name": "test" // comment\n}')).toEqual({
      name: "test",
    });
    expect(parseJSONC('{"name": "test" }/* comment */')).toEqual({
      name: "test",
    });
    expect(
      parseJSONC('{"name": "test", // comment\n"version": "1.0.0"}'),
    ).toEqual({ name: "test", version: "1.0.0" });
    expect(
      parseJSONC('{"name": "test", /* comment */\n"version": "1.0.0"}'),
    ).toEqual({ name: "test", version: "1.0.0" });
    expect(
      parseJSONC('{"name": "test", // comment\n"version": "1.0.0" }// comment'),
    ).toEqual({ name: "test", version: "1.0.0" });
    expect(
      parseJSONC(
        '{"name": "test", /* comment */\n"version": "1.0.0" }/* comment */',
      ),
    ).toEqual({ name: "test", version: "1.0.0" });
    expect(
      parseJSONC(
        '{"name": "test", /* comment */\n"version": "1.0.0" }/* comment */',
      ),
    ).toEqual({ name: "test", version: "1.0.0" });
    expect(
      parseJSONC(
        '{"name": "test", /* comment */\n"version": "1.0.0" /* comment */}',
      ),
    ).toEqual({ name: "test", version: "1.0.0" });
  });
});
