/* eslint-disable no-console,@typescript-eslint/explicit-function-return-type */
/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * @todo: This script should only be run when an icon
 * changes, is added, or removed upstream: @adobe/spectrum-css-workflow-icons
 * From root: `yarn workspace @spectrum-web-components/icons-workflow build`
 */

import { writeFile } from 'fs/promises';
import { emptyDir } from 'fs-extra';
import { join } from 'path';
import chalk from 'chalk';
import { renderFile } from 'ejs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { fetchManifest, fetchPath } from './fetch.js';
import { exit } from 'process';

const rootDir = process.cwd();
const templateDir = join(rootDir, `bin/templates`);

const { iconPackage, keepColors, verbose } = yargs(hideBin(process.argv))
    .scriptName('icons')
    .usage('$0 <iconPackage> <keepColors> [args]')
    .positional('iconPackage', {
        type: 'string',
        default: '@adobe/spectrum-css-workflow-icons',
        describe: 'The package name where the icons are hosted.',
    })
    .positional('keepColors', {
        type: 'string',
        describe: '',
    })
    .options('verbose', {
        type: 'boolean',
        alias: 'v',
        default: false,
    })
    .help().argv;

/**
 * @async
 * @function processTemplate
 * @param {string} templateFilename
 * @param {string} outputFilename
 * @param {string} data
 * @return {Promise<void>}
 **/
async function processTemplate(templateFilename, outputFilename, data) {
    return renderFile(templateFilename, data, {}, (error, result) => {
        if (error) {
            console.error(error.message || error);
            return;
        }

        return writeFile(outputFilename, result, 'utf8');
    });
}

async function main() {
    // Test that the folders exist, if not, create them
    await Promise.all([
        emptyDir(join(rootDir, `icons`)),
        emptyDir(join(rootDir, `src/icons`)),
        emptyDir(join(rootDir, `src/elements`)),
    ]).catch((error) => {
        if (error) console.error(error.message || error);
    });

    const path = fetchPath(iconPackage);
    // Fetch the metadata for all icons supported by the package
    const iconList = await fetchManifest(path, keepColors);

    // Build an array of promises to resolve before the end of the script
    const promises = [
        processTemplate(
            join(templateDir, 'icon-manifest.ejs'),
            join(rootDir, 'stories/icon-manifest.ts'),
            { icons: iconList }
        ),
        processTemplate(
            join(templateDir, 'icons.ejs'),
            join(rootDir, 'src/icons.ts'),
            { icons: iconList }
        ),
    ];

    iconList.forEach((result) =>
        [
            {
                input: join(templateDir, `icon/registry.ejs`),
                output: join(rootDir, `icons/${result.tagName}.ts`),
            },
            {
                input: join(templateDir, `icon/class.ejs`),
                output: join(rootDir, `src/elements/Icon${result.id}.ts`),
            },
            {
                input: join(templateDir, `icon/svg.ejs`),
                output: join(rootDir, `src/icons/${result.id}.ts`),
            },
        ].forEach(({ input, output }) => {
            promises.push(processTemplate(input, output, result));
        })
    );

    await Promise.all(promises)
        .then(() => {
            console.group(
                `${
                    !verbose ? chalk.green(`✓ `) : ''
                }Successfully processed ${chalk.underline(
                    iconList.length
                )} icons${!verbose ? '.' : ':'}`
            );
            if (verbose) {
                iconList.forEach(({ className }) =>
                    console.log(`${chalk.green(`✓`)} ${className}`)
                );
            }
            console.groupEnd();
        })
        .catch((error) => {
            if (error) console.error(error.message || error);
            exit(1);
        });
}

await main();
