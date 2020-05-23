import { vec3 } from 'gl-matrix';

const spaceRepeat = vec3.fromValues(2.5, 2.5, 2.5);

/**
 * glsl mod
 * @param {number} x 
 * @param {number} y 
 */
const mod = (x, y) => x - y * Math.floor(x/y);

/**
 * space repetition
 * @param {vec3} p 
 * @param {vec3} distance 
 */
function opRepeat(p, distance) {
    return p.map((n, i) => {
        const d = distance[i];
        return mod((n + 0.5 * d), d) - 0.5 * d;
    });
}

/**
 * js implementation of mandelbulb distance function
 * @param {vec3} p 
 */
const getCurrentDistance = (p) => {
    const Power = 12.0;
    const pos = opRepeat(p, spaceRepeat);
	let z = vec3.clone(pos);
	let dr = 1.0;
	let r = 0.0;
	for (let i = 0; i < 10; i++) {
		r = vec3.length(z);
		if (r > 4) break;
		
		// convert to polar coordinates
		let theta = Math.acos(z[2] / r);
		let phi = Math.atan(z[1], z[0]);
		dr =  Math.pow(r, Power - 1) * Power * dr + 1.0;
		
		// scale and rotate the point
		const zr = Math.pow(r, Power);
		theta = theta * Power;
		phi = phi * Power;
		
		// convert back to cartesian coordinates
		vec3.scale(z, vec3.fromValues(Math.sin(theta) * Math.cos(phi), Math.sin(phi) * Math.sin(theta), Math.cos(theta)), zr);
        vec3.add(z, z, pos);
	}
	return 0.5 * Math.log(r) * r / dr;
}

export default getCurrentDistance;