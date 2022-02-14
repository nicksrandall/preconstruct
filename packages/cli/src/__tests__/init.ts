import fixturez from "fixturez";
import path from "path";
import init from "../init";
import { confirms as _confirms, errors } from "../messages";
import {
  logMock,
  modifyPkg,
  getPkg,
  js,
  testdir,
  getFiles,
} from "../../test-utils";

const f = fixturez(__dirname);

jest.mock("../prompt");

let confirms = _confirms as jest.Mocked<typeof _confirms>;

afterEach(() => {
  jest.resetAllMocks();
});

test("no entrypoint", async () => {
  let tmpPath = f.copy("no-entrypoint");
  try {
    await init(tmpPath);
  } catch (error) {
    expect(error.message).toBe(errors.noSource("src/index"));
  }
});

test("do not allow write", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));

  try {
    await init(tmpPath);
  } catch (error) {
    expect(error.message).toBe(errors.deniedWriteMainField);
  }
  expect(confirms.writeMainField).toBeCalledTimes(1);
});

test("set only main field", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(false));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);
  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "name": "basic-package",
      "version": "1.0.0",
      "main": "dist/basic-package.cjs.js",
      "license": "MIT",
      "private": true,
    }
  `);
});

test("set main and module field", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "name": "basic-package",
      "version": "1.0.0",
      "main": "dist/basic-package.cjs.js",
      "module": "dist/basic-package.esm.js",
      "license": "MIT",
      "private": true,
    }
  `);
});

test("scoped package", async () => {
  let tmpPath = await testdir({
    "package.json": JSON.stringify({
      name: "@some-scope/some-package",
      version: "1.0.0",
      main: "index.js",
      license: "MIT",
      private: true,
    }),

    "src/index.js": js`
                      // @flow

                      export default "something";
                    `,
  });

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);
  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "name": "@some-scope/some-package",
      "version": "1.0.0",
      "main": "dist/some-scope-some-package.cjs.js",
      "module": "dist/some-scope-some-package.esm.js",
      "license": "MIT",
      "private": true,
    }
  `);
});

test("monorepo", async () => {
  let tmpPath = f.copy("monorepo");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(2);
  expect(confirms.writeModuleField).toBeCalledTimes(2);

  let pkg1 = await getPkg(path.join(tmpPath, "packages", "package-one"));
  let pkg2 = await getPkg(path.join(tmpPath, "packages", "package-two"));

  expect(Object.keys(pkg1)).toMatchInlineSnapshot(`
    Array [
      "name",
      "version",
      "main",
      "module",
      "license",
      "private",
    ]
  `);

  expect(pkg1).toMatchInlineSnapshot(`
    Object {
      "name": "@some-scope/package-one",
      "version": "1.0.0",
      "main": "dist/some-scope-package-one.cjs.js",
      "module": "dist/some-scope-package-one.esm.js",
      "license": "MIT",
      "private": true,
    }
  `);

  expect(pkg2).toMatchInlineSnapshot(`
    Object {
      "name": "@some-scope/package-two",
      "version": "1.0.0",
      "main": "dist/some-scope-package-two.cjs.js",
      "module": "dist/some-scope-package-two.esm.js",
      "license": "MIT",
      "private": true,
    }
  `);
});

test("does not prompt or modify if already valid", async () => {
  let tmpPath = f.copy("valid-package");
  let original = await getPkg(tmpPath);

  await init(tmpPath);
  let current = await getPkg(tmpPath);
  expect(original).toEqual(current);
  expect(logMock.log.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        "🎁 info valid-package main field is valid",
      ],
      Array [
        "🎁 info valid-package module field is valid",
      ],
      Array [
        "🎁 success initialised project!",
      ],
    ]
  `);
});

test("invalid fields", async () => {
  let tmpPath = f.copy("invalid-fields");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);

  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "name": "invalid-fields",
      "version": "1.0.0",
      "main": "dist/invalid-fields.cjs.js",
      "license": "MIT",
      "private": true,
      "module": "dist/invalid-fields.esm.js",
    }
  `);
});

test("fix browser", async () => {
  let tmpPath = f.copy("valid-package");

  confirms.fixBrowserField.mockReturnValue(Promise.resolve(true));

  await modifyPkg(tmpPath, (pkg) => {
    pkg.browser = "invalid.js";
  });

  await init(tmpPath);

  expect(await getPkg(tmpPath)).toMatchInlineSnapshot(`
    Object {
      "name": "valid-package",
      "version": "1.0.0",
      "main": "dist/valid-package.cjs.js",
      "license": "MIT",
      "private": true,
      "module": "dist/valid-package.esm.js",
      "umd:main": "dist/valid-package.umd.min.js",
      "preconstruct": Object {
        "umdName": "validPackage",
      },
      "browser": Object {
        "./dist/valid-package.cjs.js": "./dist/valid-package.browser.cjs.js",
        "./dist/valid-package.esm.js": "./dist/valid-package.browser.esm.js",
      },
    }
  `);
});

let basicThreeEntrypoints = {
  "package.json": JSON.stringify({
    name: "something",
    preconstruct: {
      entrypoints: ["index.js", "one.js", "two.js"],
    },
  }),
  "src/index.js": js`
                    export let something = true;
                  `,
  "src/one.js": js`
                  export let something = true;
                `,
  "src/two.js": js`
                  export let something = true;
                `,
  "one/package.json": JSON.stringify({}),
  "two/package.json": JSON.stringify({}),
};

test("three entrypoints, no main, only add main", async () => {
  const dir = await testdir(basicThreeEntrypoints);
  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(false));

  await init(dir);

  expect(await getFiles(dir, ["**/package.json"])).toMatchInlineSnapshot(`
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ one/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-one.cjs.js"
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "name": "something",
      "preconstruct": {
        "entrypoints": [
          "index.js",
          "one.js",
          "two.js"
        ]
      },
      "main": "dist/something.cjs.js"
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ two/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-two.cjs.js"
    }

  `);
});

test("three entrypoints, no main, add main and module", async () => {
  const dir = await testdir(basicThreeEntrypoints);

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(dir);

  expect(await getFiles(dir, ["**/package.json"])).toMatchInlineSnapshot(`
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ one/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-one.cjs.js",
      "module": "dist/something-one.esm.js"
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "name": "something",
      "preconstruct": {
        "entrypoints": [
          "index.js",
          "one.js",
          "two.js"
        ]
      },
      "main": "dist/something.cjs.js",
      "module": "dist/something.esm.js"
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ two/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-two.cjs.js",
      "module": "dist/something-two.esm.js"
    }

  `);
});

test("three entrypoints, no main, add main and fix browser", async () => {
  const dir = await testdir({
    ...basicThreeEntrypoints,
    "package.json": JSON.stringify({
      ...JSON.parse(basicThreeEntrypoints["package.json"]),
      browser: "",
    }),
  });
  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(false));
  confirms.fixBrowserField.mockReturnValue(Promise.resolve(true));

  await init(dir);

  expect(await getFiles(dir, ["**/package.json"])).toMatchInlineSnapshot(`
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ one/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-one.cjs.js",
      "browser": {
        "./dist/something-one.cjs.js": "./dist/something-one.browser.cjs.js"
      }
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "name": "something",
      "preconstruct": {
        "entrypoints": [
          "index.js",
          "one.js",
          "two.js"
        ]
      },
      "browser": {
        "./dist/something.cjs.js": "./dist/something.browser.cjs.js"
      },
      "main": "dist/something.cjs.js"
    }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ two/package.json ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    {
      "main": "dist/something-two.cjs.js",
      "browser": {
        "./dist/something-two.cjs.js": "./dist/something-two.browser.cjs.js"
      }
    }

  `);
});
