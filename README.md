
<h1 align="center">Fractal.garden</h1>
<p align="center">
  <a href="https://fractal-garden.netlify.app">Explore fractals in your browser in real time</a>
  <br />
  <br />    
  <img src="readme.gif" alt="animated" />
</p>

Fractal.garden is an interactive 3d fractal explorer. The fractals are rendered using a technique called [raymarching](https://www.iquilezles.org/www/articles/raymarchingdf/raymarchingdf.htm). The images are rendered at mostly acceptable framerates using WebGL (through a library called [regl](https://github.com/regl-project/regl)). 


This project also contains a headless rendering server, which can turn a set of frame states (each of which contains exactly the state needed to render an image) into a set of png images, one per frame. These can then be combined into a video (or the gif in this readme) using ffmpeg. Note that this server is quite unoptimized, so it takes a long time to render everything (i.e. much longer than the renderer in the browser would).

## Installation

To install, you need a system with node installed (tested on 10.x.x, anything above that should definitely be okay). Run `npm install` and then any of the folling

```
# will start a dev server (parcel)
npm run dev

# will build the project
npm run build

# will start a render server that renders pngs to the filesystem
npm run server
```

## Usage

Running `npm run dev` will start a development server at `http://localhost:1234` by default. When you open this in your local browser, you'll see effectively the same as you would at `https://fractal.garden`. The page itself provides some further instruction on how to actually use the application.

### Recording

Locally, you can run `npm run server` to start a render server alongside the dev server. Once this server is running, you can head back to your browser tab that's running your local fractal explorer. When you press `r` once while flying around, your browser will start recording all of the updates to your position, direction, and any other relevant piece of state needed to render a frame. After pressing `r` a second time, the browser sends this collection of frames to the server, which proceeds to render all of the frames required to individual PNGs inside the `render-results` folder. 

Notice that this is a somewhat janky approach; There's no preview of what has been recorded, and no animation tools to speak of. You pretty much just get what you see as you fly through the fractal. The upside is that the server gets more time than the browser to render each frame, so it always renders each frame at a nice resolution (1080p) and at a constant framerate. The browser may not send its frames at a constant framerate because there may be hiccups during rendering, so the server also interpolates between the frames to smoothen things out.

Also notice that this doesn't actually give you a full video, it just gives you a set of pngs. The file `ffmpeg.txt` has some convenient commands for ffmpeg that will convert the PNGs into a video, and subsequently flip the video vertically because for some reason, our headless webgl environment has a flipped y-axis compared to the browser, and I've been too lazy to just flip it in code.

