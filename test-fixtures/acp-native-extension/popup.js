const runButton = document.querySelector("#run-smoke-test");
const result = document.querySelector("#smoke-test-result");

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  result.textContent = "Running...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "run_acp_native_smoke_test",
      requestId: crypto.randomUUID(),
    });
    result.textContent = JSON.stringify(response ?? null, null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    runButton.disabled = false;
  }
});
