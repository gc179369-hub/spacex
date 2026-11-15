type Release = () => void;

/**
 * Pawchive asks automated download clients to start no more than one request
 * per second and to keep no more than five file transfers active.
 */
class PawchiveDownloadGate {
  private activeTransfers = 0;
  private readonly transferWaiters: Array<() => void> = [];
  private nextRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();

  async acquireTransfer(): Promise<Release> {
    if (this.activeTransfers >= 5) {
      await new Promise<void>((resolve) => this.transferWaiters.push(resolve));
    } else {
      this.activeTransfers += 1;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.transferWaiters.shift();
      if (next) {
        // Transfer the occupied slot directly to the next queued download.
        next();
      } else {
        this.activeTransfers = Math.max(0, this.activeTransfers - 1);
      }
    };
  }

  async waitForRequestTurn(): Promise<void> {
    const previousTurn = this.requestQueue;
    let releaseTurn: Release = () => {};
    this.requestQueue = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });

    await previousTurn;
    try {
      const delayMs = Math.max(0, this.nextRequestAt - Date.now());
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      this.nextRequestAt = Date.now() + 1000;
    } finally {
      releaseTurn();
    }
  }
}

export const pawchiveDownloadGate = new PawchiveDownloadGate();
