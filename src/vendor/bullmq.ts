export class Queue {
  constructor(_name: string, _opts?: any) {}
  async add(_name: string, _data: any, _opts?: any) {
    return {};
  }
}

export class Worker {
  constructor(_name: string, _processor: any, _opts?: any) {}
  on(_event: string, _cb: any) {
    // noop for tests
  }
}

export class QueueScheduler {
  constructor(_name: string, _opts?: any) {}
}

export type Job = any;
