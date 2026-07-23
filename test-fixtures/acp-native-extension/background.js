chrome.runtime.onInstalled.addListener(() => {
  console.info("Axhub ACP Native Host smoke-test extension installed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "run_acp_native_smoke_test") return false;
  chrome.runtime.sendNativeMessage(
    "com.axhub.acp.nativehost",
    {
      type: "start_acp_ui",
      requestId: message.requestId,
      payload: { extensionOrigin: `chrome-extension://${chrome.runtime.id}` },
    },
    (response) => {
      sendResponse({
        extensionId: chrome.runtime.id,
        response: response ?? null,
        lastError: chrome.runtime.lastError?.message ?? null,
      });
    },
  );
  return true;
});
