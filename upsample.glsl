precision highp float;
uniform sampler2D inputSample;
uniform sampler2D previous;
uniform vec2 offset;
uniform float step;
uniform float repeat;
uniform vec2 screenSize;

void main () {
    vec2 xy = gl_FragCoord.xy / screenSize;
    vec2 m = mod(gl_FragCoord.xy, repeat);

    vec4 current = texture2D(previous, xy);
    vec2 samplexy = xy + ((m - offset) / 2.) / screenSize;
    vec4 newSample = texture2D(inputSample, samplexy);

    // the first step fills the whole screen; later steps mostly affect pixels close to their offset,
    // and get less weight as more samples are accumulated
    float maxDist = sqrt(2. * repeat * repeat);
    float d = distance(m, offset) / maxDist;
    float dist = min(d, 1. - d);

    float weight = clamp(pow(1. - dist, pow(step, sqrt(2.) / 2.)), 0., 1.);
    gl_FragColor = mix(current, newSample, weight);
}
