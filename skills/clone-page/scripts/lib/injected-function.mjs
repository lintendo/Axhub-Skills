/**
 * Wrap browser inject scripts so leading file comments cannot trigger ASI after return.
 */
export function createInjectedFunctionBody(script) {
  if (typeof script !== 'string') {
    throw new TypeError('Injected script must be a string');
  }

  return `return (${script})`;
}

export function createInjectedFunction(script) {
  const fn = new Function(createInjectedFunctionBody(script))();
  if (typeof fn !== 'function') {
    throw new TypeError('Injected script must evaluate to a function');
  }
  return fn;
}
