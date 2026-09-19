// Wait for the background script to confirm Angular is detected on the page
chrome.runtime.sendMessage(
  { type: 'is-angular-page', tabId: chrome.devtools.inspectedWindow.tabId },
  (response) => {
    if (response?.isAngular) {
      createPanel()
    }
  },
)

// Also listen for late detection (SPA navigation after devtools open)
chrome.runtime.onMessage.addListener((message) => {
  if (
    message.type === 'angular-detected' &&
    message.tabId === chrome.devtools.inspectedWindow.tabId
  ) {
    createPanel()
  }
})

let panelCreated = false
function createPanel() {
  if (panelCreated) return
  panelCreated = true

  chrome.devtools.panels.create(
    'Angular DevTools',
    'icons/icon-128.png',
    'panel.html',
  )
}
