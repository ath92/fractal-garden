import fragmentShader from './mandelbulb.glsl';
import setupRenderer from './renderer.js';
import headlessGL from "headless-gl";

const setup = (width = 1000, height = 1000) => {
    const repeat = [1, 1];
    const offsets = [];
    const container = headlessGL(width, height, { preserveDrawingBuffer: true });

    const renderer = setupRenderer({
        frag: fragmentShader,
        reglContext: container,
        repeat,
        offsets,
        width,
        height,
    });

    const renderFrame = (state) => {
        const steps = renderer.generateRenderSteps(state);
        let step = steps.next();
        while (!step.done) { // this shouldn't be necessary sine we shouldn't be generating more than one render step
            step = steps.next();
        }
        const fbo = step.value;
        renderer.drawToCanvas({ texture: fbo });

       return renderer.regl.read();
    }

    const renderFrames = (frames, fps = 60) => {
        const first = frames[0];
        const last = frames[frames.length - 1];
        const timespan = last.time - first.time;
        const numFrames = Math.ceil(timespan / (1000 / fps));

        for (let i = 0; i < numFrames; i++) {
            const time = i * (1000 / fps);
            const startFrameIndex = frames.findIndex((frame) => frame.time - first.time >= time);
            const startFrame = frames[startFrameIndex];
            const endFrame = frames[startFrameIndex + 1] || startFrame;
            const progress = (time - startFrame.time) / (endFrame.time - startFrame.time);
            
            // no interpolate all state

        }
    }

    return renderFrame;
};

export default setup;
