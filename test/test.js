import ZoomAnyJs from "../src/zoom-any-js.ts";

// const zoom = new ZoomAnyJs()
const zoom2 = new ZoomAnyJs("#myButton")

document.getElementById("myButton").addEventListener("click", () => {
    zoom2.center()
    zoom2.apply()
})