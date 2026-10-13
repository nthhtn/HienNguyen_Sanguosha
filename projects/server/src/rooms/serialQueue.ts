// Runs tasks one at a time, in the order they were queued. A failing task
// rejects its own promise and doesn't hold up the ones behind it.
// `run` queues synchronously: two calls made in a row run in that order.
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
