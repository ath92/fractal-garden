precision highp float;
precision mediump sampler2D;
uniform sampler2D sample;
uniform sampler2D previous;
uniform vec2 offset;
uniform vec2 repeat;
uniform vec2 screenSize;

const vec2 pixelOffset = vec2(0.499);

vec2 modulo (vec2 a, vec2 b) {
    vec2 d = floor(a / b);
    vec2 q = d * b;
    return a - q;
}

float getMixFactor (vec2 position) {
    vec2 rest = modulo(position, repeat);
    vec2 diff = abs(rest - (offset));
    return 1. - min(max(diff.x, diff.y), 1.);
}

void main () {
    vec2 position = gl_FragCoord.xy - pixelOffset;
    vec2 pixel = position / screenSize;

    vec4 previousColor = texture2D(previous, pixel);
    vec4 newColor = texture2D(sample, pixel);

    gl_FragColor = mix(previousColor, newColor, getMixFactor(position));
}

// 1, 3 position
// 1, 0 offset
// 3, 3 repeat

// 1, 0 rest
// 0, 0 diff
// 0 mix factor

// 1 - 3 * floor(1/3) = 0 -> want it to be 2
// 3 - 3

// 0, 3 = 0 -> 0 - 3 * floor (0 / 3) = 0
// 1, 3 = 1 -> 1 - 3 * floor (1 / 3) = 1;
// 2, 3 = 2 -> 2 - 3 * floor (2 / 3) = 2
// 3, 3 = 0 -> 3 - 3 * floor (3 / 3) = 0
// 4, 3 = 1 -> 4 - 3 * floor (4 / 3) = 1
// 5, 3 = 2
// 6, 3 = 0
// 7, 3 = 1

// 1, 3 -> 1, 0


// 2, 3 position
// 2, 0 offset
// 3, 3 repeat

// restX = mod(2, 3) = 2 - 3 * floor(2 / 3) = 2
// restY = mod(3, 3) = 3 - 3 * floor(3 / 3) = 0
// 2, 0 rest
// diff = (2, 0) - (2, 0) = (0, 0)
// 1 - min(max(0,0), 1) = 0