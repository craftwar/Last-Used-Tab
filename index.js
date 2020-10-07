/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const DEFAULT = "Ctrl+Shift+1";
const debugging = false;

// recents windowId -> recentArray (new ... old)
let recents = new Map();
let recentsLimit = 20;

let debug_log;
if (debugging)
  debug_log = console.log;
else
  debug_log = () => { };

// callback for "go to last tab" shortcut
function shortcutHit() {
  debug_log("shortcutHit() begin");
  // load the current window
  var getting = browser.windows.getCurrent();
  getting.then((windowInfo) => {
    if (windowInfo.type != "normal") {
      debug_log(`Current window is of type '${windowInfo.type}', ignoring`);
      return;
    }
    const recentArray = recents.get(windowInfo.id);
    if (recentArray) {
      debug_log("Activating tab id ", recentArray[1]);
      browser.tabs.update(recentArray[1], {
        active: true
      });
    } else {
      debug_log(`Nothing known about ${windowInfo.id}`);
    }
  }, onError);
  debug_log("shortcutHit() end");
}

// callback when a tab is activated
function tabActivated(tabInfo) {
  debug_log("tabActivated(tabInfo) begin", tabInfo.tabId, tabInfo.windowId);
  const recentArray = recents.get(tabInfo.windowId);
  if (recentArray) {
    const index = recentArray.indexOf(tabInfo.tabId);
    // not new tab
    if (index != -1)
      recentArray.splice(index, 1);
    else if (recentArray.length >= recentsLimit)
      recentArray.pop();
    recentArray.unshift(tabInfo.tabId);
  } else {
    recents.set(tabInfo.windowId, [tabInfo.tabId, tabInfo.previousTabId]);
  }
  debug_log("tabActivated(tabInfo) end");
}

function tabRemoved(tabId, removeInfo) {
  debug_log("tabRemoved(tabId, removeInfo) begin");
  // the window has been destroyed, so we can stop tracking tabs for it
  if (removeInfo.isWindowClosing) {
    debug_log(`Window ${removeInfo.windowId} deleted, removing key.`);
    recents.delete(removeInfo.windowId);
  } else {
    const recentArray = recents.get(removeInfo.windowId);
    if (recentArray) {
      const index = recentArray.indexOf(tabId);
      if (index != -1)
        recentArray.splice(index, 1);
    }
  }
  debug_log("tabRemoved(tabId, removeInfo) end");
}

// General error handler, logs the error for debugging.
function onError(error) {
  debug_log(`Error: ${error}`);
}

// Hook the keyboard shortcut
browser.commands.onCommand.addListener((command) => {
  switch (command) {
    case "most-recent-tab-command":
      shortcutHit();
      break;
    default:
      debug_log("onCommand event received unknown message: ", command);
  };
});

function updateFromOptions() {
  var gettingItem = browser.storage.local.get("shortcut");
  return gettingItem.then((res) => {
    let shortcut = res.shortcut || DEFAULT;
    debug_log("Updating command: " + shortcut);

    browser.commands.update({
      name: "most-recent-tab-command",
      shortcut: shortcut
    });
  });
}

// xxx, don't use storage change to update option
browser.storage.onChanged.addListener(updateFromOptions);

// hook to track tab changes
browser.tabs.onActivated.addListener(tabActivated);
browser.tabs.onRemoved.addListener(tabRemoved);

// hook the toolbar icon
browser.browserAction.onClicked.addListener(shortcutHit);

// hook the external message API to allow other addons to trigger the action
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => { shortcutHit(); return false });

updateFromOptions();
