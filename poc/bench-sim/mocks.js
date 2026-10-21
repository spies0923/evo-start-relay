'use strict';
// BENCH MOCKS ONLY. None of these model Fortin firmware behaviour; they model the
// generic shape assumed by poc/controller/ so its safety logic can be tested
// offline. No serial protocol, pinout or electrical value here is real.

// Isolated output stage: released by default; a hardware monostable caps any
// pulse at maxPulseMs even if firmware never releases it.
class MockOutput {
  constructor({ maxPulseMs = 2000, onPulse = () => {} } = {}) {
    this.maxPulseMs = maxPulseMs; this.onPulse = onPulse;
    this.asserted = false; this.pulses = []; this.crashNext = false;
  }
  init() { this.asserted = false; }
  async pulse(ms) {
    if (this.crashNext) { this.crashNext = false; throw Object.assign(new Error('power lost'), { crash: true }); }
    const width = Math.min(ms, this.maxPulseMs);
    this.asserted = true; this.pulses.push(width); this.onPulse(width);
    this.asserted = false;
  }
}

// Generic toggle-on-pulse remote starter with a remote-start-active status line.
// `inhibited` stands for any condition under which a real starter refuses.
class MockRemoteStarter {
  constructor() { this.running = false; this.inhibited = false; this.statusWired = true; }
  onPulse() { if (!this.inhibited || this.running) this.running = !this.running; }
  statusSource() { return { read: () => (this.statusWired ? this.running : null) }; }
}

// NVS stand-in: JSON commits, optional crash injection.
class MockNvs {
  constructor() { this.data = null; this.failCommit = false; this.commits = 0; }
  load() { return this.data ? JSON.parse(this.data) : null; }
  commit(obj) { if (this.failCommit) throw new Error('flash write failed'); this.data = JSON.stringify(obj); this.commits++; }
}

// LTE/MQTT link stand-in: drops nothing while up, queues while down, can duplicate.
class MockLink {
  constructor(handler) { this.handler = handler; this.isUp = true; this.queue = []; this.duplicateNext = false; }
  setHandler(h) { this.handler = h; }
  async publish(frame) {
    if (!this.isUp) { this.queue.push(frame); return []; }
    const copies = this.duplicateNext ? 2 : 1; this.duplicateNext = false;
    const acks = [];
    for (let i = 0; i < copies; i++) acks.push(await this.handler(JSON.parse(JSON.stringify(frame))));
    return acks;
  }
  down() { this.isUp = false; }
  async up() { this.isUp = true; const q = this.queue; this.queue = []; const acks = []; for (const f of q) acks.push(...await this.publish(f)); return acks; }
}

module.exports = { MockOutput, MockRemoteStarter, MockNvs, MockLink };
