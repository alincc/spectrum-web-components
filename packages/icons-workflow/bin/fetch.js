/* eslint-disable @typescript-eslint/explicit-function-return-type */
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

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { basename, join } from 'path';
import { load } from 'cheerio';
import Case from 'case';
const { kebab, pascal, sentence } = Case;

const require = createRequire(import.meta.url);

/**
 * @typedef {Object} IconData
 * @property {string} id - A usable ID created from the provided filename
 * @property {string} filename - The basename of the icon file
 * @property {string} className - Component name is a pascale version of the ID
 * @property {string} tagName - The tag name, prefixed and converted to kebab case & tidied up
 * @property {string} variableName - Variable name is a clean, variable-safe version of the component names
 * @property {string} svg - The processed svg for the icon as a string
 * @property {string} title - Human readable version of the icon name
 * @property {string} path - The full path to the original icon's location
 */

/**
 * @typedef {Object} Options
 * @param {(?'keep')} [keepColors] - Whether to keep the colors in the SVG.
 * @param {?string} [prefix] - A prefix to use for the tag name.
 * @param {Function} [cleanID] - A function to clean the ID; might include business logic.
 * @param {Function} [formatVariable]
 * @param {Function} [formatTitle]
 * @param {Function} [formatTag]
 */

/**
 * @function fetchPath - Fetch the path for the provided package name
 * @param {string} packageName
 * @returns {string} - the local file path
 */
export function fetchPath(packageName) {
    let path = require.resolve(packageName);

    /** @todo do we want to try anything else to find the right path? */
    // if (!path || !existsSync(path)) {
    //     /** @note - Try capturing the root of the project via package.json */
    //     path = require.resolve(`${packageName}/package.json`);
    // }

    if (!path || !existsSync(path)) {
        console.error(`Could not find manifest for ${packageName}.`);
        /** @note without the path, nothing else can be done so bail */
        exit(1);
    }

    return path;
}

/**
 * @async
 * @function fetchManifest - Fetches the list of icons from the provided icon path
 * by resolving the node_modules path & reading the provided
 * manifest.
 * @param {string} path - Path from which the icons are sourced.
 * @param {Options} [options={}]
 * @return {Promise<IconData>} - An array of icon metadata.
 **/
export async function fetchManifest(path, options = {}) {
    /** @const iconData - Read in the icon data */
    const iconData = await readFile(path, 'utf8').catch((error) => {
        if (error) console.error(error.message || error);
        exit(1);
    });

    /** @const icons - Parse the icon data as JSON */
    const icons = JSON.parse(iconData);

    if (!Array.isArray(icons) || icons.length === 0) {
        console.error(`No icons found at ${printPath(iconsPath)}.`);
        exit(1);
    }

    return Promise.all(
        icons.map((filename) => iconMetadata(filename, path, options))
    );
}

/**
 * @const {Object} formatters
 */
const formatters = {
    /**
     * @function tag - Formats the icon tag name.
     * @param {string} className
     * @param {string} prefix
     * @returns {string} - A valid tag name.
     */
    tag: (className, prefix) => {
        const postfix = kebab(className)
            // Captures -3-d and replaces with -3d
            .replace(/(-?[0-9])-([a-z])-/gi, '$1$2-');
        return `${prefix ?? `sp`}-icon-${postfix}`;
    },
    /**
     * @function class - Formats the class name.
     * @param {string} id - A usable ID created from the provided filename.
     * @returns {string} - A valid class name.
     */
    class: (id) => {
        return id === 'github' ? 'GitHub' : pascal(id);
    },
    /**
     * @function variable - Formats the display title.
     * @note - /^([0-9])/ - This regex finds numerical starting characters and prefixes with provided value.
     * @param {string} id - A usable ID created from the provided filename.
     * @returns {string} - A valid function name to use for import/export.
     */
    variable: (className) => {
        return `${className.replace(/^([0-9])/, '_$1')}Icon`;
    },
    /**
     * @function title - Formats the display title.
     * @note - Sentence case per guidance from content writers.
     * @param {string} id - A usable ID created from the provided filename.
     * @returns {string} - A human-readable title for the icon.
     */
    title: (id) => {
        return sentence(id).replace(/(-?[0-9])\s([a-z])\s/gi, '$1$2 ');
    },
    /**
     * @function cleanID - Cleans the icon name into a useable ID.
     * @param {string} filename - the unprocessed icon name.
     * @returns {string} - an id-friendly string.
     */
    cleanID: (filename) => {
        const iconName = basename(filename, '.svg');
        let id = iconName
            /** @todo - Need notes on this */
            .replace(/(S_|_22_N)/, '');

        /** @todo - Need notes on this */
        if (id.search(/^Ad[A-Z]/) !== -1) {
            id = id.replace(/^Ad/, '');
            id += 'Advert';
        }

        return id;
    },
};

/**
 * @async
 * @function iconMetadata - Fetches the list of icons from the provided icon path
 * by resolving the node_modules path & reading the provided
 * manifest.
 * @param {string} basename - Basename of the icon file.
 * @param {Options} [options={}]
 * @return {Promise<IconData>} - An array of icon metadata.
 **/
async function iconMetadata(basename, path, options = {}) {
    const {
        cleanID = formatters.cleanID,
        formatClass = formatters.class,
        formatTag = formatters.tag,
        formatVariable = formatters.variable,
        formatTitle = formatters.title,
    } = options;

    /** @note - This fetches the SVG content and parses it as a string */
    const svg = fetchSVG(basename, path, options);

    /** @const {IconData} metadata */
    const metadata = {};

    metadata.filename = basename;
    metadata.id = cleanID(basename);
    metadata.className = formatClass(metadata.id);
    metadata.tagName = formatTag(metadata.className, options.prefix);
    metadata.variableName = formatVariable(metadata.className);
    /** @note - Awaiting completion of the SVG string */
    metadata.svg = await svg;
    metadata.title = formatTitle(metadata.id);
    metadata.path = path;

    return metadata;
}

/**
 * @async
 * @function fetchSVG - Fetch the SVG content from the provided filename.
 * @param {string} basename
 * @param {string} path
 * @return {Promise<(?string)>}
 **/
async function fetchSVG(basename, path, { keepColors } = {}) {
    const svgPath = join(path, `..`, `/18/${basename}`);
    if (!existsSync(svgPath)) {
        console.error(`Could not find ${basename} at ${printPath(svgPath)}.`);
        return;
    }

    const content = await readFile(svgPath, 'utf-8');
    return processSVG(content, keepColors);
}

/**
 * @async
 * @function processSVG
 * @param {string} content - the stringified SVG content.
 * @param {('keep' | undefined)} keepColors
 * @return {Promise<(import('cheerio').CheerioAPI | void)>}
 **/
async function processSVG(content, keepColors) {
    // Load the SVG content into cheerio
    const $ = load(content, { xmlMode: true });
    // Iterate over the SVG elements
    $('*').each((_idx, el) => {
        if (el.name === 'svg') {
            $(el).attr('aria-hidden', "${hidden ? 'true' : 'false'}");
            $(el).attr('role', 'img');
            if (keepColors !== 'keep') {
                $(el).attr('fill', 'currentcolor');
            }
            $(el).attr('aria-label', '${title}');
            $(el).removeAttr('id');
        } else if (el.name === 'defs') {
            $(el).remove();
        }

        for (const x of Object.keys(el.attribs)) {
            if (x === 'class') {
                $(el).removeAttr(x);
            }
            if (keepColors !== 'keep' && (x === 'stroke' || x === 'fill')) {
                $(el).attr(x, 'currentcolor');
            }
            if (el.name === 'svg') {
                if (x === 'width' || x === 'height') {
                    $(el).attr(x, '${' + x + '}');
                }
            }
        }
    });

    /**
     * @note $ symbols are escaped upon conversion to strings
     * so we replace them for use in TS files.
     */
    return $('svg')
        .toString()
        .replace(/&#x24;/g, '$')
        .replace(/&apos;/g, "'");
}
