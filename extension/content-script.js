// Inject a page-level script to detect Angular, since content scripts
// can't access the page's JS globals directly.

const script = document.createElement('script')
script.src = chrome.runtime.getURL('detect-angular.js')
script.onload = () => script.remove()
;(document.head || document.documentElement).appendChild(script)

// Listen for the detection result posted from the page context
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.type === '__NG_DEVTOOLS_ANGULAR_DETECTED__') {
    chrome.runtime.sendMessage({
      type: 'angular-detected-from-page',
      version: event.data.version,
    })
  }
})
