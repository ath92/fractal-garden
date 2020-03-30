import Regl from 'regl';
import frag from './frag.glsl';

const regl = Regl(); // no params = full screen canvas

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
        screenSize: regl.prop('screenSize')
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

regl.frame(() => {
    fullScreenFrag({
        color: [1, 0, 0, 1],
        screenSize: [window.innerWidth, window.innerHeight],
    });
});
