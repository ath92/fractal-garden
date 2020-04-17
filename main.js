import Regl from 'regl';
import frag from './frag.glsl';
import PlayerControls from './player-controls';

const playerControls = new PlayerControls();

playerControls.onPointerLock = val => {
    const message = document.querySelector('.message');
    if (val && message) {
        message.remove();
    }
}

const regl = Regl({
    // 720p should be enough for most intents and purposes, above that performance suffers
    pixelRatio: Math.min(1, 1600 * 900 / (window.innerWidth * window.innerHeight)),
}); // no params = full screen canvas

const fullScreenFrag = regl({
    frag,
    vert: `
        precision mediump float;
        attribute vec2 position;
        void main() {
            gl_Position = vec4(position, 0, 1);
        }`,
    uniforms: {
        color: regl.prop('color'),
        screenSize: regl.prop('screenSize'),
        time: regl.prop('time'),
        cameraPosition: regl.prop('cameraPosition'),
        cameraDirection: regl.prop('cameraDirection'),
    },
    attributes: {
        position: regl.buffer([
            [-1, -1],
            [1, -1],
            [1,  1],
            [-1, -1],   
            [1, 1,],
            [-1, 1]
        ])
    },
    count: 6,
});

regl.frame(({ time, viewportWidth, viewportHeight }) => {
    fullScreenFrag({
        color: [1, 0, 0, 1],
        screenSize: [viewportWidth, viewportHeight],
        time,
        cameraDirection: playerControls.directionMatrix,
        cameraPosition: playerControls.position
    });
});
