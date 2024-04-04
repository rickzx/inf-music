import * as converter from './midi_converter.ts';
import * as mm from '@magenta/music/esm/core.js';

export class MIDILoader {
  currCompounds: number[][];
  currDataUrl: string;
  currTime: number;

  constructor() {
    this.reset();
  }

  reset() {
    this.currCompounds = []
    this.currTime = 0;
  }

  addEventTokens(rawData: number[]): void {
    let comp = converter.eventsToCompound(rawData, this.currTime);
    this.currCompounds = [...this.currCompounds, ...comp];
    this.currTime = comp[comp.length - 1][0];
    console.log("Current generated time: " + this.currTime);
    this.currDataUrl = converter.compoundToMidi(this.currCompounds);
  }

  getMIDIData(): string {
    return this.currDataUrl;
  }

  async downloadMIDIBlob(filename: string): Promise<void> {
    const blob = await mm.urlToBlob(this.currDataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}