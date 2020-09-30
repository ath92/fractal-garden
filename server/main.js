import headlessRenderer from '../headless.js';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
console.log("hahaha", headlessRenderer)
const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3000;
app.get('/', (req, res) => {

  res.send('Hello World!')
});

app.post('/render', (req, res) => {
    console.log(req.body);
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