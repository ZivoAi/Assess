declare module 'bullmq' {
  export class Queue {
    constructor(name: string, opts?: any);
    add(name: string, data: any, opts?: any): Promise<any>;
  }

  export class Worker {
    constructor(name: string, processor: any, opts?: any);
    on(event: string, cb: any): void;
  }

  export class QueueScheduler {
    constructor(name: string, opts?: any);
  }

  export type Job = any;
}
