import { SerialQueue } from './serialQueue';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('SerialQueue', () => {
  it('runs tasks one at a time, in the order they were queued', async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
      return name;
    };
    const results = await Promise.all([queue.run(task('a')), queue.run(task('b')), queue.run(task('c'))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
  });

  it('rejects only the failing task, and runs the ones behind it', async () => {
    const queue = new SerialQueue();
    const failure = new Error('boom');
    const failed = queue.run(async () => {
      throw failure;
    });
    const next = queue.run(async () => 'next');
    await expect(failed).rejects.toBe(failure);
    await expect(next).resolves.toBe('next');
  });
});
