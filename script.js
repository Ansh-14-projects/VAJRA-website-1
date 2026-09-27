"use strict";

const state = {
    armed: false,

    roll: 0,

    pitch: 0,

    altitude: 0,

    battery: 100,

    motors: [900, 900, 900, 900]
};


const joystick = document.getElementById("joystick");

const joystickStick =
    document.getElementById("joystickStick");

const armButton =
    document.getElementById("armButton");


function clamp(value, minimum, maximum) {

    return Math.max(
        minimum,
        Math.min(maximum, value)
    );

}


function updateDisplay() {

    document.getElementById("rollValue").textContent =
        `${state.roll.toFixed(1)}°`;

    document.getElementById("pitchValue").textContent =
        `${state.pitch.toFixed(1)}°`;


    document.getElementById("telemetryRoll").textContent =
        `${state.roll.toFixed(1)}°`;

    document.getElementById("telemetryPitch").textContent =
        `${state.pitch.toFixed(1)}°`;


    document.getElementById("altitude").textContent =
        `${state.altitude.toFixed(1)} m`;

    document.getElementById("battery").textContent =
        `${Math.round(state.battery)}%`;


    document.getElementById("motor1").textContent =
        Math.round(state.motors[0]);

    document.getElementById("motor2").textContent =
        Math.round(state.motors[1]);

    document.getElementById("motor3").textContent =
        Math.round(state.motors[2]);

    document.getElementById("motor4").textContent =
        Math.round(state.motors[3]);

}


armButton.addEventListener("click", function () {

    state.armed = !state.armed;


    if (state.armed) {

        armButton.textContent =
            "DISARM SYSTEM";

        armButton.classList.add("armed");

        document.getElementById(
            "bluetoothStatus"
        ).textContent = "READY";

    } else {

        armButton.textContent =
            "ARM SYSTEM";

        armButton.classList.remove("armed");

        document.getElementById(
            "bluetoothStatus"
        ).textContent = "STANDBY";


        state.motors = [
            900,
            900,
            900,
            900
        ];

    }


    updateDisplay();

});


function moveJoystick(clientX, clientY) {

    const rectangle =
        joystick.getBoundingClientRect();


    const centerX =
        rectangle.left +
        rectangle.width / 2;


    const centerY =
        rectangle.top +
        rectangle.height / 2;


    const maximum =
        rectangle.width / 2 - 27;


    let x =
        clientX - centerX;


    let y =
        clientY - centerY;


    const distance =
        Math.sqrt(
            x * x +
            y * y
        );


    if (distance > maximum) {

        x =
            x / distance *
            maximum;

        y =
            y / distance *
            maximum;

    }


    joystickStick.style.transform =
        `translate(${x}px, ${y}px)`;


    state.roll =
        clamp(
            x / maximum * 45,
            -45,
            45
        );


    state.pitch =
        clamp(
            -y / maximum * 45,
            -45,
            45
        );


    if (state.armed) {

        const throttle = 1050;

        const rollMix =
            state.roll * 4;

        const pitchMix =
            state.pitch * 4;


        state.motors[0] =
            clamp(
                throttle +
                rollMix +
                pitchMix,
                900,
                2000
            );


        state.motors[1] =
            clamp(
                throttle -
                rollMix +
                pitchMix,
                900,
                2000
            );


        state.motors[2] =
            clamp(
                throttle +
                rollMix -
                pitchMix,
                900,
                2000
            );


        state.motors[3] =
            clamp(
                throttle -
                rollMix -
                pitchMix,
                900,
                2000
            );

    }


    updateDisplay();

}


function resetJoystick() {

    joystickStick.style.transform =
        "translate(0px, 0px)";


    state.roll = 0;

    state.pitch = 0;


    if (state.armed) {

        state.motors = [
            1050,
            1050,
            1050,
            1050
        ];

    }


    updateDisplay();

}


joystick.addEventListener(
    "pointerdown",
    function (event) {

        joystick.setPointerCapture(
            event.pointerId
        );

        moveJoystick(
            event.clientX,
            event.clientY
        );

    }
);


joystick.addEventListener(
    "pointermove",
    function (event) {

        if (event.buttons) {

            moveJoystick(
                event.clientX,
                event.clientY
            );

        }

    }
);


joystick.addEventListener(
    "pointerup",
    resetJoystick
);


joystick.addEventListener(
    "pointercancel",
    resetJoystick
);


/* TELEMETRY GRAPH */

const canvas =
    document.getElementById(
        "telemetryCanvas"
    );


const context =
    canvas.getContext("2d");


const history =
    Array.from(
        { length: 100 },
        () => 0
    );


function drawGraph() {

    const devicePixelRatio =
        window.devicePixelRatio || 1;


    const width =
        canvas.clientWidth;


    const height =
        canvas.clientHeight;


    canvas.width =
        width * devicePixelRatio;


    canvas.height =
        height * devicePixelRatio;


    context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );


    context.clearRect(
        0,
        0,
        width,
        height
    );


    /* GRID */

    context.strokeStyle =
        "rgba(0,229,255,0.10)";

    context.lineWidth = 1;


    for (
        let y = 20;
        y < height;
        y += 40
    ) {

        context.beginPath();

        context.moveTo(
            0,
            y
        );

        context.lineTo(
            width,
            y
        );

        context.stroke();

    }


    /* LINE */

    context.beginPath();


    history.forEach(
        function (value, index) {

            const x =
                index /
                (history.length - 1) *
                width;


            const y =
                height / 2 -
                value *
                height *
                0.35;


            if (index === 0) {

                context.moveTo(
                    x,
                    y
                );

            } else {

                context.lineTo(
                    x,
                    y
                );

            }

        }
    );


    context.strokeStyle =
        "#00e5ff";

    context.lineWidth = 2;

    context.stroke();

}


setInterval(
    function () {

        const simulatedSignal =
            Math.sin(
                Date.now() / 900
            ) * 0.25;


        const joystickSignal =
            state.roll / 45 * 0.5;


        history.push(
            simulatedSignal +
            joystickSignal
        );


        history.shift();


        if (state.armed) {

            state.altitude =
                clamp(
                    state.altitude +
                    Math.random() * 0.12 -
                    0.03,

                    0,

                    30
                );


            state.battery =
                clamp(
                    state.battery -
                    0.015,

                    0,

                    100
                );

        } else {

            state.altitude =
                Math.max(
                    0,
                    state.altitude - 0.05
                );

        }


        updateDisplay();

        drawGraph();

    },

    100
);


window.addEventListener(
    "resize",
    drawGraph
);


drawGraph();

updateDisplay();
