// @ts-check
// Data-dump all the TSConfig options

/** Run with:
     node --inspect-brk ./node_modules/.bin/ts-node --project packages/tsconfig-reference/tsconfig.json packages/tsconfig-reference/scripts/generateMarkdown.ts
     yarn ts-node --project packages/tsconfig-reference/tsconfig.json packages/tsconfig-reference/scripts/generateMarkdown.ts 
*/

/**
 * This sets up:
 *
 *   - language (en, ja, zh, pt, etc)
 *     - Sections
 *       - Top Level Fields
 *       - Compiler Options
 *       - Watch Options
 *
 */

console.log("TSConfig Ref: MD for TSConfig");

import { writeFileSync, readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import * as assert from "assert";
import { read as readMarkdownFile } from "gray-matter";
import * as prettier from "prettier";
import { CompilerOptionJSON } from "./generateJSON.js";
import * as remark from "remark";
import * as remarkHTML from "remark-html";

import {
  typeAcquisitionCompilerOptNames,
  buildOptionCompilerOptNames,
  watchOptionCompilerOptNames,
  rootOptNames,
} from "../tsconfigRules";

const options = require("../../data/tsconfigOpts.json").options as CompilerOptionJSON[];
const categories = require("../../data/tsconfigCategories.json") as typeof import("../../data/tsconfigCategories.json");

const orderedCategories = [
  "Project_Files_0",
  "Basic_Options_6172",
  "Strict_Type_Checking_Options_6173",
  "Module_Resolution_Options_6174",
  "Source_Map_Options_6175",
  "Additional_Checks_6176",
  "Experimental_Options_6177",
  "Advanced_Options_6178",
  "Command_line_Options_6171",
  "Watch_Options_999",
];

// Makes sure all categories are accounted for in ^
assert.deepEqual(
  Object.keys(categories).sort(),
  orderedCategories.map((c) => c.split("_").pop()).sort()
);

// Extract out everything which doesn't live in compilerOptions
const notCompilerOptions = ["Project_Files_0", "Watch_Options_999"];
const categoriesForCompilerOpts = orderedCategories.filter((c) => !notCompilerOptions.includes(c));

const compilerOptions = options.filter(
  (o) =>
    !typeAcquisitionCompilerOptNames.includes(o.name) &&
    !watchOptionCompilerOptNames.includes(o.name) &&
    !buildOptionCompilerOptNames.includes(o.name) &&
    !rootOptNames.includes(o.name)
);

// The TSConfig Reference is a collection of sections which have options or
// a collection of categories which have options
const sections = [
  { name: "Top Level", options: rootOptNames },
  {
    name: "compilerOptions",
    categories: categoriesForCompilerOpts,
  },
  { name: "watchOptions", options: watchOptionCompilerOptNames },
  { name: "typeAcquisition", options: typeAcquisitionCompilerOptNames },
];

const parseMarkdown = (md: string) => remark().use(remarkHTML).processSync(md);

const languages = readdirSync(join(__dirname, "..", "..", "copy")).filter(
  (f) => !f.startsWith(".")
);

languages.forEach((lang) => {
  const locale = join(__dirname, "..", "..", "copy", lang);
  const fallbackLocale = join(__dirname, "..", "..", "copy", "en");

  const mdChunks: string[] = [];

  const getPathInLocale = (path: string, optionalExampleContent?: string, failable = false) => {
    if (existsSync(join(locale, path))) return join(locale, path);
    if (existsSync(join(fallbackLocale, path))) return join(fallbackLocale, path);

    const localeDesc = lang === "en" ? lang : `either ${lang} or English`;
    if (!failable)
      // prettier-ignore
      throw new Error("Could not find a path for " + path + " in " + localeDesc + " " + optionalExampleContent || "");
  };

  // Make a JSON dump of the category anchors someone wrapping the markdown
  const allCategories = [] as {
    display: string;
    anchor: string;
    options: { name: string; anchor: string }[];
  }[];

  const optionsSummary = [] as {
    display: string;
    oneliner: string;
    id: string;
    categoryID: string;
    categoryDisplay: string;
  }[];

  sections.forEach((section) => {
    const sectionCategories = section.categories || [section.name];
    // Heh, the section uses an article and the categories use a section
    mdChunks.push(
      `<div class="tsconfig raised main-content-block markdown"><article id='${section.name}'>`
    );

    // Intro to the section
    const sectionsPath = getPathInLocale(join("sections", section.name + ".md"));
    const sectionsFile = readMarkdownFile(sectionsPath);
    mdChunks.push("\n" + sectionsFile.content + "\n");

    // Show a sticky sub-nav for the categories
    if (sectionCategories.length > 1) {
      mdChunks.push(`<nav id="sticky"><ul>`);
      sectionCategories.forEach((categoryID) => {
        const categoryPath = getPathInLocale(join("categories", categoryID + ".md"));
        const categoryFile = readMarkdownFile(categoryPath);

        mdChunks.push(`<li><a href="#${categoryID}">${categoryFile.data.display}</a></li>`);
      });
      mdChunks.push("</ul></nav>");
    }

    mdChunks.push("<div>");

    sectionCategories.forEach((categoryID) => {
      // We need this to look up the category ID
      const category = Object.values(categories).find((c: any) => c.key === categoryID);
      let categoryName = categoryID;

      if (category) {
        const categoryPath = getPathInLocale(join("categories", categoryID + ".md"));
        const categoryFile = readMarkdownFile(categoryPath);

        assert.ok(categoryFile.data.display, "No display data for category: " + categoryID); // Must have a display title in the front-matter
        categoryName = categoryFile.data.display;

        mdChunks.push("<div class='category'>");

        // Let the title change it's display but keep the same ID
        const title = `<h2 id='${categoryID}' ><a href='#${categoryID}' name='${categoryID}' aria-label="Link to the section ${categoryName}" aria-labelledby='${categoryID}'>#</a>${categoryName}</h2>`;
        mdChunks.push(title);

        // Push the category copy
        mdChunks.push(categoryFile.content);
        mdChunks.push("</div>");
      }

      // Pull out their options for the section
      const optionsForCategory = section.options
        ? section.options
            .map((opt) => {
              const richOpt = options.find((o) => o.name === opt);
              // if (!richOpt) throw new Error(`Could not find an option for ${opt} in ${section.name}`);
              return richOpt;
            })
            .filter(Boolean)
        : compilerOptions.filter((o) => o.categoryCode === category.code);

      // prettier-ignore
      assert.ok(optionsForCategory, "Could not find options for " + categoryID + " in " + JSON.stringify(categories));

      const localisedOptions = [] as { name: string; anchor: string }[];

      optionsForCategory.forEach((option) => {
        const mdPath = join("options", option.name + ".md");
        const scopedMDPath = join("options", section.name, option.name + ".md");

        const fullPath = join(__dirname, "..", "..", "copy", lang, mdPath);
        const exampleOptionContent = `\n\n\n Run:\n    echo '---\\ndisplay: "${option.name}"\\noneline: "Does something"\\n---\\n${option.description?.message}\\n' > ${fullPath}\n\nThen add some docs and run: \n>  yarn workspace tsconfig-reference build\n\n`;

        const optionPath = getPathInLocale(mdPath, exampleOptionContent, true);
        const scopedOptionPath = getPathInLocale(scopedMDPath, exampleOptionContent, true);

        const optionFile = readMarkdownFile(scopedOptionPath || optionPath);

        // prettier-ignore
        assert.ok(optionFile, "Could not find an optionFile: " + option.name);

        // Must have a display title in the front-matter
        // prettier-ignore
        assert.ok(optionFile.data.display, "Could not find a 'display' for option: " + option.name + " in " + lang);
        // prettier-ignore
        assert.ok(optionFile.data.oneline, "Could not find a 'oneline' for option: " + option.name + " in " + lang);

        optionsSummary.push({
          id: option.name,
          display: optionFile.data.display,
          oneliner: optionFile.data.oneline,
          categoryID: categoryID,
          categoryDisplay: categoryName,
        });

        mdChunks.push("<section class='compiler-option'>");

        // Let the title change it's display but keep the same ID
        const titleLink = `<a aria-label="Link to the compiler option: ${option.name}" id='${option.name}' href='#${option.name}' name='${option.name}' aria-labelledby="${option.name}-config">#</a>`;
        const title = `<h3 id='${option.name}-config'>${titleLink} ${optionFile.data.display} - <code>${option.name}</code></h3>`;
        mdChunks.push(title);

        // Make a flexbox container for the table and content
        mdChunks.push("<div class='compiler-content'>");

        mdChunks.push("<div class='markdown'>");
        // Push in the content of the file
        mdChunks.push(optionFile.content);

        mdChunks.push("</div>");

        // Make a markdown table of the important metadata
        const mdTableRows = [] as [string, string][];

        if (option.deprecated) mdTableRows.push(["Status", "Deprecated"]);

        if (option.recommended) mdTableRows.push(["Recommended", "True"]);

        if (option.defaultValue) {
          const value = option.defaultValue.includes(" ")
            ? option.defaultValue
            : "`" + option.defaultValue + "`";
          mdTableRows.push(["Default", value]);
        }

        if (option.allowedValues) {
          const optionValue = option.allowedValues.join(",<br/>");
          mdTableRows.push(["Allowed", optionValue]);
        }

        if (option.related) {
          const optionValue = option.related
            .map(
              (r) =>
                `<a href='#${r}' aria-label="Jump to compiler option info for ${r}" ><code>${r}</code></a>`
            )
            .join(", ");
          mdTableRows.push(["Related", optionValue]);
        }

        if (option.internal) {
          mdTableRows.push(["Status", "internal"]);
        }

        if (option.releaseVersion) {
          const underscores = option.releaseVersion.replace(".", "-");
          const link = `/docs/handbook/release-notes/typescript-${underscores}.html`;
          mdTableRows.push([
            "Released",
            `<a aria-label="Release notes for TypeScript ${option.releaseVersion}" href="${link}">${option.releaseVersion}</a>`,
          ]);
        }

        const table =
          "<ul class='compiler-option-md'>" +
          mdTableRows
            .map((r) => `<li><span>${r[0]}:</span>${parseMarkdown(r[1])}</li>`)
            .join("\n") +
          "</ul>";

        if (!scopedOptionPath) mdChunks.push(table);

        mdChunks.push("</div></section>");

        localisedOptions.push({ anchor: option.name, name: optionFile.data.display });
      });

      allCategories.push({
        display: categoryName,
        anchor: categoryID,
        options: localisedOptions,
      });
    });

    mdChunks.push("</div>"); // Closes div class='indent'
    mdChunks.push(`</article></div>`);
  });

  // Write the Markdown and JSON
  const markdown = prettier.format(mdChunks.join("\n"), { filepath: "index.md" });
  const mdPath = join(__dirname, "..", "..", "output", lang + ".md");
  writeFileSync(mdPath, markdown);

  writeFileSync(
    join(__dirname, "..", "..", "output", lang + ".json"),
    JSON.stringify({ categories: allCategories })
  );

  // This is used by the playground
  writeFileSync(
    join(__dirname, "..", "..", "output", lang + "-summary.json"),
    JSON.stringify({ options: optionsSummary })
  );
});

writeFileSync(
  join(__dirname, "..", "..", "output", "languages.json"),
  JSON.stringify({ languages })
);

// From https://stackoverflow.com/questions/8495687/split-array-into-chunks
function chunk<T>(arr: T[], chunkSize: number): T[][] {
  const newArray = [];
  for (let i = 0, len = arr.length; i < len; i += chunkSize)
    newArray.push(arr.slice(i, i + chunkSize));
  return newArray;
}

console.log(`Wrote TSConfig files for: ${languages.join(", ")}}`);
