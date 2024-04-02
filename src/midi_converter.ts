/**
 * Convert raw data to notes data.
 * Raw output is a sequence of triplet  time, duration, and note (t, d, n).
 * Note n combines pitch p and instrument k using a single value n = 128k + p.
 */
import MidiWriter from 'midi-writer-js'; // https://grimmdude.com/MidiWriterJS/docs/modules.html

const MAX_PITCH = 128.0
const DUR_OFFSET = 10000
const NOTE_OFFSET = 11000
const CONTROL_OFFSET = 27513
const VELOCITY = 72
const BEAT = 2

function offset(num) {
    if (num >= CONTROL_OFFSET) return num - CONTROL_OFFSET;
    return num;
}

/**
 * Convert each triplet in raw data into a note with 5 pieces of info. 
 * Conversion method see github.com/jthickstun/anticipation/blob/main/anticipation/convert.py.
 * Output is a list of list of numbers, where each inner list is a note formatted as 
 * [start, duration, pitch, instrument, velocity]. Start time and duration in unit of seconds.
 */
export function eventsToCompound(rawData) : number[][] {
    const notesData: number[][] = [];

    /* Iterate through each 3 note triplet. */
    for (let i = 0; i < rawData.length; i += 3) {
        const start = offset(rawData[i]);
        const duration = offset(rawData[i + 1]) - DUR_OFFSET;
        const pitch = (offset(rawData[i + 2]) - NOTE_OFFSET) % MAX_PITCH;
        const instrument = Math.floor((offset(rawData[i + 2]) - NOTE_OFFSET) / MAX_PITCH);
        notesData.push([start, duration, pitch, instrument, VELOCITY]);
    }

    return notesData;
}
    
export function compoundToMidi(notesData: number[][]) {
    /**
     * Create one midi track for each instrument.
     * Output map key/pair set: <Instrument midi class, track for that instrument >.
     */
    const instruMap = new Map<number, any>();
    for (let i = 0; i < notesData.length; i++) {
        const instrument = notesData[i][3];
        
        /* If we get encounter a new instrument, add a new MIDI track for it. */
        if (!instruMap.has(instrument)) {
            const track = new MidiWriter.Track();
            track.addEvent(new MidiWriter.ProgramChangeEvent({instrument: instrument}));
            instruMap.set(instrument, track);
        }
    }

    /**
     * For each note, add to corresponding track.
     */
    for (let i = 0; i < notesData.length; i++) {
        const [start, duration, pitch, instrument, velocity] = notesData[i];
        const track = instruMap.get(instrument);
        // https://github.com/grimmdude/MidiWriterJS/blob/master/src/midi-events/note-event.ts
        const note = new MidiWriter.NoteEvent({
            pitch: pitch, velocity: velocity, 
            tick: start * BEAT, tickDuration: duration * BEAT
        });
        track.addEvent(note);
    }

    /* Download file. */
    const writer = new MidiWriter.Writer(Array.from(instruMap.values()));
    const blob = new Blob([writer.buildFile()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twinkle.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// compoundToMidi(eventsToCompound([0, 10048, 11060, 50, 10048, 11060, 
//     100, 10048, 11067, 150, 10048, 11067, 200, 10048, 11069, 250, 10048, 11069, 
//     300, 10095, 11067, 400, 10048, 11065, 450, 10048, 11065, 500, 10048, 11064, 
//     550, 10048, 11064, 600, 10048, 11062, 650, 10048, 11062, 700, 10095, 11060]))