import * as webllm from "@mlc-ai/web-llm";
import { CONTROL_OFFSET, DUR_OFFSET, NOTE_OFFSET, ANOTE_OFFSET, SPECIAL_OFFSET, TIME_OFFSET } from "./music_transformer_vocab";
import { MAX_DUR, MAX_NOTE, MAX_TIME, MAX_INSTR, MAX_PITCH } from "./music_transformer_config";

// Define LogitProcessor
export class MusicLogitProcessor implements webllm.LogitProcessor {
    // Only stores the generated tokens, excluding the prompts (e.g. 55026, or the 510-token prompt)
    public tokenSequence: Array<number> = [];
    public curTime: number = 0;
    public instrumentSet: number[] = [];
    public notesSinceLast: { [key: number]: number } = {};
    public ensembleDensity: number = 0.0;

    // TODO: unsure about the performance of all these for loops
    processLogits(logits: Float32Array): Float32Array {
        // Directly from https://github.com/jthickstun/anticipation/blob/main/anticipation/sample.py
        // `safe_logits()`
        // 1. Don't generate controls
        for (var i = CONTROL_OFFSET; i < SPECIAL_OFFSET; i++) {
            logits[i] = Number.NEGATIVE_INFINITY;
        }
        // 2. Don't generate special tokens
        for (var i = SPECIAL_OFFSET; i < logits.length; i++) {
            logits[i] = Number.NEGATIVE_INFINITY;
        }
        // 3. Don't generate stuff in the wrong slot of the triplet
        // the index of the token we are about to generate
        const curIdx = this.tokenSequence.length;
        if (curIdx % 3 == 0) {
            // Generate time
            for (var i = DUR_OFFSET; i < DUR_OFFSET + MAX_DUR; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
            for (var i = NOTE_OFFSET; i < NOTE_OFFSET + MAX_NOTE; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
        } else if (curIdx % 3 == 1) {
            // Generate duration
            for (var i = TIME_OFFSET; i < TIME_OFFSET + MAX_TIME; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
            for (var i = NOTE_OFFSET; i < NOTE_OFFSET + MAX_NOTE; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
        } else {
            // Generate note
            for (var i = TIME_OFFSET; i < TIME_OFFSET + MAX_TIME; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
            for (var i = DUR_OFFSET; i < DUR_OFFSET + MAX_DUR; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
        }

        // `future_logits()` -- do not sample events in the past
        if (this.curTime > 0) {
            for (var i = TIME_OFFSET; i < TIME_OFFSET + this.curTime; i++) {
                logits[i] = Number.NEGATIVE_INFINITY;
            }
        }

        // `instr_logits()`
        const instrs = getInstruments(this.tokenSequence);
        if (Object.keys(instrs).length >= 15) {
            for (let instr = 0; instr < MAX_INSTR; instr++) {
                if (!(instr in instrs)) {
                    for (var i = NOTE_OFFSET + instr * MAX_PITCH; i < NOTE_OFFSET + (instr + 1) * MAX_PITCH; i++) {
                        logits[i] = Number.NEGATIVE_INFINITY;
                    }
                }
            }
        }

        if (this.instrumentSet.length > 0) {
            for (var i = NOTE_OFFSET; i < NOTE_OFFSET + MAX_NOTE; i++) {
                const instr = Math.floor((i - NOTE_OFFSET) / MAX_PITCH);
                if (!this.instrumentSet.includes(instr)) {
                    logits[i] = Number.NEGATIVE_INFINITY;
                } else {
                    if (this.notesSinceLast[instr] > 0) {
                        logits[i] += this.ensembleDensity * this.notesSinceLast[instr];
                    }
                }
            }
        }

        return logits;
    }

    processSampledToken(token: number): void {
        // Update the time if we generated a time token
        const curIdx = this.tokenSequence.length;  // the index that `token` will become
        if (curIdx % 3 == 0) this.curTime = token;
        if (curIdx % 3 == 2) {
            const curInstr = Math.floor((token - NOTE_OFFSET) / MAX_PITCH);
            if (this.instrumentSet.length > 0) {
                for (let instr of this.instrumentSet) {
                    this.notesSinceLast[instr] = (this.notesSinceLast[instr] || 0) + 1;
                }
                this.notesSinceLast[curInstr] = 0;
            }
            console.log("Notes since last: ", this.notesSinceLast);
            console.log("Sampled instrument: ", curInstr);
        }
        this.tokenSequence.push(token);
    }

    resetState(): void {
        this.tokenSequence = [];
        this.notesSinceLast = {};
        this.curTime = 0;
    }

    setInstrumentSet(instrs: number[]): void {
        this.instrumentSet = instrs;
    }

    setEnsembleDensity(ensembleDensity: number): void {
        this.ensembleDensity = ensembleDensity;
    }
}

interface InstrumentsMap {
    [key: number]: number;
}

function getInstruments(tokens: number[]): InstrumentsMap {
    const instruments: InstrumentsMap = {};
    for (let i = 2; i < tokens.length; i += 3) {
        let note = tokens[i];

        if (note >= SPECIAL_OFFSET) continue;

        if (note < CONTROL_OFFSET) {
            note -= NOTE_OFFSET;
        } else {
            note -= ANOTE_OFFSET;
        }

        const instr = Math.floor(note / Math.pow(2, 7));
        instruments[instr] = (instruments[instr] || 0) + 1;
    }

    return instruments;
}