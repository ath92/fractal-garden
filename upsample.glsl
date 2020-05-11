precision highp float;
uniform sampler2D sample;
uniform sampler2D previous;
uniform vec2 offset;
uniform vec2 repeat;
uniform vec2 screenSize;

const vec2 pixelOffset = vec2(0.5, 0.5);

float getMixFactor (vec2 position) {
    vec2 rest = mod(position, repeat);
    vec2 diff = abs(rest - offset);
    return 1. - min(max(diff.x, diff.y), 1.);
}

void main () {
    vec2 position = gl_FragCoord.xy - pixelOffset;
    vec2 pixel = position / screenSize;

    vec4 previousColor = texture2D(previous, pixel);
    vec4 newColor = texture2D(sample, pixel);

    gl_FragColor = mix(previousColor, newColor, getMixFactor(position));
}