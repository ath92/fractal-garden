import PlayerControls from './player-controls';

class Controller {
    constructor() {
        Object.assign(this, {
            scrollY: 0,
            scrollX: 0,
        });
        this.playerControls = new PlayerControls();
        window.addEventListener("wheel", e => {
            this.scrollY += e.deltaY / 1000;
            this.scrollX += e.deltaX / 1000;
        });
    }

    get state() {
        return {
            scrollY: this.scrollY,
            scrollX: this.scrollX,
            cameraPosition: [...this.playerControls.position],
            cameraDirection: this.playerControls.directionMatrix,
        }
    }
}

export default Controller;