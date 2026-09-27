"use strict";

const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
const CONTROL_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214";
const TELEMETRY_UUID = "19b10002-e8f2-537e-4f6c-d104768a1214";

let device = null;
let server = null;
let controlCharacteristic = null;
let telemetryCharacteristic = null;

let connected = false;
let armed = false;

let throttle = 0;
let roll = 0;
let pitch = 0;

let joystickActive = false;

const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const armButton = document.getElementById("armButton");
const stopButton = document.getElementById("stopButton");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const bluetoothMessage = document.getElementById("bluetoothMessage");

const armState = document.getElementById("armState");
const throttleSlider = document.getElementById("throttle");
const throttleValue = document.getElementById("throttleValue");

const joystick = document.getElementById("joystick");
const joystickStick = document.getElementById("joystickStick");

const rollValue = document.getElementById("rollValue");
const pitchValue = document.getElementById("pitchValue");

const bleState = document.getElementById("bleState");
const telemetryThrottle = document.getElementById("telemetryThrottle");
const telemetryRoll = document.getElementById("telemetryRoll");
const telemetryPitch = document.getElementById("telemetryPitch");

const logElement = document.getElementById("log");

function log(message) {
    const time = new Date().toLocaleTimeString();

    logElement.textContent +=
        `\n[${time}] ${message}`;

    logElement.scrollTop = logElement.scrollHeight;
}

function setConnected(value) {
    connected = value;

    if (value) {
        statusDot.className = "dot online";
        statusText.textContent = "CONNECTED";
        bleState.textContent = "ONLINE";

        connectButton.disabled = true;
        disconnectButton.disabled = false;
        armButton.disabled = false;
        stopButton.disabled = false;
    } else {
        statusDot.className = "dot offline";
        statusText.textContent = "DISCONNECTED";
        bleState.textContent = "OFFLINE";

        connectButton.disabled = false;
        disconnectButton.disabled = true;
        armButton.disabled = true;
        stopButton.disabled = true;

        setDisarmed();
    }
}

function setDisarmed() {
    armed = false;
    armState.textContent = "DISARMED";
    armState.style.color = "#ff304f";
    armButton.textContent = "ARM";
}

async function connectBluetooth() {
    if (!navigator.bluetooth) {
        bluetoothMessage.textContent =
            "Web Bluetooth is not supported by this browser.";
        return;
    }

    try {
        log("Searching for VAJRA...");

        device = await navigator.bluetooth.requestDevice({
            filters: [
                {
                    services: [SERVICE_UUID]
                }
            ],
            optionalServices: [SERVICE_UUID]
        });

        log(`Device selected: ${device.name || "VAJRA"}`);

        device.addEventListener(
            "gattserverdisconnected",
            handleDisconnect
        );

        server = await device.gatt.connect();

        const service =
            await server.getPrimaryService(SERVICE_UUID);

        controlCharacteristic =
            await service.getCharacteristic(CONTROL_UUID);

        try {
            telemetryCharacteristic =
                await service.getCharacteristic(TELEMETRY_UUID);

            await telemetryCharacteristic.startNotifications();

            telemetryCharacteristic.addEventListener(
                "characteristicvaluechanged",
                handleTelemetry
            );
        } catch (error) {
            log("Telemetry characteristic unavailable.");
        }

        setConnected(true);

        bluetoothMessage.textContent =
            "VAJRA Bluetooth connected.";

        log("Bluetooth connection established.");

        await sendCommand("STOP");
    } catch (error) {
        log(`Bluetooth error: ${error.message}`);

        bluetoothMessage.textContent =
            "Connection failed. Check Bluetooth and ESP32.";
    }
}

function handleDisconnect() {
    log("Bluetooth disconnected.");

    controlCharacteristic = null;
    telemetryCharacteristic = null;
    server = null;

    setConnected(false);

    bluetoothMessage.textContent =
        "VAJRA disconnected.";
}

async function disconnectBluetooth() {
    try {
        if (controlCharacteristic) {
            await sendCommand("STOP");
        }
    } catch (_) {
    }

    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }

    handleDisconnect();
}

async function sendCommand(command) {
    if (!connected || !controlCharacteristic) {
        return;
    }

    try {
        const encoder = new TextEncoder();

        await controlCharacteristic.writeValue(
            encoder.encode(command)
        );

        log(`TX → ${command}`);
    } catch (error) {
        log(`TX ERROR → ${error.message}`);
    }
}

async function toggleArm() {
    if (!connected) {
        return;
    }

    if (!armed) {
        throttle = 0;
        throttleSlider.value = "0";
        updateThrottleDisplay();

        await sendCommand("ARM");

        armed = true;
        armState.textContent = "ARMED";
        armState.style.color = "#00e676";
        armButton.textContent = "DISARM";

        log("SYSTEM ARMED");
    } else {
        await emergencyStop();
    }
}

async function emergencyStop() {
    throttle = 0;
    roll = 0;
    pitch = 0;

    throttleSlider.value = "0";

    updateThrottleDisplay();
    resetJoystick();

    await sendCommand("STOP");

    setDisarmed();

    log("!!! EMERGENCY STOP !!!");
}

function updateThrottleDisplay() {
    throttleValue.textContent = `${throttle}%`;
    telemetryThrottle.textContent = `${throttle}%`;
}

throttleSlider.addEventListener("input", () => {
    throttle = Number(throttleSlider.value);

    updateThrottleDisplay();

    sendControlPacket();
});

function joystickPosition(event) {
    const rect = joystick.getBoundingClientRect();

    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    let dx = x - centerX;
    let dy = y - centerY;

    const maxDistance = rect.width / 2 - 35;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }

    const normalizedX = dx / maxDistance;
    const normalizedY = dy / maxDistance;

    roll = Math.round(normalizedX * 100);
    pitch = Math.round(-normalizedY * 100);

    const displayX =
        centerX + dx;

    const displayY =
        centerY + dy;

    joystickStick.style.left =
        `${displayX}px`;

    joystickStick.style.top =
        `${displayY}px`;

    rollValue.textContent = roll;
    pitchValue.textContent = pitch;

    telemetryRoll.textContent = roll;
    telemetryPitch.textContent = pitch;

    sendControlPacket();
}

function resetJoystick() {
    roll = 0;
    pitch = 0;

    joystickStick.style.left = "50%";
    joystickStick.style.top = "50%";

    rollValue.textContent = "0";
    pitchValue.textContent = "0";

    telemetryRoll.textContent = "0";
    telemetryPitch.textContent = "0";
}

joystick.addEventListener("pointerdown", event => {
    joystickActive = true;
    joystick.setPointerCapture(event.pointerId);
    joystickPosition(event);
});

joystick.addEventListener("pointermove", event => {
    if (!joystickActive) {
        return;
    }

    joystickPosition(event);
});

joystick.addEventListener("pointerup", () => {
    joystickActive = false;
    resetJoystick();
    sendControlPacket();
});

joystick.addEventListener("pointercancel", () => {
    joystickActive = false;
    resetJoystick();
    sendControlPacket();
});

async function sendControlPacket() {
    if (!connected || !armed) {
        return;
    }

    const command =
        `CTRL,T=${throttle},R=${roll},P=${pitch}`;

    await sendCommand(command);
}

function handleTelemetry(event) {
    const decoder = new TextDecoder();

    const data =
        decoder.decode(event.target.value);

    log(`RX ← ${data}`);
}

connectButton.addEventListener(
    "click",
    connectBluetooth
);

disconnectButton.addEventListener(
    "click",
    disconnectBluetooth
);

armButton.addEventListener(
    "click",
    toggleArm
);

stopButton.addEventListener(
    "click",
    emergencyStop
);

window.addEventListener("beforeunload", () => {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
});

setConnected(false);
updateThrottleDisplay();
resetJoystick();
