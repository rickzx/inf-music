/* Doc for Music Player: https://magenta.github.io/magenta-js/music */

var log_flag = true;

/**
 * Log message if in log mode.
 */
function log(msg) {
    if (log_flag) {
        document.getElementById('log').innerHTML += msg;
    }
}

/**
 * Download MIDI file.
 */
function download() {
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
function reload() {
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
function change() {
    var player = document.getElementById('midi-player');
    log(`Changing the MIDI to Tchaikovsky. Current: ${player.src}.<br>`);
    player.src = "asset/tchai.mid";
    reload();
}

/**
 * Move the timestamp to 60 seconds and start playing from it.
 */
function move() {
    var player = document.getElementById('midi-player');
    if (player.playing) {
        player.stop();
    }
    player.currentTime = 60;
    player.start();
    log(`Current playback position moved to 60s. <br>`);
}