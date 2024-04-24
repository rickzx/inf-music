/**
 * Convert MIDI file into compound data.
 * Compound data is a sequence of triplet time, duration, and note (t, d, n).
 * Note n combines pitch p and instrument k using a single value n = 128k + p.
 */
import { MAX_DUR, MAX_PITCH, TIME_RESOLUTION } from './music_transformer_config'
import { DUR_OFFSET, NOTE_OFFSET, SEPARATOR, TIME_OFFSET } from './music_transformer_vocab';

/**
 * Take in JSON string, returns a list of list, where each inner list is a compound 
 * representing one note event.
 */
export function midiToCompound(midiFile) {
    const midi = JSON.parse(midiFile);
    const compounds: number[][] = [];
    midi.tracks.forEach(track => {
        // 9 reserved for drums (midi = 128)
        const instrument = track.channel == 9 ? 128 : track.instrument.number;
        const notes = track.notes
        notes.forEach(note => {
            compounds.push([
                Math.round(TIME_RESOLUTION * note.time), // start time
                Math.round(TIME_RESOLUTION * note.duration), // duration
                note.midi, // pitch
                instrument
            ]);
        })
    })

    // Sort by start time
    compounds.sort((a, b) => {
        return a[0] - b[0];
    });

    return compounds;
}


/**
 * Take in a list of list, where each inner list is a compound representing 
 * one note event. Process each compound and generate a list of tokens (ints).
 */
export function compoundToEvents(compounds) {
    const events: number[] = [];
    const start = 0, dur = 1, pitch = 2, instr = 3;

    for (let i = 0; i < compounds.length; i++) {
        const compound = compounds[i];

        // Append start time
        const startTime = TIME_OFFSET + compound[start];
        events.push(Math.round(startTime));

        // Get duration
        var duration = DUR_OFFSET;
        if (compound[dur] == -1) {
            duration += TIME_RESOLUTION / 4;
        } else {
            duration += Math.min(MAX_DUR - 1, compound[dur]);
        }
        events.push(Math.round(duration));

        // Combine note and instrument
        var note = NOTE_OFFSET;
        if (compound[pitch] == -1) {
            note += SEPARATOR;
        } else {
            note += MAX_PITCH * compound[instr] + compound[pitch];
        }
        events.push(Math.round(note));

    }

    return events;
}


/**
 * Input is a JSON of a midi file. Upload MIDI at tonejs.github.io/Midi/ 
 * to see the json string.
 * Returns an array of numbers, where every triplet represents one note.
 */
export function midiToEvents(midiFile) {
    return compoundToEvents(midiToCompound(midiFile));
}
