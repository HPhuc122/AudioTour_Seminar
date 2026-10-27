export class UniqueQueue<T extends { id: number }> {
  private items: T[] = [];
  add(item: T) { if (this.items.some(i => i.id === item.id)) return false; this.items.push(item); return true; }
  shift() { return this.items.shift(); }
  clear() { this.items = []; }
  get size() { return this.items.length; }
}
