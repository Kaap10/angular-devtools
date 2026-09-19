// Track which tabs have Angular detected
const angularTabs = new Map()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'angular-detected-from-page' && sender.tab) {
    angularTabs.set(sender.tab.id, {
      version: message.version,
      timestamp: Date.now(),
    })

    // Notify devtools panel
    chrome.runtime.sendMessage({
      type: 'angular-detected',
      tabId: sender.tab.id,
      version: message.version,
    }).catch(() => {
      // devtools not open yet — that's fine
    })
  }

  if (message.type === 'is-angular-page') {
    const info = angularTabs.get(message.tabId)
    sendResponse({ isAngular: !!info, version: info?.version })
    return true
  }
})

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  angularTabs.delete(tabId)
})
