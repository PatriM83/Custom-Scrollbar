/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Load data from the Storage API
 */
function init() {
    browser.storage.local.get(['defaultProfile'], (data) => {
        if (data.defaultProfile) {
            selectedProfile = data.defaultProfile;
            defaultProfile = selectedProfile;
            loadScrollbar(selectedProfile);
        }

        reloadProfileSelection(document.settings.profile, updateSelectedProfileInDropdown);
    });
}

/**
 * Save scrollbar settings to Storage API
 */
function saveScrollbar() {
    const colTrack = (document.settings.customColors.value == 'yes') ? colorPickerTrack.color.hex8String : null;
    const colThumb = (document.settings.customColors.value == 'yes') ? colorPickerThumb.color.hex8String : null;
    const profileName = document.getElementById('profileSelection').options[document.getElementById('profileSelection').selectedIndex].textContent.trim();

    const profileData = {
        name: profileName,
        width: document.settings.width.value,
        colorTrack: colTrack,
        colorThumb: colThumb,
        allowOverride: parseInt(document.settings.override.value),
        buttons: document.settings.buttons.value,
        thumbRadius: parseInt(document.settings.thumbRadius.value)
    };

    if (profileData.width == 'other') {
        profileData['customWidthValue'] = parseInt(document.settings.customWidthValue.value);
        profileData['customWidthUnit'] = document.settings.customWidthUnit.value;
    }

    const wrapper = {};
    wrapper[`profile_${selectedProfile}`] = profileData;

    browser.storage.local.set(wrapper, () => {
        toggleChangesWarning(false);
        reloadProfileSelection(document.settings.profile, updateSelectedProfileInDropdown);
    });
}

/**
 * Load the selected profile
 * @param {number} id
 */
 function loadScrollbar(id) {
    selectedProfile = id;
    document.getElementById('profile-setDefault').disabled = selectedProfile == defaultProfile;
    browser.storage.local.get(`profile_${id}`, (scrollbar) => {
        scrollbar = scrollbar[Object.keys(scrollbar)[0]];

        if (typeof scrollbar == 'undefined') {
            return;
        }

        document.settings.customColors.value = (!scrollbar.colorThumb || !scrollbar.colorTrack) ? 'no' : 'yes';

        scrollbar = loadWithDefaults(scrollbar);
        if (scrollbar.width == 'unset') scrollbar.width = 'auto';
        document.settings.width.value = scrollbar.width;
        document.settings.override.value = scrollbar.allowOverride;
        document.settings.customWidthValue.value = scrollbar.customWidthValue;
        document.settings.customWidthUnit.value = scrollbar.customWidthUnit;
        document.settings.buttons.value = scrollbar.buttons;
        document.settings.thumbRadius.value = scrollbar.thumbRadius;

        previousToggleValue = document.settings.customColors.value;
        toggleColorSettings();

        colorPickerThumb.color.hex8String = scrollbar.colorThumb;
        colorPickerTrack.color.hex8String = scrollbar.colorTrack;

        toggleCustomWidth();
        toggleHiddenSettings();
        toggleChangesWarning(false);
        parseCustomWidthValue(false);
        updateRadiusLabel();
    });
}

/**
 * Add new profile
 */
 function addProfile() {
    const id = Date.now();
    const newProfile = {};
    newProfile[`profile_${id}`] = {
        name: generateUnconflictingProfileName(browser.i18n.getMessage('defaultProfileName'), id)
    };

    browser.storage.local.set(newProfile, () => {
        reloadProfileSelection(document.settings.profile, updateSelectedProfileInDropdown);
        loadScrollbar(id);
    });
}

/**
 * Remove selected profile
 */
function removeProfile() {
    browser.storage.local.remove(`profile_${selectedProfile}`, () => {
        const removedProfile = `profile_${selectedProfile}`;
        reloadProfileSelection(document.settings.profile, null);
        loadScrollbar(defaultProfile);

        browser.storage.local.get(['rules', 'localFileProfile'], (storage) => {
            let hasRules = false;
            let hasLocalFileRule = false;
            if (storage.rules) {
                for (const key of Object.keys(storage.rules)) {
                    if (storage.rules[key] == removedProfile) {
                        hasRules = true;
                        break;
                    }
                }
            }

            hasLocalFileRule = (storage.localFileProfile && `profile_${storage.localFileProfile}` == removedProfile);

            if (hasRules || hasLocalFileRule) {
                reloadProfileSelection(document.getElementById('dialog-dropdown'), () => {
                    const dropdown = document.getElementById('dialog-dropdown');
                    addDefaultProfileOption(dropdown);

                    const dropdownNoButton = document.getElementById('dropdown-no');
                    dropdownNoButton.classList.add('hide');

                    showDowndown(
                        browser.i18n.getMessage('profileMoveExistingRules'),
                        null,
                        (to) => {
                            if (hasLocalFileRule) {
                                const newProfile = parseInt(to);
                                localFileProfile = (!isNaN(newProfile)) ? newProfile : null;
                            }

                            dropdownNoButton.classList.remove('hide');
                            bulkUpdateRules(removedProfile, to, storage.rules);
                        },
                        null
                    );
                });
            }
        });
    })
}

/**
 * Update multiple rules at the same time
 * @param {string} from
 * @param {string} to
 * @param {Object} rules
 */
 function bulkUpdateRules(from, to, rules) {
    for (const key of Object.keys(rules)) {
        if (rules[key] == from) {
            if (to == 'default') {
                delete rules[key];
            } else {
                rules[key] = `profile_${to}`;
            }
        }
    }

    browser.storage.local.set({
        rules: rules,
        localFileProfile: localFileProfile
    });
}

/**
 * Change the profile that's used as default
 */
function updateDefaultProfile() {
    browser.storage.local.set({
        defaultProfile: selectedProfile
    }, () => {
        defaultProfile = selectedProfile;
        reloadProfileSelection(document.settings.profile, updateSelectedProfileInDropdown);
    });
}

/**
 * Rename the profile that's currently selected
 * @param {String} input
 */
 function renameProfile(input) {
    input = generateUnconflictingProfileName(input, selectedProfile);

    browser.storage.local.get(`profile_${selectedProfile}`, (data) => {
        data[`profile_${selectedProfile}`].name = input;
        browser.storage.local.set(data, () => {
            reloadProfileSelection(document.settings.profile, updateSelectedProfileInDropdown);
        });
    })
}

/**
 * Generate a unique name from the given string (prevents duplicate profile names)
 * @param {String} name
 * @param {number} id
 * @returns Unique Name
 */
 function generateUnconflictingProfileName(name, id) {
    let finalName = name;
    let exists = false;
    let counter = 1;

    do {
        exists = false;

        for (const option of document.settings.profile.options) {
            if (option.textContent == finalName && option.value != id) {
                exists = true;
                counter++;
                finalName = `${name} (${counter})`;
                break;
            }
        }

    } while (exists);

    return finalName;
}

/**
 * Generates new CSS code for scrollbars
 * @returns {string} css
 */
 function getNewCSS() {
    const width = document.settings.width.value;
    const colThumb = (document.settings.customColors.value == 'yes') ? colorPickerThumb.color.hex8String : null;
    const colTrack = (document.settings.customColors.value == 'yes') ? colorPickerTrack.color.hex8String : null;
    const customWidth = (document.settings.width.value == 'other') ? document.settings.customWidthValue.value + document.settings.customWidthUnit.value : null;
    const buttons = document.settings.buttons.value;
    const thumbRadius = parseInt(document.settings.thumbRadius.value);

    return generateCSS(width, colTrack, colThumb, 0, customWidth, buttons, thumbRadius);
}

/**
 * Create color pickers for parts of scrollbar
 */
 function createColorPickers() {
    colorPickerThumb = createColorPicker(
        document.getElementById('colorThumb'),
        getColorInputs('colorThumb'),
        document.getElementById('colorThumbPreview'),
        defaults.colorThumb
    );
    colorPickerTrack = createColorPicker(
        document.getElementById('colorTrack'),
        getColorInputs('colorTrack'),
        document.getElementById('colorTrackPreview'),
        defaults.colorThumb
    );
}

/**
 * Create color picker
 * @param {HTMLElement} container
 * @param {Object} inputs
 * @param {HTMLElement} preview
 * @param {string} setTo
 * @returns Color picker
 */
function createColorPicker(container, inputs, preview, setTo) {
    let layout;
    if (CSS.supports('background', 'rgba(0, 0, 0, 0) conic-gradient(red, magenta, blue, aqua, lime, yellow, red) repeat scroll 0% 0%')) {
        layout = [{
                component: iro.ui.Wheel
            },
            {
                component: iro.ui.Slider,
                options: {
                    sliderType: 'value'
                }
            },
            {
                component: iro.ui.Slider,
                options: {
                    sliderType: 'alpha'
                }
            }
        ];
    } else {
        layout = [{
                component: iro.ui.Box
            },
            {
                component: iro.ui.Slider,
                options: {
                    sliderType: 'hue'
                }
            },
            {
                component: iro.ui.Slider,
                options: {
                    sliderType: 'alpha'
                }
            }
        ];
    }

    const picker = new iro.ColorPicker(container, {
        color: setTo,
        layout: layout,
        layoutDirection: 'horizontal'
    });

    picker.on('color:change', (color) => {
        inputs.hex.value = color.hex8String;

        inputs.rgb.red.value = Math.round(color.red);
        inputs.rgb.green.value = Math.round(color.green);
        inputs.rgb.blue.value = Math.round(color.blue);
        inputs.rgb.alpha.value = Math.round(color.alpha * 100);

        inputs.hsv.hue.value = Math.round(color.hue);
        inputs.hsv.saturation.value = Math.round(color.saturation);
        inputs.hsv.value.value = Math.round(color.value);
        inputs.hsv.alpha.value = Math.round(color.alpha * 100);

        preview.style.backgroundColor = color.hex8String;
        toggleChangesWarning(true);
    });

    // Color mode tabs event listeners
    inputs.tabs.hex.addEventListener('click', () => {
        changeColorMode(inputs.tabs, inputs.tabs.hex, 'hex')
    });
    inputs.tabs.rgb.addEventListener('click', () => {
        changeColorMode(inputs.tabs, inputs.tabs.rgb, 'rgb')
    });
    inputs.tabs.hsv.addEventListener('click', () => {
        changeColorMode(inputs.tabs, inputs.tabs.hsv, 'hsv')
    });

    // HEX color mode input event listeners
    inputs.hex.addEventListener('change', () => {
        picker.color.hex8String = inputs.hex.value.trim();
    });

    // RGB color mode inputs event listeners
    inputs.rgb.red.addEventListener('change', () => {
        validateColor(inputs.rgb.red, 255, picker.color.red, false);
        picker.color.red = inputs.rgb.red.value.trim();
    });
    inputs.rgb.green.addEventListener('change', () => {
        validateColor(inputs.rgb.green, 255, picker.color.green, false);
        picker.color.green = inputs.rgb.green.value.trim();
    });
    inputs.rgb.blue.addEventListener('change', () => {
        validateColor(inputs.rgb.blue, 255, picker.color.blue, false);
        picker.color.blue = inputs.rgb.blue.value.trim();
    });
    inputs.rgb.alpha.addEventListener('change', () => {
        validateColor(inputs.rgb.alpha, 100, picker.color.alpha, true);
        picker.color.alpha = inputs.rgb.alpha.value.trim();
    });

    // HSV color mode inputs event listeners
    inputs.hsv.hue.addEventListener('change', () => {
        validateColor(inputs.hsv.hue, 360, picker.color.hue, false);
        picker.color.hue = inputs.hsv.hue.value.trim();
    });
    inputs.hsv.saturation.addEventListener('change', () => {
        validateColor(inputs.hsv.saturation, 100, picker.color.saturation, false);
        picker.color.saturation = inputs.hsv.saturation.value.trim();
    });
    inputs.hsv.value.addEventListener('change', () => {
        validateColor(inputs.hsv.value, 100, picker.color.value, false);
        picker.color.value = inputs.hsv.value.value.trim();
    });
    inputs.hsv.alpha.addEventListener('change', () => {
        validateColor(inputs.hsv.alpha, 100, picker.color.alpha, true);
        picker.color.alpha = inputs.hsv.alpha.value.trim();
    });

    inputs.hex.value = picker.color.hex8String;

    inputs.rgb.red.value = Math.round(picker.color.red);
    inputs.rgb.green.value = Math.round(picker.color.green);
    inputs.rgb.blue.value = Math.round(picker.color.blue);
    inputs.rgb.alpha.value = Math.round(picker.color.alpha * 100);

    inputs.hsv.hue.value = Math.round(picker.color.hue);
    inputs.hsv.saturation.value = Math.round(picker.color.saturation);
    inputs.hsv.value.value = Math.round(picker.color.value);
    inputs.hsv.alpha.value = Math.round(picker.color.alpha * 100);

    preview.style.backgroundColor = picker.color.hex8String;

    return picker;
}

/**
 * Make sure that the color entered is valid
 * @param {HTMLElement} input
 * @param {number} max
 * @param {number} original
 * @param {boolean} percentage
 */
 function validateColor(input, max, original, percentage) {
    const parsedValue = parseFloat(input.value.trim());

    if (isNaN(parsedValue)) {
        input.value = original;
    } else if (parsedValue < 0) {
        input.value = 0;
    } else if (parsedValue > max) {
        input.value = max;
    }

    if (percentage) {
        input.value = parsedValue / 100;
    }
}

/**
 * Show/hide custom colors section
 */
function toggleColorSettings() {
    if (document.settings.customColors.value == 'yes') {
        if (previousToggleValue != 'yes') {
            colorPickerThumb.color.hex8String = defaults.colorThumb;
            colorPickerTrack.color.hex8String = defaults.colorTrack;
        }
        document.getElementById('only-colors').classList.remove('hide');
    } else {
        document.getElementById('only-colors').classList.add('hide');
    }

    previousToggleValue = document.settings.customColors.value;
}

/**
 * Change between Hex, RGB or HSV mode
 * @param {Object} tabs 
 * @param {HTMLElement} selected 
 * @param {string} key 
 */
 function changeColorMode(tabs, selected, key) {
    tabs.hex.classList.remove('selected');
    tabs.rgb.classList.remove('selected');
    tabs.hsv.classList.remove('selected');

    const container = tabs.hex.parentNode.parentNode;
    container.classList.remove('showHEX');
    container.classList.remove('showRGB');
    container.classList.remove('showHSV');

    selected.classList.add('selected');
    container.classList.add('show' + key.toUpperCase());
}

/**
 * Get all elements of the color inputs
 * @param {string} parentId
 * @returns Object of all HTML elements
 */
function getColorInputs(parentId) {
    const hex = document.getElementById(parentId + 'HEX');
    const rgb = document.getElementById(parentId + 'RGB');
    const hsv = document.getElementById(parentId + 'HSV');
    const tabs = document.getElementById(parentId + "Tabs");

    return {
        hex: hex,
        rgb: {
            red: rgb.getElementsByTagName('input')[0],
            green: rgb.getElementsByTagName('input')[1],
            blue: rgb.getElementsByTagName('input')[2],
            alpha: rgb.getElementsByTagName('input')[3]
        },
        hsv: {
            hue: hsv.getElementsByTagName('input')[0],
            saturation: hsv.getElementsByTagName('input')[1],
            value: hsv.getElementsByTagName('input')[2],
            alpha: hsv.getElementsByTagName('input')[3]
        },
        container: document.getElementById(parentId).parentElement,
        tabs: {
            hex: tabs.getElementsByTagName('button')[0],
            rgb: tabs.getElementsByTagName('button')[1],
            hsv: tabs.getElementsByTagName('button')[2],
        }
    };
}

/**
 * Update percentage counter for border radius
 */
function updateRadiusLabel() {
    const label = document.getElementById('thumbRadius-label');
    label.textContent = document.settings.thumbRadius.value + '%';
    updatePreview();
}

/**
 * Toggle the options for width of other
 */
function toggleCustomWidth() {
    const customWidthValue = document.getElementById('customWidthValue');
    const customWidthUnit = document.getElementById('customWidthUnit');

    if (document.settings.width.value == 'other') {
        customWidthValue.disabled = false;
        customWidthUnit.disabled = false;
    } else {
        customWidthValue.disabled = true;
        customWidthUnit.disabled = true;
    }
}

/**
 * Parse and handle focus of custom with value
 * @param {boolean} showNumber
 */
function parseCustomWidthValue(showNumber) {
    const otherText = document.getElementById('customWidthValue');

    if (showNumber) {
        otherText.type = 'number';
    } else {
        otherText.type = 'text';
        if (isNaN(parseInt(otherText.value))) {
            otherText.value = defaults.customWidthValue;
        }
    }
}

/**
 * Select the correct profile from the profile drop-down
 */
function updateSelectedProfileInDropdown() {
    document.settings.profile.value = selectedProfile;
    document.getElementById('profile-setDefault').disabled = selectedProfile == defaultProfile;
}

let colorPickerThumb, colorPickerTrack, previousToggleValue;
let defaultProfile, selectedProfile, selectedProfileName, localFileProfile;
const colorInputs = {};
createColorPickers();
init();

document.getElementById('saveChanges').addEventListener('click', saveScrollbar);
document.settings.addEventListener('change', () => {
    toggleColorSettings();
    toggleCustomWidth();
    toggleChangesWarning(true);
});
document.settings.thumbRadius.addEventListener('input', updateRadiusLabel);
document.getElementById('customWidthValue').addEventListener('focus', () => {
    parseCustomWidthValue(true)
});
document.getElementById('customWidthValue').addEventListener('blur', () => {
    parseCustomWidthValue(false)
});
document.getElementById('profile-setDefault').addEventListener('click', updateDefaultProfile);

document.settings.profile.addEventListener('change', () => {
    confirmAction(
        browser.i18n.getMessage('dialogChangesWillBeLost'),
        function() {
            loadScrollbar(document.settings.profile.value)
        },
        function() {
            document.settings.profile.value = selectedProfile
        },
        !pendingChanges
    );
});
document.getElementById('profile-add').addEventListener('click', () => {
    confirmAction(
        browser.i18n.getMessage('dialogChangesWillBeLost'),
        addProfile,
        null,
        !pendingChanges
    );
});
document.getElementById('profile-rename').addEventListener('click', () => {
    const selector = document.getElementById('profileSelection');
    showPrompt(
        null,
        renameProfile,
        null,
        selector.options[selector.selectedIndex].textContent
    );
});
document.getElementById('profile-remove').addEventListener('click', () => {
    if (selectedProfile == defaultProfile) {
        showAlert(
            browser.i18n.getMessage('dialogCannotDeleteDefault'),
            null,
            false
        );
        return;
    }

    confirmAction(
        browser.i18n.getMessage('dialogCannotBeUndone'),
        removeProfile,
        null,
        false
    );
});
