const canvas = document.getElementById("canvas");
const canvasSize = document.getElementById("canvasSize");

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  const targetWidth = Math.max(1, Math.round(rect.width * pixelRatio));
  const targetHeight = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const sizeText =
    `На странице: ${Math.round(rect.width)} × ${Math.round(rect.height)} CSS px. ` +
    `Буфер: ${canvas.width} × ${canvas.height} px.`;

  if (canvasSize.textContent !== sizeText) {
    canvasSize.textContent = sizeText;
  }
}

const gl = canvas.getContext("webgl2");
if (!gl) {
  const graphicsError = document.getElementById("graphicsError");

  graphicsError.textContent =
    "Не удалось запустить WebGL. Попробуйте другой браузер " +
    "или проверьте, включено ли аппаратное ускорение.";
  graphicsError.hidden = false;

  canvas.hidden = true;
  canvasSize.hidden = true;

  document
    .querySelectorAll(".settings button, .settings input, .settings select")
    .forEach((control) => {
      control.disabled = true;
    });

  throw new Error("Не удалось создать контекст WebGL2");
}

let rgbColor = [199 / 255, 199 / 255, 199 / 255, 1.0];

const inputColor = document.getElementById("color");
inputColor.addEventListener("input", (event) => {
  const hex = event.target.value;
  const redNormalized = parseInt(hex.slice(1, 3), 16) / 255;
  const greenNormalized = parseInt(hex.slice(3, 5), 16) / 255;
  const blueNormalized = parseInt(hex.slice(5, 7), 16) / 255;

  rgbColor = [redNormalized, greenNormalized, blueNormalized, 1.0];
});

const triangleCountInput = document.getElementById("triangleCount");
const triangleCountValue = document.getElementById("triangleCountValue");

triangleCountInput.addEventListener("input", (event) => {
  triangleCountValue.textContent = event.target.value;
});

const seedInput = document.getElementById("seed");

function createRandom(seed) {
  let state = seed;

  /*
        Random number generator algorithms:
        This is Park and Miller's "minimal standard" MINSTD generator, a simple linear congruence which takes care to avoid the major pitfalls of such algorithms.
        Its sequence is, xn+1 = (axn + c) mod m with a = 16807, c = 0 and m = 231 - 1 = 2147483647. The seed specifies the initial value, x1. The period of this generator is about 231
        */
  return function () {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function generateGeometry(triangleCount, seed) {
  const random = createRandom(seed);
  const coordinates = [];
  const coordinateCount = triangleCount * 3 * 3;

  for (let i = 0; i < coordinateCount; i++) {
    coordinates.push(random() * 2 - 1);
  }

  return coordinates;
}

let data = generateGeometry(30, 12345);

const vertexShaderCode = `
        precision mediump float; 
        attribute vec3 aPosition;
        uniform vec2 uScaleFactor;
        uniform float uAngle;
        varying vec3 vColor;

        void main(){
          float angle = uAngle;
          
          float rotatedX = aPosition.x * cos(angle) - aPosition.y * sin(angle);
          float rotatedY = aPosition.x * sin(angle) + aPosition.y * cos(angle);
          vec3 newPosition = vec3(rotatedX * uScaleFactor.x, rotatedY * uScaleFactor.y, aPosition.z);

          gl_Position = vec4(newPosition, 1.0);

          float value = sin(
            aPosition.x * 12.3 +
            aPosition.y * 7.7
          ) * 0.5 + 0.5;

          if (value < 0.2) {
            vColor = vec3(0.05, 0.15, 0.9);
          } else if (value < 0.4) {
            vColor = vec3(0.8, 0.05, 0.4);
          } else if (value < 0.6) {
            vColor = vec3(0.05, 0.8, 0.7);
          } else if (value < 0.8) {
            vColor = vec3(0.9, 0.5, 0.05);
          } else {
            vColor = vec3(0.4, 0.1, 0.9);
          }
        }
      `;

const fragmentShaderCode = `
        precision mediump float; 
        varying vec3 vColor;

        void main(){
          gl_FragColor = vec4(vColor, 1.0);
        }
      `;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const isCompiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!isCompiled) {
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  } else {
    return shader;
  }
}

const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderCode);
const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderCode);

function createProgram(vs, fs, gl) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  const isLinked = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (!isLinked) {
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  } else {
    return program;
  }
}

const program = createProgram(vs, fs, gl);
gl.useProgram(program);

function createBuffers(gl, data, drawingType = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), drawingType);

  return buffer;
}

const positionBuffer = createBuffers(gl, data, gl.STATIC_DRAW);

function updateGeometry(triangleCount, seed) {
  data = generateGeometry(triangleCount, seed);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
}

const generateButton = document.getElementById("generateButton");

generateButton.addEventListener("click", () => {
  if (!seedInput.reportValidity()) {
    return;
  }
  const triangleCount = Number(triangleCountInput.value);
  const seed = Number(seedInput.value);
  updateGeometry(triangleCount, seed);
});

function initBuffers(name, buffer, size, program) {
  const attributeLocation = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(attributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(attributeLocation, size, gl.FLOAT, false, 0, 0);
}

function render(gl, program, positionBuffer, primitiveType, vertexCount) {
  initBuffers("aPosition", positionBuffer, 3, program);

  var primitiveType = primitiveType;
  var count = vertexCount;
  var offset = 0;

  gl.drawArrays(primitiveType, offset, count);
}

const scaleLocation = gl.getUniformLocation(program, "uScaleFactor");
const uAngleLocation = gl.getUniformLocation(program, "uAngle");

gl.enable(gl.SCISSOR_TEST);
gl.enable(gl.DEPTH_TEST);

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");

speedInput.addEventListener("input", (event) => {
  speed = Number(event.target.value);
  speedValue.textContent = `${speed} рад/с`;
});

let angle = 0;
let speed = 1;
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let isPaused = motionPreference.matches;
let previousTime = null;

const pauseButton = document.getElementById("pauseButton");
pauseButton.textContent = isPaused ? "Продолжить" : "Пауза";

pauseButton.addEventListener("click", () => {
  isPaused = !isPaused;

  if (isPaused) {
    pauseButton.textContent = "Продолжить";
  } else {
    pauseButton.textContent = "Пауза";
  }
});

const presets = {
  calm: {
    seed: 12345,
    triangleCount: 12,
    background: "#e8edf2",
    speed: 0.3,
  },
  bright: {
    seed: 42,
    triangleCount: 45,
    background: "#161824",
    speed: 0.8,
  },
  dense: {
    seed: 2026,
    triangleCount: 100,
    background: "#101820",
    speed: 0.5,
  },
};

function applyPreset(preset) {
  seedInput.value = String(preset.seed);

  triangleCountInput.value = String(preset.triangleCount);
  triangleCountValue.textContent = String(preset.triangleCount);

  speed = preset.speed;
  speedInput.value = String(speed);
  speedValue.textContent = `${speed} рад/с`;

  inputColor.value = preset.background;

  const hex = preset.background;
  rgbColor = [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
    1,
  ];

  angle = 0;
  updateGeometry(preset.triangleCount, preset.seed);
}

const presetSelect = document.getElementById("preset");

function markAsCustom() {
  presetSelect.value = "";
}

inputColor.addEventListener("input", markAsCustom);
speedInput.addEventListener("input", markAsCustom);
triangleCountInput.addEventListener("input", markAsCustom);
seedInput.addEventListener("input", markAsCustom);
const applyPresetButton = document.getElementById("applyPresetButton");

applyPresetButton.addEventListener("click", () => {
  const preset = presets[presetSelect.value];
  if (!preset) {
    return;
  }
  applyPreset(preset);
});

const resetButton = document.getElementById("resetButton");
resetButton.addEventListener("click", () => {
  angle = 0;
  speed = 1;

  isPaused = motionPreference.matches;
  pauseButton.textContent = isPaused ? "Продолжить" : "Пауза";

  rgbColor = [199 / 255, 199 / 255, 199 / 255, 1.0];
  inputColor.value = "#c7c7c7";

  speedInput.value = speed;
  speedValue.textContent = `${speed} рад/с`;

  triangleCountInput.value = "30";
  triangleCountValue.textContent = "30";

  presetSelect.value = "";

  seedInput.value = "12345";
  updateGeometry(30, 12345);
});

const loop = (timestamp) => {
  resizeCanvas();
  let deltaTime;

  if (previousTime === null) {
    deltaTime = 0;
  } else {
    deltaTime = (timestamp - previousTime) / 1000;
  }

  deltaTime = Math.min(deltaTime, 0.05);
  previousTime = timestamp;

  if (!isPaused) {
    angle += deltaTime * speed;
  }

  gl.uniform1f(uAngleLocation, angle);

  const leftWidth = Math.floor(canvas.width / 2);
  const rightWidth = canvas.width - leftWidth;

  const bottomHeight = Math.floor(canvas.height / 2);
  const topHeight = canvas.height - bottomHeight;

  drawQuadrant([0, 0, leftWidth, bottomHeight], rgbColor, [1, 1]);

  drawQuadrant([leftWidth, 0, rightWidth, bottomHeight], rgbColor, [-1, 1]);

  drawQuadrant([0, bottomHeight, leftWidth, topHeight], rgbColor, [1, -1]);

  drawQuadrant(
    [leftWidth, bottomHeight, rightWidth, topHeight],
    rgbColor,
    [-1, -1],
  );

  requestAnimationFrame(loop);
};

function drawQuadrant(viewport, color, scaleFactor) {
  gl.viewport(...viewport);
  gl.scissor(...viewport);
  gl.clearColor(...color);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniform2f(scaleLocation, ...scaleFactor);
  render(gl, program, positionBuffer, gl.TRIANGLES, data.length / 3);
}

requestAnimationFrame(loop);
