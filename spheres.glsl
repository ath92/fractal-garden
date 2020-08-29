precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;

const int MAX_ITER = 40;
const float HIT_THRESHOLD = 0.000001;
const float variance = 0.01;
// const float PI = 3.14159265359;


vec3 getRay() {
    vec2 normalizedCoords = gl_FragCoord.xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // as if the higher the pixel value, the more the offset is being applied
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, pixel.y, 1, 0))).xyz;
}

float sphere(vec3 p, float radius) {
    return length(p) - radius;
}

float hollowSphere(vec3 p, float radius, float thickness) {
    float outer = sphere(p, radius);
    float inner = sphere(p, radius - thickness);
    // inner will be bigger outside itself
    // and bigger inside itself
    // we only want to use it when it's smaller than zero
    float combined = max(outer, -inner);
    return combined;
}

float box(vec3 p, vec3 box) {
  vec3 q = abs(p) - box;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

vec3 yRotate(vec3 p, float a) {
    float cosa = cos(a);
    float sina = sin(a);
    return vec3(
        cosa * p.x + -sina * p.z,
        p.y,
        cosa * p.z + sina * p.x
    );
}

float doModel(vec3 p) {
    float distance = 99999.;
    for (float i = 0.; i < 6.; i++) {
        vec3 p2 = yRotate(p, i / 3. + 0.5 * cos(time / 1000. + i / 0.1 * i) - 1.5);
        float r = 3. - i / 2.;
        float s = hollowSphere(p2, r, 0.2);
        float b = box(p2 - vec3(0,0,r), vec3(r));
        distance = min(distance, max(b, s));
    }
    return distance;
}
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
vec3 trace(vec3 origin, vec3 direction, out int iterations) {
    vec3 position = origin;
    for(int i = 0; i < MAX_ITER; i++) {
        iterations = i;
        float d = doModel(position);
        if (d < HIT_THRESHOLD) break;
        position += d * direction;
    }
    return position;
}

// vec3 lightDirection = normalize(vec3(1, -1, -1));
float getIllumination(vec3 collision, int iterations) {
    // vec3 n = calcNormal(collision);
    float occlusionLight = 1. - float(iterations) / float(MAX_ITER);
    return occlusionLight;
    // return dot(n, lightDirection);
}

// const float col = 0.05; // amount of coloring

void main() {
    vec3 direction = getRay();
    // gl_FragColor = vec4(offset / (repeat - vec2(1)), 0, 1);
    // return;

    float brightness = 0.;
    int iterations;
    vec3 collision = trace(cameraPosition, direction, iterations);
    if (iterations < MAX_ITER - 1) { // actual collision
        brightness = getIllumination(collision, iterations);
    }
    gl_FragColor = vec4(
        brightness,
        brightness,
        brightness,
        1.
    );
}