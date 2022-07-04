import path from "path";
import { Plugin } from "rollup";
import { getDevPath, getProdPath } from "../build/utils";
import { flowTemplate } from "../utils";
import { Package } from "../package";
import { FatalError } from "../errors";

import * as fs from "fs-extra";
import normalizePath from "normalize-path";

export default function flowAndNodeDevProdEntry(
  pkg: Package,
  warnings: FatalError[]
): Plugin {
  // let directorySourceFilesMustBeIn = pkg.project.experimentalFlags
  //   .newEntrypoints
  //   ? path.resolve(pkg.directory, "src")
  //   : pkg.directory;
  return {
    name: "flow-and-prod-dev-entry",
    load(id) {
      if (id === "could-not-resolve") {
        return "";
      }
      return null;
    },
    async resolveId(source, importer) {
      let resolved = await this.resolve(source, importer!, {
        skipSelf: true,
      });
      if (resolved === null) {
        if (!source.startsWith(".")) {
          warnings.push(
            new FatalError(
              `"${source}" is imported ${
                importer
                  ? `by "${normalizePath(
                      path.relative(pkg.directory, importer!)
                    )}"`
                  : ""
              } but the package is not specified in dependencies or peerDependencies`,
              pkg.name
            )
          );
          return "could-not-resolve";
        }
        throw new FatalError(
          `Could not resolve ${source} ` +
            (importer ? `from ${path.relative(pkg.directory, importer)}` : ""),
          pkg.name
        );
      }

      if (
        source.startsWith("\0") ||
        resolved.id.startsWith("\0") ||
        resolved.id.startsWith(pkg.directory)
      ) {
        return resolved;
      }
      warnings.push(
        new FatalError(
          `all relative imports in a package should only import modules inside of their package directory but ${
            importer
              ? `"${normalizePath(path.relative(pkg.directory, importer))}"`
              : "a module"
          } is importing "${source}"`,
          pkg.name
        )
      );
      return "could-not-resolve";
    },
    async generateBundle(opts, bundle) {
      for (const n in bundle) {
        const file = bundle[n];
        if (
          file.type === "asset" ||
          !(file.type === "chunk" && file.isEntry) ||
          file.facadeModuleId == null
        ) {
          continue;
        }

        let mainFieldPath = file.fileName.replace(/\.prod\.js$/, ".js");
        let relativeToSource = path.relative(
          path.dirname(path.join(opts.dir!, file.fileName)),
          file.facadeModuleId
        );

        let isEntrySourceTypeScript = /\.tsx?$/.test(file.facadeModuleId);

        if (!isEntrySourceTypeScript) {
          let flowMode: false | "all" | "named" = false;
          let source = await fs.readFile(file.facadeModuleId, "utf8");
          if (source.includes("@flow")) {
            flowMode = file.exports.includes("default") ? "all" : "named";
          }

          if (flowMode !== false) {
            let flowFileSource = flowTemplate(
              flowMode === "all",
              normalizePath(relativeToSource)
            );
            let flowFileName = mainFieldPath + ".flow";
            this.emitFile({
              type: "asset",
              fileName: flowFileName,
              source: flowFileSource,
            });
          }
        }

        let mainEntrySource = `'use strict';

if (${
          // tricking static analysis is fun...
          "process" + ".env.NODE_ENV"
        } === "production") {
  module.exports = require("./${path.basename(getProdPath(mainFieldPath))}");
} else {
  module.exports = require("./${path.basename(getDevPath(mainFieldPath))}");
}\n`;
        this.emitFile({
          type: "asset",
          fileName: mainFieldPath,
          source: mainEntrySource,
        });
      }
    },
  };
}
