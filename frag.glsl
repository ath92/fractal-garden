precision mediump float;
uniform vec4 color;
uniform vec2 screenSize;

const int MAX_ITER = 120;
const float HIT_THRESHOLD = 0.0001;

vec3 getRay() {
    // normalize fragCoord.xy to vec2 ranging from [-1, -1] to [1, 1]
    vec2 pixel = (gl_FragCoord.xy - 0.5 * screenSize) / max(screenSize.x, screenSize.y);
    // normalize to get unit vector
    return normalize(vec3(pixel.x, -pixel.y, 1));
}

float sphere(vec3 p, vec3 c, float radius) { // p = point in space, c = center of sphere
    return distance(c, p) - radius;
}

float floor(vec3 p, float y) {
    return y - p.y;
}

float doModel(vec3 p) {
    vec3 spherePosition = vec3(0, 0, 5);
    float sphereRadius = 1.;
    float floorY = 5.;

    return min(sphere(p, spherePosition, 1.), floor(p, floorY));
}

void main() {

    // generate ray directions from origin based on gl_FragCoord
    // define model function (simple sphere to begin with)
    // vec3 from = origin;
    // loop (0 < i < MAX_ITER):
    //   distance = doModel(from)
    //   if (distance < THRESH) -> found intersection, break loop
    //   from += distance * direction
    // set gl_FragColor based on number of iterations (no lighting for now)

    vec3 origin = vec3(0);
    vec3 position = origin;
    vec3 direction = getRay();

    int numIterations = 0;

    for(int i = 0; i < MAX_ITER; i++) {
        numIterations = i;
        float d = doModel(position);
        if (d < HIT_THRESHOLD) break; // here I could compute a color
        position += d * direction;
    }

    gl_FragColor = vec4(vec3(1. - float(numIterations) / float(MAX_ITER)), 1.);
}

// lighting and material