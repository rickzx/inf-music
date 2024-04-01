/* Doc for Music Player: https://magenta.github.io/magenta-js/music */
// import * as midis from './asset/*.mid';
import * as mm from '@magenta/music/esm/core.js';
import * as midis from 'url:./assets/*.mid';

var log_flag = true;

/**
 * Log message if in log mode.
 */
function log(msg: string) {
    if (log_flag) {
        document.getElementById('log').innerHTML += msg;
    }
}

/**
 * Download MIDI file.
 */
async function download() {
    var player = document.getElementById('midi-player');
    var download_file = document.createElement('a');
    download_file.href = player.src;
    download_file.download = 'demo.mid';
    download_file.click();
    download_file.remove();
    log(`MIDI file ${player.src} downloaded.<br>`);
}

/**
 * Reload the MIDI player.
 */
async function reload() {
    var player = document.getElementById('midi-player');
    var visualizer = document.getElementById('midi-visualizer');
    player.stop();
    player.reload();
    visualizer.reload();
    log("MIDI player reloaded.<br>");
}

/**
 * Change the MIDI file being played
 */
async function change(midi_src: string, midi_name: string) {
    var player = document.getElementById('midi-player');
    var visualizer = document.getElementById('midi-visualizer');
    log(`Changing the MIDI to ${midi_name}.<br>`);
    player.src = midi_src;

    let ns = await mm.urlToNoteSequence(midi_src);
    player.noteSequence = ns;
    visualizer.noteSequence = ns;
    reload();
}

/**
 * Move the timestamp to 60 seconds and start playing from it.
 */
async function move() {
    var player = document.getElementById('midi-player');
    if (player.playing) {
        player.stop();
    }
    player.currentTime = 60;
    player.start();
    log(`Current playback position moved to 60s. <br>`);
}

async function main() {
    console.log(midis);

    change(midis["ase"], 'Grieg')

    const reloadButton = document.getElementById("reloadButton");
    const downloadButton = document.getElementById("downloadButton");
    const switchButton = document.getElementById("switchButton");
    const moveButton = document.getElementById("moveButton");

    if (reloadButton) {
        reloadButton.addEventListener("click", async () => {
            reload()
        });
    }

    if (downloadButton) {
        downloadButton.addEventListener("click", async () => {
            download()
        });
    }

    if (switchButton) {
        switchButton.addEventListener("click", async () => {
            change(midis["tchai"], 'Tchaikovsky')
        });
    }

    if (moveButton) {
        moveButton.addEventListener("click", async () => {
            move()
        });
    }
}

main()