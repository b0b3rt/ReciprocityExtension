"use strict";
const RECIPROCITY_DATA_KEY = 'reciprocity_extension_data';
const RECIPROCITY_HOST = 'reciprocity.io';
const getUserName = (userTableRow) => {
    var _a;
    const name = (_a = userTableRow.getElementsByClassName('name')[0]) === null || _a === void 0 ? void 0 : _a.textContent;
    if (!name) {
        throw new Error(`Can't find name for user in row element ${userTableRow.outerHTML}`);
    }
    return name;
};
const getUserBio = (userTableRow) => {
    const bio = userTableRow.getElementsByClassName('bio')[0].textContent;
    if (!bio) {
        throw new Error(`Can't find bio for user in row element ${userTableRow.outerHTML}`);
    }
    return bio;
};
const getUserImageUrl = (userTableRow) => {
    const rawUrl = userTableRow.getElementsByTagName('img')[0].src;
    const url = new URL(rawUrl);
    url.searchParams.delete('ext');
    url.searchParams.delete('hash');
    return url.toString();
};
const getUserInfo = (userTableRow) => {
    return {
        name: getUserName(userTableRow),
        bio: getUserBio(userTableRow),
        imageUrl: getUserImageUrl(userTableRow)
    };
};
const newField = (value) => ({
    current: value,
    previous: [],
    newDiff: false
});
const converUserRowToStorage = (userTableRow) => {
    const { name, bio, imageUrl } = getUserInfo(userTableRow);
    return {
        name: newField(name),
        bio: newField(bio),
        imageUrl: newField(imageUrl)
    };
};
const convertUserRowsToStorage = (userTableRows) => ({
    users: Object.fromEntries(userTableRows
        .map(converUserRowToStorage)
        .map(({ name, bio, imageUrl }) => [
        name.current, {
            name,
            bio,
            imageUrl
        }
    ]))
});
const getLocalData = (userTableRows) => {
    const serializedData = localStorage.getItem(RECIPROCITY_DATA_KEY);
    if (serializedData) {
        return JSON.parse(serializedData);
    }
    else {
        const data = convertUserRowsToStorage(userTableRows);
        setLocalData(data);
        return data;
    }
};
const setLocalData = (data) => {
    localStorage.setItem(RECIPROCITY_DATA_KEY, JSON.stringify(data));
};
const updateCachedField = (field, newValue) => {
    field.previous.push(field.current);
    field.current = newValue;
    field.newDiff = true;
};
const getUserTableRows = (friendTable) => [...friendTable.rows].filter(row => row.cells.length === 4);
const isUserChecked = (userTableRow) => {
    const [, ...checkboxes] = userTableRow.cells;
    return checkboxes.some(c => { var _a, _b, _c; return ((_c = (_b = (_a = c.firstChild) === null || _a === void 0 ? void 0 : _a.firstChild) === null || _b === void 0 ? void 0 : _b.firstChild) === null || _c === void 0 ? void 0 : _c.checked) === true; });
};
const isUserHidden = (userTableRow, localData) => {
    const userName = getUserName(userTableRow);
    const userData = localData.users[userName];
    return !!(userData === null || userData === void 0 ? void 0 : userData.hide);
};
const userHasNewDiffs = (userTableRow, localData) => {
    const userName = getUserName(userTableRow);
    if (!localData.users[userName])
        return true;
    return ['name', 'bio', 'imageUrl'].some(fieldName => { var _a; return (_a = localData.users[userName]) === null || _a === void 0 ? void 0 : _a[fieldName].newDiff; });
};
const getUserUpdates = (userTableRow, localData) => {
    const currentUserInfo = getUserInfo(userTableRow);
    const cachedUserInfo = localData.users[currentUserInfo.name];
    if (!cachedUserInfo)
        return { type: 'user', update: 'new' };
    const { bio: cachedBio, imageUrl: cachedImageUrl } = cachedUserInfo;
    const isBioNew = cachedBio.current !== currentUserInfo.bio;
    const isImageUrlNew = cachedImageUrl.current !== currentUserInfo.imageUrl;
    if (isBioNew && isImageUrlNew) {
        updateCachedField(cachedBio, currentUserInfo.bio);
        updateCachedField(cachedImageUrl, currentUserInfo.imageUrl);
        return { type: 'field', update: 'both' };
    }
    else if (isBioNew) {
        updateCachedField(cachedBio, currentUserInfo.bio);
        return { type: 'field', update: 'bio' };
    }
    else if (isImageUrlNew) {
        updateCachedField(cachedImageUrl, currentUserInfo.imageUrl);
        return { type: 'field', update: 'imageUrl' };
    }
    else {
        return { type: 'none' };
    }
};
const compareUserUpdates = (firstUserUpdate, secondUserUpdate) => {
    if (firstUserUpdate.type === 'user') {
        if (secondUserUpdate.type === 'user')
            return 0;
        return -1;
    }
    else if (firstUserUpdate.type === 'field') {
        if (secondUserUpdate.type === 'user')
            return 1;
        if (secondUserUpdate.type === 'none')
            return -1;
        if (firstUserUpdate.update === 'both') {
            if (secondUserUpdate.update === 'both')
                return 0;
            return -1;
        }
        if (secondUserUpdate.update === 'both') {
            return 1;
        }
        return 0;
    }
    else {
        if (secondUserUpdate.type === 'none')
            return 0;
        return 1;
    }
};
const sortCheckedFirst = (userTableRows, localData) => {
    userTableRows.sort((firstRow, secondRow) => {
        const firstChecked = isUserChecked(firstRow);
        const secondChecked = isUserChecked(secondRow);
        if (firstChecked && !secondChecked)
            return -1;
        if (secondChecked && !firstChecked)
            return 1;
        const firstHidden = isUserHidden(firstRow, localData);
        const secondHidden = isUserHidden(secondRow, localData);
        if (secondHidden && !firstHidden)
            return -1;
        if (firstHidden && !secondHidden)
            return 1;
        const firstUpdates = getUserUpdates(firstRow, localData);
        const secondUpdates = getUserUpdates(secondRow, localData);
        return compareUserUpdates(firstUpdates, secondUpdates);
    }).forEach(val => { var _a; return (_a = val.parentNode) === null || _a === void 0 ? void 0 : _a.appendChild(val); });
};
const HIDE_BUTTON_STYLE = 'margin: 10px; max-height: 25px;';
const getHideButton = (userTableRow, localData) => {
    const button = document.createElement('button');
    button.setAttribute('class', 'hide-button');
    button.setAttribute('style', HIDE_BUTTON_STYLE);
    button.textContent = 'Hide';
    button.addEventListener('click', (e) => {
        const userName = getUserName(userTableRow);
        if (!localData.users[userName]) {
            localData.users[userName] = converUserRowToStorage(userTableRow);
        }
        localData.users[userName].hide = true;
        setLocalData(localData);
        process(userTableRow.parentElement);
    });
    return button;
};
const getUnhideButton = (userTableRow, localData) => {
    const button = document.createElement('button');
    button.setAttribute('class', 'unhide-button');
    button.setAttribute('style', HIDE_BUTTON_STYLE);
    button.textContent = 'Unhide';
    button.addEventListener('click', (e) => {
        const userName = getUserName(userTableRow);
        if (!localData.users[userName]) {
            localData.users[userName] = converUserRowToStorage(userTableRow);
        }
        localData.users[userName].hide = false;
        setLocalData(localData);
        process(userTableRow.parentElement);
    });
    return button;
};
const getMarkReadButton = (userTableRow, localData) => {
    const button = document.createElement('button');
    button.setAttribute('class', 'snooze-button');
    button.setAttribute('style', HIDE_BUTTON_STYLE);
    button.textContent = 'Snooze';
    button.addEventListener('click', (e) => {
        const userName = getUserName(userTableRow);
        if (!localData.users[userName]) {
            localData.users[userName] = converUserRowToStorage(userTableRow);
        }
        localData.users[userName].name.newDiff = false;
        localData.users[userName].bio.newDiff = false;
        localData.users[userName].imageUrl.newDiff = false;
        setLocalData(localData);
        process(userTableRow.parentElement);
    });
    return button;
};
const SEPARATOR_ROW_STYLE = 'height: 10px; border-width: medium; border-style: solid; background-color: black;';
const UPDATED_FIELD_STYLE = 'background-color: green';
const hydrateSeparatorRow = (row) => {
    row.setAttribute('class', 'hidden-separator');
    row.setAttribute('style', SEPARATOR_ROW_STYLE);
    row.insertCell();
};
const addUserTagButtons = (userTableRows, localData) => {
    userTableRows.forEach(row => {
        const hidden = isUserHidden(row, localData);
        const toggleHideButton = hidden ? getUnhideButton(row, localData) : getHideButton(row, localData);
        const rowUserCell = row.getElementsByClassName('user-td')[0];
        while (rowUserCell.children[1] instanceof HTMLButtonElement) {
            rowUserCell.removeChild(rowUserCell.children[1]);
        }
        rowUserCell.insertBefore(toggleHideButton, rowUserCell.children[1]);
        const updated = userHasNewDiffs(row, localData);
        if (updated) {
            const snoozeButton = getMarkReadButton(row, localData);
            rowUserCell.insertBefore(snoozeButton, rowUserCell.children[1]);
        }
    });
};
const OVERFLOW_WRAP_STYLE = 'overflow-wrap: anywhere';
const setBioOverflowWrap = (userTableRows) => {
    userTableRows.forEach(row => {
        const bioDiv = row.getElementsByClassName('bio')[0];
        bioDiv.setAttribute('style', OVERFLOW_WRAP_STYLE);
    });
};
const addSeparatorRow = (friendTable, localData) => {
    const firstHiddenRow = getUserTableRows(friendTable).findIndex(row => isUserHidden(row, localData));
    if (firstHiddenRow !== -1) {
        const separatorRow = friendTable.insertRow(firstHiddenRow);
        hydrateSeparatorRow(separatorRow);
    }
};
const process = (friendTable) => {
    const userTableRows = getUserTableRows(friendTable);
    friendTable.replaceChildren(...userTableRows);
    const localData = getLocalData(userTableRows);
    sortCheckedFirst(userTableRows, localData);
    setLocalData(localData);
    addUserTagButtons(userTableRows, localData);
    setBioOverflowWrap(userTableRows);
    addSeparatorRow(friendTable, localData);
};
const observer = new MutationObserver(function (mutations, mutationInstance) {
    const url = new URL(document.URL);
    if (url.host.endsWith(RECIPROCITY_HOST)) {
        const friendTable = document.getElementsByTagName('tbody')[0];
        if (friendTable) {
            process(friendTable);
            mutationInstance.disconnect();
        }
    }
});
observer.observe(document, {
    childList: true,
    subtree: true
});
