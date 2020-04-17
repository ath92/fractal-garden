import { vec3, mat4, vec4 } from 'gl-matrix';

const origin = vec3.fromValues(0, 0, 0);
const forward = vec3.fromValues(0, 0, 1);
const up = vec3.fromValues(0, 1, 0);
const rotateLeft = mat4.fromYRotation(mat4.create(), -0.5 * Math.PI);
const rotateRight = mat4.fromYRotation(mat4.create(), 0.5 * Math.PI);

function getTouchEventCoordinates(touchEvent) {
    const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
    return {
        x: lastTouch.clientX,
        y: lastTouch.clientY,
    }
}

export default class PlayerControls {
    constructor(speed = 0.015, mouseSensitivity = 0.0015, touchSensitivity = 0.08) {
        // TODO: cleanup event listeners
        this.speed = speed;
        this.mouseSensitivity = mouseSensitivity;
        this.touchSensitivity = touchSensitivity;
        this.position = vec3.fromValues(0, 0, -5);
        this.direction = vec3.fromValues(0, 0, 1);
        this.hasPointerLock = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.touchX = 0;
        this.touchY = 0;
        this.touchStartX = window.innerWidth / 2;
        this.touchStartY = window.innerHeight / 2;
        this.directionKeys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };
        this.isTouching = false;

        this.onPointerLock = () => {};

        this.handleKeyboardEvent = keyboardEvent => {
            const { code, type } = keyboardEvent;
            const value = type === 'keydown';
            if (code === 'KeyW' || code === 'ArrowUp') this.directionKeys.forward = value;
            if (code === 'KeyS' || code === 'ArrowDown') this.directionKeys.backward = value;
            if (code === 'KeyA' || code === 'ArrowLeft') this.directionKeys.left = value;
            if (code === 'KeyD' || code === 'ArrowRight') this.directionKeys.right = value;
        };

        document.addEventListener('keydown', this.handleKeyboardEvent);
        document.addEventListener('keyup', this.handleKeyboardEvent);

        document.addEventListener('mousedown', e => {
            console.log(e.target)
            if (e.target.tagName === 'A') {
                return;
            }
            document.querySelector('body').requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.hasPointerLock = !!document.pointerLockElement;
            this.onPointerLock(this.hasPointerLock);
        }, false);

        document.addEventListener('mousemove', e => {
            if (!this.hasPointerLock) return;
            this.mouseX += e.movementX;
            this.mouseY += e.movementY;
        });

        document.addEventListener('touchstart', e => {
            this.directionKeys.forward = true;
            this.isTouching = true;
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
            this.touchStartX = x;
            this.touchStartY = y;
            this.onPointerLock(true);
        });

        document.addEventListener('touchmove', e => {
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
            console.log('happening');
        });

        const onTouchOver = () => {
            this.directionKeys.forward = false;
            this.isTouching = false;
        }

        document.addEventListener('touchend', onTouchOver);
        document.addEventListener('touchcancel', onTouchOver);
        document.addEventListener('mouseup', onTouchOver);

        requestAnimationFrame(() => this.loop());
    }
    
    loop() {
        if (this.isTouching) {
            this.mouseX += (this.touchX - this.touchStartX) * this.touchSensitivity;
            this.mouseY += (this.touchY - this.touchStartY) * this.touchSensitivity;
        }

        const newDirection = vec3.clone(forward);
        vec3.rotateX(newDirection, newDirection, origin, -this.mouseY * this.mouseSensitivity);
        vec3.rotateY(newDirection, newDirection, origin, this.mouseX * this.mouseSensitivity);
        vec3.copy(this.direction, newDirection);
    
		const deltaPosition = vec3.clone(newDirection);
    
        // strafing with keys
        const diff = vec3.create();
        const flat = vec3.normalize(vec3.create(), vec3.fromValues(deltaPosition[0], 0, deltaPosition[2]));
        if (this.directionKeys.forward) vec3.add(diff, diff, deltaPosition);
        if (this.directionKeys.backward) vec3.add(diff, diff, vec3.negate(vec3.create(), deltaPosition));
        if (this.directionKeys.left) vec3.add(diff, diff, vec3.transformMat4(vec3.create(), flat, rotateLeft));
        if (this.directionKeys.right) vec3.add(diff, diff, vec3.transformMat4(vec3.create(), flat, rotateRight));
        vec3.normalize(diff, diff);
        vec3.scale(diff, diff, this.speed);
    
        vec3.add(this.position, this.position, diff);
    
        requestAnimationFrame(() => this.loop());
    }

    get directionMatrix() {
        return mat4.targetTo(
            mat4.create(),
            this.position,
            vec3.sub([], this.position, this.direction),
            up
        );
    }
}
