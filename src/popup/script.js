/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Load i18n data
 */
 function parsei18n() {
    const elements = document.querySelectorAll('[data-i18n]');
    for (let e of elements) {
        e.textContent = browser.i18n.getMessage(e.dataset.i18n);
    }
}

/**
 * Shows settings details of the selected profile
 * @param {Object} profile
 */
function displayDetails(profile) {
    const widthOutput = document.getElementById('detail-width');
    const colorThumbOutput = document.getElementById('detail-color-thumb');
    const colorTrackOutput = document.getElementById('detail-color-track');
    const overrideOutput = document.getElementById('detail-override');

    // Fill width information
    switch(profile.width) {
        case 'auto':
        case 'unset':
            widthOutput.textContent = browser.i18n.getMessage('sizeWide');
            break;
        case 'thin':
            widthOutput.textContent = browser.i18n.getMessage('sizeThin');
            break;
        case 'none':
            widthOutput.textContent = browser.i18n.getMessage('sizeHidden');
            break;
        default:
            widthOutput.textContent = profile.customWidthValue + profile.customWidthUnit;
            break;
    }

    // Fill color information
    if (profile.colorThumb && profile.colorTrack) {
        colorThumbOutput.style.background = profile.colorThumb;
        colorThumbOutput.textContent = '';
        colorThumbOutput.classList.add('color-output');

        colorTrackOutput.style.background = profile.colorTrack;
        colorTrackOutput.textContent = '';
        colorTrackOutput.classList.add('color-output');
    } else {
        colorThumbOutput.style.background = 'unset';
        colorThumbOutput.textContent = '-';
        colorThumbOutput.classList.remove('color-output');

        colorTrackOutput.style.background = 'unset';
        colorTrackOutput.textContent = '-';
        colorTrackOutput.classList.remove('color-output');
    }

    // Fill override information
    switch(profile.allowOverride) {
        case 0:
            overrideOutput.textContent = browser.i18n.getMessage('overrideNone');
            break;
        case 1:
            overrideOutput.textContent = browser.i18n.getMessage('overrideColor');
            break;
        case 10:
            overrideOutput.textContent = browser.i18n.getMessage('overrideWidth');
            break;
        case 11:
            overrideOutput.textContent = browser.i18n.getMessage('overrideAll');
            break;
    }
}

/**
 * Update the default profile
 */
function setAsDefault() {
    browser.storage.local.set({defaultProfile: document.manager.profile.value}, () => {
        browser.storage.local.get(loadStorage);
    });
}

/**
 * Handle profile selection drop-down menu change
 */
function changeSelectedProfile() {
    if (document.manager.profile.value == 'default') {
        loadProfile(defaultProfile);
    } else {
        loadProfile(document.manager.profile.value);
    }
    refreshSetAsDefaultButton();
}

/**
 * Load profile from Storage API
 * @param {number} id
 */
function loadProfile(id) {
    browser.storage.local.get(`profile_${id}`, (data) => {
        const profile = loadWithDefaults(data[Object.keys(data)[0]]);
        displayDetails(profile);
    });
}

/**
 * Toggle "Set as default" button
 */
function refreshSetAsDefaultButton() {
    document.getElementById('button-setDefault').disabled = defaultProfile == document.manager.profile.value || document.manager.profile.value == 'default';
    if (document.getElementById('button-use')) document.getElementById('button-use').disabled = currentRule == document.manager.profile.value;
}

/**
 * Load default profile information from Storage API
 * @param {Object} data
 */
function loadStorage(data) {
    document.manager.profile.value = data.defaultProfile;
    defaultProfile = data.defaultProfile;
    loadProfileList(data);

    browser.tabs.query({
        active: true,
        currentWindow: true
    }, (tabs) => {
        if (tabs[0].url) {
            setUpTabForURL(tabs[0].url, data.rules);
        } else {
            setToGeneralMode();
            loadProfile(defaultProfile);
        }

        refreshSetAsDefaultButton();
    });
}

/**
 * Preload data for the specific domain
 * @param {String} domain
 * @param {Object} rules
 */
function setUpTabForURL(domain, rules) {
    if (domain.indexOf('://') > 0) {
        domain = domain.substring(domain.indexOf('://') + 3);
    }

    if (domain.indexOf(':') > 0) {
        domain = domain.substring(0, domain.indexOf(':'));
    }

    if (domain.indexOf('/') > 0) {
        domain = domain.substring(0, domain.indexOf('/'));
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
        setToGeneralMode();
        return;
    }

    ruleForDomain = domain;
    const domainParts = domain.split('.');
    let startAt = 0;
    let usingRule = null;
    let selectedDomain = '';

    while (startAt < domainParts.length - 1) {
        selectedDomain = '';

        for (let i = startAt; i < domainParts.length; i++) {
            selectedDomain += '.' + domainParts[i];
        }

        if (startAt == 0) {
            selectedDomain = selectedDomain.substring(1);
        } else {
            selectedDomain = '*' + selectedDomain;
        }

        if (rules[selectedDomain]) {
            usingRule = rules[selectedDomain];
            break;
        }

        startAt++;
    }

    if (usingRule != null) {
        usingRule = usingRule.split('_')[1];
        document.manager.profile.value = usingRule;
        currentRule = usingRule;
        loadProfile(usingRule);
    } else {
        currentRule = 'default';
        loadProfile(defaultProfile);
    }
}

/**
 * Save rule to Storage API
 */
function updateRule() {
    browser.storage.local.get('rules', (data) => {
        if (document.manager.profile.value == 'default') {
            delete data.rules[ruleForDomain];
        } else {
            data.rules[ruleForDomain] = `profile_${document.manager.profile.value}`;
        }

        browser.storage.local.set(data, () => {
            browser.storage.local.get(loadStorage);
        });
    })
}

/**
 * Disable website-specific edits
 */
function setToGeneralMode() {
    const useButton = document.getElementById('button-use');
    useButton.parentNode.removeChild(useButton);
    document.manager.profile.removeChild(document.manager.profile.firstChild);
    document.manager.profile.value = defaultProfile;
    loadProfile(defaultProfile);
}

/**
 * Load list of profiles from Storage API
 */
function loadProfileList(data) {
    document.manager.profile.textContent = '';

    for (let key of Object.keys(data)) {
        if (key.split('_')[0]  == 'profile') {
            const option = document.createElement('option');
            option.textContent = data[key].name;
            option.value = key.split('_')[1];
            document.manager.profile.appendChild(option);
        }
    }

    let options = document.manager.profile.options;
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

    const option = document.createElement('option');
    option.textContent = browser.i18n.getMessage('profileUsingDefault', data[`profile_${defaultProfile}`].name);
    option.value = 'default';
    document.manager.profile.insertBefore(option, document.manager.profile.firstChild);

    document.manager.profile.value = 'default';
}

let defaultProfile, ruleForDomain, currentRule;
parsei18n();
browser.storage.local.get(loadStorage);
document.manager.profile.addEventListener('change', changeSelectedProfile);
document.getElementById('button-setDefault').addEventListener('click', setAsDefault);
document.getElementById('button-options').addEventListener('click', () => { browser.runtime.openOptionsPage(); });
document.getElementById('button-use').addEventListener('click', updateRule);