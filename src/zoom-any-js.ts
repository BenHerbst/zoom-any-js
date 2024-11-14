interface IPosition {
    x: number,
    y: number
}

enum Mode {
    parent,
    window,
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
    #onPointerDownListener;
    #onPointerUpListener;
    #onPointerMoveListener;

    #isInteracting: boolean = false;
    #draggingStartPosition: { elementX: number, elementY: number, pointerX: number, pointerY: number } | null = null;
    #zoomingPointerDifference: number = -1;
    #pointerCache: PointerEvent[] = []

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
        this.#onPointerDownListener = this.#onPointerDown.bind(this)
        this.#onPointerUpListener = this.#onPointerUp.bind(this)
        this.#onPointerMoveListener = this.#onPointerMove.bind(this)
        this.addListeners()

        window.onload = (() => {
            this.zoomToFit();
            this.apply()
            this.center("xy");
            this.apply()
            this.fitToBounds()
            this.apply()
        })

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
     * Returns a boolean whether the user is currently interacting with the element, i.e. is currently zooming or
     * dragging.
     *
     * @returns {boolean} True if user is interacting, false otherwise.
     */
    isInteracting() {
        return this.#isInteracting
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
     * Determines if the origin is the parent or the window/body based on the data-origin-parent attribute
     *
     * @private
     * @returns {Mode} Returns parent if the element has the attribute 'data-origin-parent', otherwise 'window'.
     */
    #getMode() {
        return this.#element.hasAttribute("data-origin-parent") ? Mode.parent : Mode.window
    }

    /**
     * Centers the element within its container, in the chosen direction. Options are: x, y and xy (both directions).
     * The container can either be the window or the element's parent, depending on data-origin-parent.
     *
     * @param {'x' | 'y' | 'xy'} direction - The direction to apply the centering to.
     */
    center(direction: 'x' | 'y' | 'xy') {
        const rect = this.#element.getBoundingClientRect()
        const containerRect = this.#getContainerRect()

        if (direction === "x" || direction === "xy")
            this.#values.x = containerRect.width / 2 - rect.width / 2
        else if (direction === "y" || direction === "xy")
            this.#values.y = containerRect.height / 2 - rect.height / 2
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
     * Retrieves the current container, depending on the mode.
     *
     * @private
     * @returns {HTMLElement | Element | null} The container element.
     */
    #getContainer() {
        if (this.#getMode() == Mode.parent) {
            return this.#getParent()
        } else {
            return document.body
        }
    }

    /**
     * Retrieves the bounding rectangle of the element's container.
     *
     * @private
     * @returns {DOMRect} The bounding rectangle of container, providing information about its size and position relative to the viewport.
     */
    #getContainerRect() {
        return this.#getContainer()!.getBoundingClientRect()
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
     * - If the element is smaller than the available space in a certain direction, it is centered within the bounds.
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

            if (!smallerWidth) this.center("x")
            if (!smallerHeight) this.center("y")

            if (smallerWidth) {
                cb('x')
            }

            if (smallerHeight) {
                cb('y')
            }
        }

        if (mode == Mode.window) checkBounds(window.innerWidth, window.innerHeight, (key) => {
            if (rect[key === 'x' ? 'left' : 'top'] > 0) this.#values[key] = 0;

            const windowSize = window[key === 'x' ? 'innerWidth' : 'innerHeight']
            const newRectSize = rect[key === 'x' ? 'right' : 'bottom']

            if (windowSize > newRectSize) this.#values[key] += windowSize - newRectSize
        })

        if (mode == Mode.parent) {
            const originRect = this.#getParentRect()

            checkBounds(originRect.width, originRect.height, (key) => {
                const difference = (originRect[key] + originRect[key === "x" ? 'width' : 'height']) - (rect[key === 'x' ? 'left' : 'top'] + rect[key === 'x' ? 'width' : 'height'])
                if (this.#element[key === 'x' ? 'offsetLeft' : 'offsetTop'] > 0) this.#values[key] = 0;
                if (difference > 0) this.#values[key] += difference
            })
        }
    }

    /**
     * Automatically apply zooming such that the content fits perfectly in its container.
     * Does not apply when the `data-bounds` attribute is not set on the element.
     */
    zoomToFit() {
        if (!this.#element.hasAttribute("data-bounds")) return;

        const rect = this.#element.getBoundingClientRect()
        const containerRect = this.#getContainerRect()

        let widthFactor = rect.width / containerRect.width
        let heightFactor = rect.height / containerRect.height

        this.#values.zoom = Math.min(
            100,
            this.#values.zoom / Math.max(widthFactor, heightFactor)
        )
    }

    /**
     * Return whether the element currently fits within its container, given a direction.
     * In case 'xy' is given as the direction, both directions are checked.
     *
     * @private
     * @param {'x' | 'y' | 'xy'} direction
     * @returns {boolean} True if the element fits, false otherwise.
     */
    #fitsInContainer(direction: 'x' | 'y' | 'xy') : boolean {
        const rect = this.#element.getBoundingClientRect()
        const containerRect = this.#getContainerRect()

        if (direction == "xy") {
            return this.#fitsInContainer('x') && this.#fitsInContainer('y')
        }
        return rect[direction == 'x' ? 'width' : 'height'] <= (direction == 'x' ? containerRect.width : containerRect.height)
    }

    /**
     * Get the zoom limit set by the user, using the `data-min-zoom` and `data-max-zoom` attributes. The return value is
     * either 'fit' or a number, representing the percentage of zoom of the original element.
     *
     * @private
     * @param {'min'|'max'} limit - Choose to retrieve the min or max
     * @returns {number | 'fit'} The zoom limit
     */
    #getZoomLimit(limit: 'min' | 'max'): number | 'fit' {
        const value = limit == 'min' ? this.#element.dataset.minZoom : this.#element.dataset.maxZoom
        if (value === "fit") {
            return "fit"
        }
        return parseInt(value || (limit == "min" ? "10" : "4000"))
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
        const minZoom = this.#getZoomLimit("min")
        const maxZoom = this.#getZoomLimit("max")

        if (amplitude < 1 && minZoom == "fit" && this.#fitsInContainer("xy")) return
        if (amplitude > 1 && maxZoom == "fit" && this.#fitsInContainer("xy")) return

        if (amplitude < 1 && minZoom != "fit" && this.#values.zoom * amplitude <= minZoom) return
        if (amplitude > 1 && maxZoom != "fit" && this.#values.zoom * amplitude >= maxZoom) return

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
        event.preventDefault()

        let amplitude = 0

        if (event.deltaY < 1) {
            amplitude = 1.1
        }

        if (event.deltaY > 1) {
            amplitude = 1 / 1.1
        }

        this.zoomAt(
            amplitude, {
                x: event.clientX,
                y: event.clientY
            }
        )
        this.apply()
        this.fitToBounds()
        this.apply()
    }

    /**
     * Handles the pointer down event.
     *
     * This prepares for dragging & zooming behaviour.
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #onPointerDown(event: PointerEvent) {
        event.preventDefault()

        if(this.#draggingStartPosition == null) {
            this.#draggingStartPosition = {
                elementX: this.#values.x,
                elementY: this.#values.y,
                pointerX: event.screenX,
                pointerY: event.screenY,
            }
        }
        this.#addToPointerCache(event)
    }

    /**
     * Handles the pointer up event.
     *
     * This finalizes dragging & zooming behaviour.
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #onPointerUp(event: PointerEvent) {
        event.preventDefault()
        setTimeout(() => this.#isInteracting = false, 25)
        this.#draggingStartPosition = null;
        this.#removeFromPointerCache(event)
    }


    /**
     * Handles the pointer move event.
     *
     * If a single pointer is present, #handleSinglePointerMove will be called. This handles dragging.
     * When two pointers are present, #handleDoublePointerMove will be called. This handles zooming.
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #onPointerMove(event: PointerEvent) {
        event.preventDefault()

        this.#updatePointerCache(event)

        if (this.#pointerCache.length == 1) {
            this.#handleSinglePointerMove(event)
        } else if (this.#pointerCache.length == 2) {
            this.#handleDoublePointerMove()
        }
    }

    /**
     * Handles the pointer move event when a single pointer is applied.
     * This means the user wants to drag the element to change its position.
     *
     * When `data-draggable` is not present, this method will do nothing.
     * The new position is calculated based on the start position of the dragging action, set in #onPointerDown, and
     * sets #isInteracting to true if the pointer is moved.
     * If `data-bounds` is set, the new position is bound by the container. The element cannot be dragged outside the
     * container when not currently zoomed in. When the element completely fits within the container, dragging it is
     * not possible.
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #handleSinglePointerMove(event: PointerEvent) {
        if (!this.#element.hasAttribute("data-draggable")) return
        if (!this.#draggingStartPosition) return
        if (event.target && event.target != this.#pointerCache[0].target) return

        let newPosition: IPosition = {
            x: event.screenX - this.#draggingStartPosition.pointerX + this.#draggingStartPosition.elementX,
            y: event.screenY - this.#draggingStartPosition.pointerY + this.#draggingStartPosition.elementY,
        }

        if (Math.abs(event.screenX - this.#draggingStartPosition.pointerX) > 1 ||
            Math.abs(event.screenY - this.#draggingStartPosition.pointerY) > 1) {
            this.#isInteracting = true
        }

        if(this.#element.hasAttribute("data-bounds")) {
            const currentPosition = this.getPos()
            const rect = this.#element.getBoundingClientRect()
            const containerRect = this.#getContainerRect()

            if(!this.#fitsInContainer("x")) {
                newPosition.x = Math.min(0, newPosition.x)
                newPosition.x = Math.max(containerRect.width - rect.width, newPosition.x)
            } else {
                newPosition.x = currentPosition.x
            }

            if(!this.#fitsInContainer("y")) {
                newPosition.y = Math.min(0, newPosition.y)
                newPosition.y = Math.max(containerRect.height - rect.height, newPosition.y)
            } else {
                newPosition.y = currentPosition.y
            }
        }

        this.setPos(newPosition)
        this.apply()
    }

    /**
     * Handles the pointer move event when two pointers are applied.
     * This means the user wants to zoom on the element using a touch screen device.
     *
     * Based on the positions of both pointers, the amplitude is determined, i.e. zooming in or out.
     * When the user moves pointer towards each other, the zoom level increases.
     * When the user moves pointer away from each other, the zoom level decreases.
     *
     * The zoom is applied relative to the first pointer's location
     *
     * This method sets #isInteracting to true if the two pointers are moving towards or away from each other.
     * The method assumes the pointer events are properly stored in the pointer cache.
     *
     * @private
     */
    #handleDoublePointerMove() {
        let currentDifference = Math.sqrt(
            Math.pow(this.#pointerCache[1].clientX - this.#pointerCache[0].clientX, 2) +
            Math.pow(this.#pointerCache[1].clientY - this.#pointerCache[0].clientY, 2)
        );

        if (this.#zoomingPointerDifference > 0) {
            if(Math.abs(currentDifference - this.#zoomingPointerDifference) > 1) {
                this.#isInteracting = true
                this.zoomAt(
                    currentDifference / this.#zoomingPointerDifference,
                    {
                        x: this.#pointerCache[0].clientX,
                        y: this.#pointerCache[0].clientY
                    }
                )
                this.apply()
                this.fitToBounds()
                this.apply()
            }
        }

        // Cache the distance for the next move event
        this.#zoomingPointerDifference = currentDifference;
    }

    /**
     * Adds a pointer event to the cache.
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #addToPointerCache(event: PointerEvent) {
        this.#pointerCache.push(event)
    }

    /**
     * Updates the pointer event in the cache
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #updatePointerCache(event: PointerEvent) {
        for (let i = 0; i < this.#pointerCache.length; i++) {
            if (event.pointerId == this.#pointerCache[i].pointerId) {
                this.#pointerCache[i] = event;
                break;
            }
        }
    }

    /**
     * Remove the pointer event from the cache
     *
     * @param {PointerEvent} event - The pointer event containing pointer data.
     * @private
     */
    #removeFromPointerCache(event: PointerEvent) {
        for (let i = 0; i < this.#pointerCache.length; i++) {
            if (this.#pointerCache[i].pointerId == event.pointerId) {
                this.#pointerCache.splice(i, 1);
                break;
            }
        }
        if (this.#pointerCache.length < 2) {
            this.#zoomingPointerDifference = -1
        }
    }

    /**
     * Adds event listeners to the element for handling user interactions.
     * Specifically, it adds a wheel event listener to manage zooming functionality.
     * Besides, it adds pointer event listeners to manage dragging en zooming on touch screen devices.
     * Note that the pointerup event is intentionally registered globally, such that things are being cleaned up when
     * the pointer is released outside the target element.
     */
    addListeners() {
        this.#element.addEventListener("wheel", this.#onWheelListener)
        this.#element.addEventListener("pointerdown", this.#onPointerDownListener)
        this.#element.addEventListener("pointermove", this.#onPointerMoveListener)
        window.addEventListener("pointerup", this.#onPointerUpListener)
    }

    /**
     * Removes event listeners from the element to stop handling user interactions.
     * Specifically, it removes the wheel event listener that manages zooming functionality and the pointer events that
     * manage dragging and zooming on touch screen devices.
     */
    removeListeners() {
        this.#element.removeEventListener("wheel", this.#onWheelListener)
        this.#element.removeEventListener("pointerdown", this.#onPointerDownListener)
        this.#element.removeEventListener("pointermove", this.#onPointerMoveListener)
        window.removeEventListener("pointerup", this.#onPointerUpListener)
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