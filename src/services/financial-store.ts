type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribeFinancialStore(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyStoreChange() {
  listeners.forEach((l) => l());
}
