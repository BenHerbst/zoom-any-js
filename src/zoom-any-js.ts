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

    /**
     * Selects the DOM element to be manipulated using the provided selector.
     *    If no selector is provided, it defaults to ".zoomable".
     * Adds event listeners to the selected element, including the wheel event listener for zooming.
     * Adjusts the element's position to fit within its bounds when data-binds enabled.
     *
     * @param {string} [elementSelector='.zoomable'] - The CSS selector for the element to zoom. Defaults to ".zoomable".
     */
    constructor(elementSelector: string = '.zoomable') {
        this.#selectElement(elementSelector)
        this.#onWheelListener = this.#onWheel.bind(this)
        this.addListeners()
        this.fitToBounds()
        this.apply()
    }

    /**
     * Selects a DOM element based on the given CSS selector.
     * If the element is found, it assigns it to the `#element` property
     * and adds a specific class for further manipulations.
     * Throws an error if the element is not found.
     *
     * @param {string} elementSelector - The CSS selector of the element to select.
     * @throws {Error} If no element matching the selector is found.
     * @private
     */
    #selectElement(elementSelector: string) {
        const queried = document.querySelector(elementSelector)
        if (queried === null) throw new Error("Zoom element not found")
        this.#element = queried as HTMLElement
        this.#element.classList.add("zoomAnyJs-zoomElement")
    }

    /**
     * Resets the internal values of the zoom element to their default state.
     * This includes setting the x and y coordinates to 0 and the zoom level to 100.
     */
    reset() {
        this.#values = {
            x: 0,
            y: 0,
            zoom: 100
        }
    }

    /**
     * Retrieves the current zoom level of the element.
     *
     * @returns {number} The current zoom level.
     */
    getZoom(): number {
        return this.#values.zoom
    }

    /**
     * Sets the current zoom level of the element.
     *
     * @param {number} value - The value the zoom level is set to.
     */
    setZoom(value: number) {
        this.#values.zoom = value
    }

    /**
     * Sets the position values (x and y coordinates) for the element.
     *
     * @param {IPosition} value - An object containing the x and y coordinates to set.
     */
    setPos(value: IPosition) {
        this.#values.x = value.x
        this.#values.y = value.y
    }

    /**
     * Retrieves the current position values (x and y coordinates) of the element.
     *
     * @returns {IPosition} An object containing the current x and y coordinates.
     */
    getPos(): IPosition {
        return {
            x: this.#values.x,
            y: this.#values.y
        }
    }

    /**
     * Determines if the origin is the parent or the window based on the data-origin-parent attribute
     *
     * @private
     * @returns {string} Returns 'parent' if the element has the attribute 'data-origin-parent', otherwise 'window'.
     */
    #getMode() {
        return this.#element.hasAttribute("data-origin-parent") ? 'parent' : 'window'
    }

    /**
     * Centers the element within its container.
     * The container can either be the window or the element's parent, depending on data-origin-parent.
     */
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

    /**
     * Retrieves the offset parent of the element.
     *
     * @private
     * @returns {Element | null} The offset parent of the element, or null if there is none.
     */
    #getParent() {
        return this.#element.offsetParent
    }

    /**
     * Retrieves the bounding rectangle of the element.
     *
     * @private
     * @returns {DOMRect} The bounding rectangle of the element, providing information about its size and position relative to the viewport.
     */
    #getElementRect() {
        return this.#element.getBoundingClientRect()
    }

    /**
     * Retrieves the bounding rectangle of the element's offset parent.
     *
     * @private
     * @returns {DOMRect} The bounding rectangle of the offset parent, providing information about its size and position relative to the viewport.
     */
    #getParentRect() {
        return this.#getParent()!.getBoundingClientRect()
    }

    /**
     * Adjusts the position of the element to fit within its bounds.
     * The bounds are determined based on the element's data-origin and the presence of the `data-bounds` attribute.
     *
     * If the `data-bounds` attribute is present, the method checks whether the element fits within the
     * specified bounds (window or parent). If not, it adjusts the position so that the element is
     * visible within the bounds.
     *
     * The adjustment logic is as follows:
     * - If the element is smaller than the available space, it is centered within the bounds.
     * - If the element overflows in either dimension (x or y), its position is adjusted to fit within
     *   the available space, with the option of setting its position to zero if it is already out of bounds.
     */
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

    /**
     * Zooms the element based on the given amplitude and position.
     * The zoom effect scales the element's size and adjusts its position to zoom in or out
     * relative to a specified point (pos). Zoom levels are constrained within the minimum and
     * maximum zoom limits defined in the element's dataset (data-min-zoom and data-max-zoom).
     *
     * @param {number} amplitude - The zoom factor. Values greater than 1 zoom in, while values less than 1 zoom out.
     * @param {{ x: number, y: number }} pos - The position (x, y) to zoom towards.
     */
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

    /**
     * Handles the zoom in response to a wheel event.
     *
     * When the user scrolls up (i.e., `event.deltaY < 1`), the zoom level increases.
     * When the user scrolls down (i.e., `event.deltaY > 1`), the zoom level decreases.
     *
     * The zoom is applied relative to the mouse pointer position.
     *
     * @param {WheelEvent} event - The wheel event containing scroll data and the pointer position.
     * @private
     */
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

    /**
     * Adds event listeners to the element for handling user interactions.
     * Specifically, it adds a wheel event listener to manage zooming functionality.
     */
    addListeners() {
        this.#element.addEventListener("wheel", this.#onWheelListener)
    }

    /**
     * Removes event listeners from the element to stop handling user interactions.
     * Specifically, it removes the wheel event listener that manages zooming functionality.
     */
    removeListeners() {
        this.#element.removeEventListener("wheel", this.#onWheelListener)
    }

    /**
     * Applies the current transformation and position values to the element.
     * Has to be called everytime you want to apply changes to the element, e.g. after zoomAt()
     */
    apply() {
        this.#element.style.transform = `scale(${this.#values.zoom / 100})`;
        this.#element.style.left = `${this.#values.x}px`
        this.#element.style.top = `${this.#values.y}px`
    }

    /**
     * Removes all listeners and css changes, basically reverting the element back to before using the plugin
     */
    destroy() {
        this.#element.style.transform = "";
        this.#element.style.left = "";
        this.#element.style.right = "";
        this.#element.classList.remove("zoomAnyJs-zoomElement")
        this.removeListeners()
    }
}