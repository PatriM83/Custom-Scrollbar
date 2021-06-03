/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Add rule
 * @param {String} profile
 * @param {String} domain
 */
function addRule(profile, domain) {
    domain = domain.trim();
    let rule;
    
    if (domain.charAt(0) == '*') {
        rule = new Rule(profile, domain.substring(2), true);
    } else {
        rule = new Rule(profile, domain, false);
    }

    rules[domain] = rule;

    const list = document.getElementById('rule-list');
    const template = document.getElementById('template-rule');
    const clone = template.content.cloneNode(true).children[0];

    clone.getElementsByClassName('text')[0].textContent = rule.displayDomain();
    clone.getElementsByClassName('rule-profile')[0].textContent = listOfProfiles[rule.profile];

    list.appendChild(clone);
    clone.scrollIntoView();
}

/**
 * Remove rule
 * @param {String} domain
 */
function removeRule(domain) {
    delete rules[domain.trim()];
}

/**
 * Convert raw Storage API data to Rule objects
 * @param {Object} raw
 */
function parseRules(raw) {
    for (let r of Object.keys(raw)) {
        addRule(raw[r], r);
    }
    checkIfListIsEmpty();
}

/**
 * Save rules to Storage API
 */
function saveRules() {
    let temp = {};

    for (let r of Object.values(rules)) {
        temp[r.fullDomain()] = r.profile;
    }

    browser.storage.local.set({
        rules: temp
    });

    toggleChangesWarning(false);
}

/**
 * Load rule from provided UI list item
 * @param {HTMLElement} item
 * @returns Rule
 */
function getRuleFromListItem(item) {
    let text = item.getElementsByClassName('text')[0].textContent.trim();

    if (text.split(' ').length > 1) {
        text = '*.' + text.split(' ')[0];
    }

    return rules[text];
}

/**
 * Handle change profile button click
 * @param {HTMLElement} item
 */
function triggerChangeProfile(item) {
    const r = getRuleFromListItem(item);
    document.getElementById('dialog-dropdown').value = r.profile.split('_')[1];

    showDowndown(
        browser.i18n.getMessage('changeProfileFor', r.displayDomain()),
        null,
        (value) => {
            r.profile = `profile_${value}`;
            item.getElementsByClassName('rule-profile')[0].textContent = listOfProfiles[r.profile];
            toggleChangesWarning(true);
        },
        null
    );
}

/**
 * Populate drop-down menu of profiles
 */
function populateProfileDropdown() {
    const selector = document.getElementById('dialog-dropdown');
    selector.textContent = '';

    for (let key of Object.keys(listOfProfiles)) {
        if (key.split('_')[0]  == 'profile') {
            const option = document.createElement('option');
            option.textContent = listOfProfiles[key];
            option.value = key.split('_')[1];
            selector.appendChild(option);
        }
    }

    let options = selector.options;
    let sortedOptions = [];

    for (let o of options) {
        sortedOptions.push(o);
    }

    sortedOptions = sortedOptions.sort((a, b) => {
        return a.textContent.toUpperCase().localeCompare(b.textContent.toUpperCase());
    })

    for (let i = 0; i <= options.length; i++) {
        options[i] = sortedOptions[i];
    }
}

/**
 * Handle remove rule button click
 * @param {HTMLElement} item
 */
function triggerRemoveProfile(item) {
    confirmAction(
        browser.i18n.getMessage('dialogCannotBeUndone'),
        () => {
            const r = getRuleFromListItem(item);
            removeRule(r.fullDomain());
            document.getElementById('rule-list').removeChild(item);
            toggleChangesWarning(true);
            checkIfListIsEmpty();
        },
        null,
        false
    );
}

/**
 * Prompt user for new rule
 */
function triggerAddNewRule() {
    showRuleAdd(
        null,
        browser.i18n.getMessage('domain'),
        browser.i18n.getMessage('optionsSectionProfile'),
        browser.i18n.getMessage('subdomainsOnly'),
        (domain, profile, includeSubdomains) => {
            if (includeSubdomains) {
                domain = '*.' + domain;
            }
            addRule(`profile_${profile}`, domain);
            toggleChangesWarning(true);
            checkIfListIsEmpty();
        },
        null,
        userInputDomainValidation
    );
}

/**
 * Add/Remove the empty list message
 */
function checkIfListIsEmpty() {
    const list = document.getElementById('rule-list');
    const empty = document.getElementById('rule-list-empty');

    if (Object.keys(rules).length > 0) {
        if (empty) list.removeChild(empty);
    } else {
        if (!empty) {
            const template = document.getElementById('template-rule');
            const clone = template.content.cloneNode(true).children[0];

            clone.getElementsByClassName('text')[0].textContent = browser.i18n.getMessage('noRulesSet');
            clone.getElementsByClassName('text-shortcut')[0].textContent = '';
            clone.id = 'rule-list-empty';

            list.appendChild(clone);
        }
    }
}

/**
 * Check if user input fits valid new rule criteria
 * @param {String} input
 * @param {Boolean} checkbox
 * @param {HTMLElement} error
 * @returns Valid
 */
function userInputDomainValidation(input, checkbox, error) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    error.textContent = '';
    input = input.trim();

    if (!domainRegex.test(input)) {
        error.textContent = browser.i18n.getMessage('errorInvalidDomain');
        return false;
    }

    if (checkbox) {
        input = '*.' + input;
    }

    if (rules[input]) {
        error.textContent = browser.i18n.getMessage('errorRuleAlreadyExists');
        return false;
    }

    return true;
}

/**
 * Handle list item click
 * @param {Event} event
 */
function handleListClick(event) {
    switch (event.target.getAttribute('data-action')) {
        case 'change':
            triggerChangeProfile(event.target.parentNode.parentNode);
            break;
        case 'remove':
            triggerRemoveProfile(event.target.parentNode.parentNode);
            break;
        default:
            break;
    }
}

/**
 * Initial load of data from Storage API
 */
function firstLoad() {
    browser.storage.local.get((data) => {
        // Generate list of profiles
        for (let key of Object.keys(data)) {
            if (key.split('_')[0]  == 'profile') {
                listOfProfiles[key] = data[key].name;
            }
        }

        populateProfileDropdown();

        // Load rules
        if (data.rules) {
            parseRules(data.rules);
        }
    });
}

/**
 * Parse i18n on template
 */
function parsei18nOfTemplate() {
    const elements = document.getElementById('template-rule').content.children[0].querySelectorAll('[data-i18n]');
    for (let e of elements) {
        e.textContent = browser.i18n.getMessage(e.dataset.i18n);
    }
}

updatePreview = () => {};

let rules = {};
let listOfProfiles = {};

parsei18nOfTemplate();
firstLoad();
getDefaultScrollbar();
toggleChangesWarning(false);
document.getElementById('rule-list').addEventListener('click', handleListClick);
document.getElementById('rule-add').addEventListener('click', triggerAddNewRule);
document.getElementById('saveChanges').addEventListener('click', saveRules);