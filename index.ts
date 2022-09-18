interface Field {
  current: string;
  previous: string[];
  newDiff: boolean;
}

interface ReciprocityUser {
  imageUrl: Field;
  name: Field;
  bio: Field;
  hide?: boolean;
}

interface ReciprocityStorage {
  users: {
    [name: string]: ReciprocityUser;
  };
}

interface RowUserInfo {
  name: string;
  bio: string;
  imageUrl: string;
}

interface NewUserUpdate {
  type: 'user';
  update: 'new';
}

interface DeletedUserUpdate {
  type: 'user';
  update: 'deleted';
}

interface ModifiedFieldUpdate {
  type: 'field';
  update: 'bio' | 'imageUrl' | 'both';
}

interface NoUpdate {
  type: 'none';
}

type UserUpdate = NewUserUpdate | DeletedUserUpdate | ModifiedFieldUpdate | NoUpdate;

const RECIPROCITY_DATA_KEY = 'reciprocity_extension_data';
const RECIPROCITY_HOST = 'reciprocity.io';

const getUserName = (userTableRow: HTMLTableRowElement) => {
  const name = userTableRow.getElementsByClassName('name')[0]?.textContent;
  if (!name) {
    throw new Error(`Can't find name for user in row element ${userTableRow.outerHTML}`);
  }

  return name;
};

const getUserBio = (userTableRow: HTMLTableRowElement) => {
  const bio = userTableRow.getElementsByClassName('bio')[0].textContent;
  if (!bio) {
    throw new Error(`Can't find bio for user in row element ${userTableRow.outerHTML}`)
  }

  return bio;
};

const getUserImageUrl = (userTableRow: HTMLTableRowElement) => {
  const rawUrl = userTableRow.getElementsByTagName('img')[0].src;
  const url = new URL(rawUrl);
  url.searchParams.delete('ext');
  url.searchParams.delete('hash');
  return url.toString();
};

const getUserInfo = (userTableRow: HTMLTableRowElement) => {
  return {
    name: getUserName(userTableRow),
    bio: getUserBio(userTableRow),
    imageUrl: getUserImageUrl(userTableRow)
  };
};

const newField = (value: string): Field => ({
  current: value,
  previous: [],
  newDiff: false
});

const converUserRowToStorage = (userTableRow: HTMLTableRowElement): ReciprocityUser => {
  const { name, bio, imageUrl } = getUserInfo(userTableRow);
  return {
    name: newField(name),
    bio: newField(bio),
    imageUrl: newField(imageUrl)
  };
};

const convertUserRowsToStorage = (userTableRows: HTMLTableRowElement[]): ReciprocityStorage => ({
  users: Object.fromEntries<ReciprocityUser>(
    userTableRows
      .map(converUserRowToStorage)
      .map(({ name, bio, imageUrl }) => [
        name.current, {
          name,
          bio,
          imageUrl
        }
      ])
  )
});

const getLocalData = (userTableRows: HTMLTableRowElement[]): ReciprocityStorage => {
  const serializedData = localStorage.getItem(RECIPROCITY_DATA_KEY);
  if (serializedData) {
    return JSON.parse(serializedData);
  } else {
    const data = convertUserRowsToStorage(userTableRows);
    setLocalData(data);

    return data;
  }
};

const setLocalData = (data: ReciprocityStorage) => {
  localStorage.setItem(RECIPROCITY_DATA_KEY, JSON.stringify(data));
};

const updateCachedField = (field: Field, newValue: string) => {
  field.previous.push(field.current);
  field.current = newValue;
  field.newDiff = true;
};

const getUserTableRows = (friendTable: HTMLTableSectionElement) => [...friendTable.rows].filter(row => row.cells.length === 4);

const isUserChecked = (userTableRow: HTMLTableRowElement) => {
  const [, ...checkboxes] = userTableRow.cells;
  return checkboxes.some(c => (c.firstChild?.firstChild?.firstChild as HTMLInputElement)?.checked === true);
};

const isUserHidden = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage) => {
  const userName = getUserName(userTableRow);
  const userData = localData.users[userName];
  return !!userData?.hide;
};

const userHasNewDiffs = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage) => {
  const userName = getUserName(userTableRow);
  if (!localData.users[userName]) return true;
  return (['name', 'bio', 'imageUrl'] as const).some(fieldName => localData.users[userName]?.[fieldName].newDiff);
};

const getUserUpdates = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage): UserUpdate => {
  const currentUserInfo = getUserInfo(userTableRow);
  const cachedUserInfo = localData.users[currentUserInfo.name];
  if (!cachedUserInfo) return { type: 'user', update: 'new' };

  const { bio: cachedBio, imageUrl: cachedImageUrl } = cachedUserInfo;
  const isBioNew = cachedBio.current !== currentUserInfo.bio;
  const isImageUrlNew = cachedImageUrl.current !== currentUserInfo.imageUrl;

  if (isBioNew && isImageUrlNew) {
    updateCachedField(cachedBio, currentUserInfo.bio);
    updateCachedField(cachedImageUrl, currentUserInfo.imageUrl);
    return { type: 'field', update: 'both' };
  } else if (isBioNew) {
    updateCachedField(cachedBio, currentUserInfo.bio);
    return { type: 'field', update: 'bio' };
  } else if (isImageUrlNew) {
    updateCachedField(cachedImageUrl, currentUserInfo.imageUrl);
    return { type: 'field', update: 'imageUrl' };
  } else {
    return { type: 'none' };
  }
};

const compareUserUpdates = (firstUserUpdate: UserUpdate, secondUserUpdate: UserUpdate) => {
  if (firstUserUpdate.type === 'user') {
    if (secondUserUpdate.type === 'user') return 0;
    return -1;
  } else if (firstUserUpdate.type === 'field') {
    if (secondUserUpdate.type === 'user') return 1;
    if (secondUserUpdate.type === 'none') return -1;
    if (firstUserUpdate.update === 'both') {
      if (secondUserUpdate.update === 'both') return 0;
      return -1;
    }
    if (secondUserUpdate.update === 'both') {
      return 1;
    }
    return 0;
  } else {
    if (secondUserUpdate.type === 'none') return 0;
    return 1;
  }
};

const sortCheckedFirst = (userTableRows: HTMLTableRowElement[], localData: ReciprocityStorage) => {
  userTableRows.sort((firstRow, secondRow) => {
    const firstChecked = isUserChecked(firstRow);
    const secondChecked = isUserChecked(secondRow);
    if (firstChecked && !secondChecked) return -1;
    if (secondChecked && !firstChecked) return 1;

    const firstHidden = isUserHidden(firstRow, localData);
    const secondHidden = isUserHidden(secondRow, localData);
    if (secondHidden && !firstHidden) return -1;
    if (firstHidden && !secondHidden) return 1;

    const firstUpdates = getUserUpdates(firstRow, localData);
    const secondUpdates = getUserUpdates(secondRow, localData);
    return compareUserUpdates(firstUpdates, secondUpdates);
  }).forEach(val => val.parentNode?.appendChild(val));
};

const HIDE_BUTTON_STYLE = 'margin: 10px; max-height: 25px;';

const getHideButton = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage) => {
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
    process(userTableRow.parentElement as HTMLTableSectionElement);
  });

  return button;
};

const getUnhideButton = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage) => {
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
    process(userTableRow.parentElement as HTMLTableSectionElement);
  });

  return button;
};

const getMarkReadButton = (userTableRow: HTMLTableRowElement, localData: ReciprocityStorage) => {
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
    process(userTableRow.parentElement as HTMLTableSectionElement);
  });

  return button;
};

const SEPARATOR_ROW_STYLE = 'height: 10px; border-width: medium; border-style: solid; background-color: black;';

const UPDATED_FIELD_STYLE = 'background-color: green';

const hydrateSeparatorRow = (row: HTMLTableRowElement) => {
  row.setAttribute('class', 'hidden-separator');
  row.setAttribute('style', SEPARATOR_ROW_STYLE);
  row.insertCell();
};

const addUserTagButtons = (userTableRows: HTMLTableRowElement[], localData: ReciprocityStorage) => {
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

const setBioOverflowWrap = (userTableRows: HTMLTableRowElement[]) => {
  userTableRows.forEach(row => {
    const bioDiv = row.getElementsByClassName('bio')[0];
    bioDiv.setAttribute('style', OVERFLOW_WRAP_STYLE);
  });
};

const addSeparatorRow = (friendTable: HTMLTableSectionElement, localData: ReciprocityStorage) => {
  const firstHiddenRow = getUserTableRows(friendTable).findIndex(row => isUserHidden(row, localData));
  if (firstHiddenRow !== -1) {
    const separatorRow = friendTable.insertRow(firstHiddenRow);
    hydrateSeparatorRow(separatorRow);  
  }
};

const process = (friendTable: HTMLTableSectionElement) => {
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
  subtree:   true
});