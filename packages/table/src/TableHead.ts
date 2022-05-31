/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
import {
    CSSResultArray,
    html,
    SpectrumElement,
    TemplateResult,
} from '@spectrum-web-components/base';
import { property } from '@spectrum-web-components/base/src/decorators.js';
import type { TableHeadCell } from './TableHeadCell.js';

import styles from './table-head.css.js';

/**
 * @element sp-table
 */
export class TableHead extends SpectrumElement {
    public static get styles(): CSSResultArray {
        return [styles];
    }

    @property({ reflect: true })
    public role = 'row';

    public childCells = [] as TableHeadCell[];

    public selectable?: boolean;

    private handleSorted({ target }: Event): void {
        const childCells = [...this.children] as TableHeadCell[];
        childCells.forEach((cell) => {
            if (cell !== target) {
                cell.sorted = undefined;
            }
        });
    }

    // private handleSelectAll({ target }: Event): void {
    //     const childCells = [this.child]
    // }

    protected render(): TemplateResult {
        return html`
            <slot @sorted=${this.handleSorted}></slot>
        `;
    }

    // I want this to listen for the change on a checkbox Cell and to update
    // its selected state accordingly.
}
