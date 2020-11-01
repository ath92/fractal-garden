import headlessRenderer from '../headless.js';
import express from "express";
import cors from "cors";
import { writePngFile, writePngFileSync } from "node-libpng";
import fs from "fs";
import cuid from "cuid";
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const port = 3000;

const width = 1920;
const height = 1080;

const transformFrames = (frames) => {
    return frames.map(frame => {
        return {
            ...frame,
            state: {
                ...frame.state,
                cameraDirection: Object.values(frame.state.cameraDirection), // turn from object with string indices into array
            }
        }
    })
}

app.get('/', (req, res) => {

  res.send('Hello World!')
});

app.post('/render/:fractal', async (req, res) => {
    console.log(req.params);
    const headless = headlessRenderer(req.params.fractal, width, height);
    // console.log(req.body);
    const frames = headless.renderFrames(transformFrames(req.body?.frames));
    const dir = `./render-results/${cuid()}`;

    console.log("going to render", frames.length, "frames");

    fs.mkdirSync(dir);
    (function step(i = 0) {
        const start = Date.now();
        console.log("start frame", Date.now() - start);
        let { value: frame, done } = frames.next();
        console.log("done rendering", Date.now() - start);
        if (done) return;
        const data = Buffer.from(frame);
        console.log("created buffer", Date.now() - start);
        console.log(data);
        writePngFileSync(`${dir}/frame-${i}.png`, data, {
            width,
            height,
        });
        console.log("wrote file", Date.now() - start);
        step(i + 1);
    })();

    console.log("finished rendering images");

    res.send('Great success!');
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})