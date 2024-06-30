interface IPosition {
    x: number,
    y: number
}

import "./zoom-any-js.css"

export default class ZoomAnyJs {
    // @ts-ignore
    #element: HTMLElement;
    #values = {
        x: 0,
        y: 0,
        zoom: 100
    }
    #onWheelListener;

    constructor(elementSelector: string = '.zoomable') {
        this.#selectElement(elementSelector)
        this.#onWheelListener = this.#onWheel.bind(this)
        this.addListeners()
        this.fitToBounds()
        this.apply()
    }

    #selectElement(elementSelector: string) {
        const queried = document.querySelector(elementSelector)
        if (queried === null) throw new Error("Zoom element not found")
        this.#element = queried as HTMLElement
        this.#element.classList.add("zoomAnyJs-zoomElement")
    }

    reset() {
        this.#values = {
            x: 0,
            y: 0,
            zoom: 100
        }
    }

    getZoom(): number {
        return this.#values.zoom
    }

    setZoom(value: number) {
        this.#values.zoom = value
    }

    setPos(value: IPosition) {
        this.#values.x = value.x
        this.#values.y = value.y
    }

    getPos(): IPosition {
        return {
            x: this.#values.x,
            y: this.#values.y
        }
    }

    #getMode() {
        return this.#element.hasAttribute("data-origin-parent") ? 'parent' : 'window'
    }

    center() {
        const mode = this.#getMode()
        const rect = this.#element.getBoundingClientRect()

        let width, height;

        if (mode === 'window') {
            width = window.innerWidth
            height = window.innerHeight
        } else {
            const parentRect = this.#getParentRect()

            width = parentRect.width
            height = parentRect.height
        }

        this.#values.x = width / 2 - rect.width / 2
        this.#values.y = height / 2 - rect.height / 2
    }

    #getParent() {
        return this.#element.offsetParent
    }

    #getElementRect() {
        return this.#element.getBoundingClientRect()
    }

    #getParentRect() {
        return this.#getParent()!.getBoundingClientRect()
    }

    fitToBounds() {
        const mode = this.#getMode()

        if (!this.#element.hasAttribute("data-bounds")) return;

        const rect = this.#element.getBoundingClientRect()

        const checkBounds = (originWidth: number, originHeight: number, cb: (key: 'x' | 'y') => void) => {
            const smallerWidth = rect.width >= originWidth
            const smallerHeight = rect.height >= originHeight

            if (!smallerWidth && !smallerHeight) this.center()

            if (smallerWidth) {
                cb('x')
            }

            if (smallerHeight) {
                cb('y')
            }
        }

        if (mode === "window") checkBounds(window.innerWidth, window.innerHeight, (key) => {
            if (rect[key === 'x' ? 'left' : 'top'] > 0) this.#values[key] = 0;

            const windowSize = window[key === 'x' ? 'innerWidth' : 'innerHeight']
            const newRectSize = rect[key === 'x' ? 'right' : 'bottom']

            if (windowSize > newRectSize) this.#values[key] += windowSize - newRectSize
        })

        if (mode === "parent") {
            const originRect = this.#getParentRect()

            checkBounds(originRect.width, originRect.height, (key) => {
                const difference = (originRect[key] + originRect[key === "x" ? 'width' : 'height']) - (rect[key === 'x' ? 'left' : 'top'] + rect[key === 'x' ? 'width' : 'height'])
                if (this.#element[key === 'x' ? 'offsetLeft' : 'offsetTop'] > 0) this.#values[key] = 0;
                if (difference > 0) this.#values[key] += difference
            })
        }
    }

    zoomAt(amplitude: number, pos: {
        x: number,
        y: number
    }) {
        const maxZoom: number = parseInt(this.#element.dataset.maxZoom || "4000")
        const minZoom: number = parseInt(this.#element.dataset.minZoom || "10")

        if (amplitude < 1 && this.#values.zoom * amplitude <= minZoom) return;
        if (amplitude > 1 && this.#values.zoom * amplitude >= maxZoom) return;

        const rect = this.#getElementRect()

        this.#values.x = (pos.x - (rect.left - this.#values.x)) - (pos.x - rect.left) * amplitude
        this.#values.y = (pos.y - (rect.top - this.#values.y)) - (pos.y - rect.top) * amplitude
        this.#values.zoom *= amplitude
    }

    #onWheel(event: WheelEvent) {
        let amplitude = 0

        if (event.deltaY < 1) {
            amplitude = 1.1
        }

        if (event.deltaY > 1) {
            amplitude = 1 / 1.1
        }

        this.zoomAt(
            amplitude, {
                x: event.pageX,
                y: event.pageY
            }
        )
        this.apply()
        this.fitToBounds()
        this.apply()
    }

    addListeners() {
        this.#element.addEventListener("wheel", this.#onWheelListener)
    }

    removeListeners() {
        this.#element.removeEventListener("wheel", this.#onWheelListener)
    }

    apply() {
        this.#element.style.transform = `scale(${this.#values.zoom / 100})`;
        this.#element.style.left = `${this.#values.x}px`
        this.#element.style.top = `${this.#values.y}px`
    }

    destroy() {
        this.#element.style.transform = "";
        this.#element.style.left = "";
        this.#element.style.right = "";
        this.#element.classList.remove("zoomAnyJs-zoomElement")
        this.removeListeners()
    }
}