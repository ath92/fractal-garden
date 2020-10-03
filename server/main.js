import headlessRenderer from '../headless.js';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { writePngFile } from "node-libpng";
const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3000;

const width = 100;
const height = 100;
const headless = headlessRenderer(width, height);

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

app.post('/render', async (req, res) => {
    // console.log(req.body);
    const frames = headless.renderFrames(transformFrames(req.body?.frames));
    const data = Buffer.from(frames[frames.length - 1]);
    console.log(data);
    // fs.writeFileSync(`pic.png`, data, 'binary');
    await writePngFile("image.png", data, {
        width,
        height,
    });
    res.send('Great success!');
    /**
     * So basically:
it takes endTimeStamp - beginTimeStamp to get the whole timespan
Then picks points in time along that timespan so that it has 60fps
For each point, interpolate the state
With that interpolated state, render a frame to img file (e.g. png)
Then, once complete for all frames, encode into a video using ffmpeg
     */
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})