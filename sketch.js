let customFont;
let video;
let handsModel;
let faceModel;
let camera;
let handResults = null;
let faceResults = null;
let faceLayer;
let glowLayer;
let textLayer;

let currentPage = 1;
const totalPages = 23;

let pinchCooldown = 0;
let lastPinchState = false;

let loadingStartTime = 0;
let loadingDuration = 3000;
let loadingFinished = false;

let transferStartTime = 0;
let transferDuration = 3000;
let transferStarted = false;
let transferFinished = false;

// sound
let pageSounds = {};
let currentPlayingSound = null;
let lastSoundPage = -1;
let fft;
let waveformData = [];
let waveParticles = [];

// page 2 typing
let welcomeBaseText = "WELCOME";
let welcomeTyped = "";
let welcomeCharIndex = 0;
let welcomeLastTypeTime = 0;
let welcomeTypeInterval = 320;
let welcomeDoneTime = 0;

// page 3 typing
let userName = "";
let maxNameLength = 18;

// page 4 terminal typing
let terminalLines = [];
let terminalTypedLines = [];
let terminalCurrentLine = 0;
let terminalCurrentChar = 0;
let terminalLastTypeTime = 0;
let terminalTypeInterval = 42;
let terminalFinishedTime = 0;

// page 21 terminal typing
let page21Lines = [];
let page21TypedLines = [];
let page21CurrentLine = 0;
let page21CurrentChar = 0;
let page21LastTypeTime = 0;
let page21TypeInterval = 42;

// day card typing
let dayTyped = "";
let dayCharIndex = 0;
let dayLastTypeTime = 0;
let dayTypeInterval = 240;
let dayDoneTime = 0;

// status pages typing
let statusTopLines = [];
let statusTopTypedLines = [];
let statusTopIndex = 0;
let statusTopChar = 0;
let statusTopLastTypeTime = 0;
let statusTopInterval = 42;

let statusRowLabelTyped = [];
let statusRowValueTyped = [];
let statusRowIndex = 0;
let statusRowLabelChar = 0;
let statusRowValueChar = 0;
let statusTypingMode = "top";
let statusRowLastTypeTime = 0;
let statusRowInterval = 42;

let overallTypedLines = [];
let overallTypingIndex = 0;
let overallTypingChar = 0;
let overallLastTypeTime = 0;
let overallInterval = 42;

// glitch cursor
let glitchCursorChars = ["_", "#", "@", "/", "-", "]", "[", "=", "+"];
let glitchCursorLastChange = 0;
let glitchCursorCurrent = "_";
let glitchCursorInterval = 70;

// retro filter
let showRetroScanlines = true;

// Colour palette
const FRAME_COL = [220, 245, 245];
const BAR_COL = [220, 235, 235];
const TEXT_DARK = [10, 20, 20];
const CYAN_MAIN = [170, 255, 255];
const CYAN_GLOW = [130, 245, 255];
const CYAN_HIGHLIGHT = [240, 255, 255];

let showOnlyFaceArea = true;

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356,
  454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

function preload() {
  customFont = loadFont("Jersey10-Regular.ttf");

  pageSounds[6] = loadSound("sounds/dna.mp3");
  pageSounds[8] = loadSound("sounds/anpanman.mp3");
  pageSounds[10] = loadSound("sounds/mic drop.mp3");
  pageSounds[12] = loadSound("sounds/come back home.mp3");
  pageSounds[14] = loadSound("sounds/save me.mp3");
  pageSounds[16] = loadSound("sounds/i need u.mp3");
  pageSounds[18] = loadSound("sounds/run.mp3");
  pageSounds[20] = loadSound("sounds/wings.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont(customFont);

  faceLayer = createGraphics(width, height);
  glowLayer = createGraphics(width, height);
  textLayer = createGraphics(width, height);

  faceLayer.textFont(customFont);
  glowLayer.textFont(customFont);
  textLayer.textFont(customFont);

  video = createCapture(VIDEO, () => {
    console.log("Camera ready");
  });
  video.size(width, height);
  video.hide();

  setupHands();
  setupFace();

  camera = new Camera(video.elt, {
    onFrame: async () => {
      await handsModel.send({ image: video.elt });
      await faceModel.send({ image: video.elt });
    },
    width: width,
    height: height
  });
  camera.start();

  fft = new p5.FFT(0.85, 256);

  loadingStartTime = millis();
  welcomeLastTypeTime = millis();
  terminalLastTypeTime = millis();
  page21LastTypeTime = millis();
  dayLastTypeTime = millis();
}

function setupHands() {
  handsModel = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsModel.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  handsModel.onResults((results) => {
    handResults = results;
  });
}

function setupFace() {
  faceModel = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceModel.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  faceModel.onResults((results) => {
    faceResults = results;
  });
}

function beginTextLayer() {
  textLayer.clear();
  textLayer.textFont(customFont);
}

function endTextLayer() {
  image(textLayer, 0, 0);
}

function isSoundPage(pageNum) {
  return [6, 8, 10, 12, 14, 16, 18, 20].includes(pageNum);
}

function updateFFTInput() {
  if (currentPlayingSound && fft) {
    fft.setInput(currentPlayingSound);
  }
}

function updatePageSound() {
  if (currentPage === lastSoundPage) return;

  lastSoundPage = currentPage;

  if (currentPlayingSound && currentPlayingSound.isPlaying()) {
    currentPlayingSound.stop();
  }

  if (pageSounds[currentPage]) {
    currentPlayingSound = pageSounds[currentPage];
    currentPlayingSound.play();
  } else {
    currentPlayingSound = null;
  }
}

function spawnWaveParticle(x, y, dir) {
  waveParticles.push({
    x: x + random(-6, 6),
    y: y + random(-6, 6),
    vx: random(-1.2, 1.2),
    vy: dir * random(0.8, 2.8),
    size: random(3, 9),
    life: 255
  });
}

function updateAndDrawWaveParticles() {
  for (let i = waveParticles.length - 1; i >= 0; i--) {
    let p = waveParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 7;
    p.size *= 0.988;

    noStroke();
    fill(130, 245, 255, p.life * 0.25);
    circle(p.x, p.y, p.size * 2.2);

    fill(220, 255, 255, p.life * 0.55);
    circle(p.x, p.y, p.size);

    if (p.life <= 0 || p.size < 0.8) {
      waveParticles.splice(i, 1);
    }
  }
}

function drawSoundWaveBackground() {
  if (!isSoundPage(currentPage)) return;
  if (!currentPlayingSound || !fft) return;
  if (!currentPlayingSound.isPlaying()) return;

  updateFFTInput();
  waveformData = fft.waveform();

  // moved higher so it doesn't clash with status boxes
  let centreY = height * 0.28;
  let amp = height * 0.075;

  let handInfluenceX = width / 2;
  let handInfluenceY = centreY;
  let handActive = false;
  let handPullDir = 0;

  if (handResults && handResults.multiHandLandmarks && handResults.multiHandLandmarks.length > 0) {
    let hand = handResults.multiHandLandmarks[0];
    let indexTip = hand[8];
    handInfluenceX = width - indexTip.x * width;
    handInfluenceY = indexTip.y * height;
    handActive = true;

    if (handInfluenceY < centreY) {
      handPullDir = -1; // pull upward
    } else {
      handPullDir = 1; // push downward
    }
  }

  noFill();

  stroke(100, 245, 255, 22);
  strokeWeight(10);
  beginShape();
  for (let i = 0; i < waveformData.length; i++) {
    let x = map(i, 0, waveformData.length - 1, width * 0.04, width * 0.96);
    let y = centreY + waveformData[i] * amp;

    if (handActive) {
      let d = dist(x, y, handInfluenceX, handInfluenceY);
      let influence = max(0, 1 - d / 230);

      // stronger up/down control
      y += handPullDir * influence * 55;
      y += sin(frameCount * 0.08 + i * 0.2) * influence * 22;

      if (influence > 0.72 && frameCount % 3 === 0 && random() < 0.22) {
        spawnWaveParticle(x, y, handPullDir);
      }
    }

    vertex(x, y);
  }
  endShape();

  stroke(120, 255, 255, 55);
  strokeWeight(4);
  beginShape();
  for (let i = 0; i < waveformData.length; i++) {
    let x = map(i, 0, waveformData.length - 1, width * 0.04, width * 0.96);
    let y = centreY + waveformData[i] * amp;

    if (handActive) {
      let d = dist(x, y, handInfluenceX, handInfluenceY);
      let influence = max(0, 1 - d / 230);
      y += handPullDir * influence * 55;
      y += sin(frameCount * 0.08 + i * 0.2) * influence * 22;
    }

    vertex(x, y);
  }
  endShape();

  stroke(220, 255, 255, 145);
  strokeWeight(1.6);
  beginShape();
  for (let i = 0; i < waveformData.length; i++) {
    let x = map(i, 0, waveformData.length - 1, width * 0.04, width * 0.96);
    let y = centreY + waveformData[i] * amp;

    if (handActive) {
      let d = dist(x, y, handInfluenceX, handInfluenceY);
      let influence = max(0, 1 - d / 230);
      y += handPullDir * influence * 55;
      y += sin(frameCount * 0.08 + i * 0.2) * influence * 22;
    }

    vertex(x, y);
  }
  endShape();

  if (handActive) {
    noStroke();
    fill(120, 245, 255, 30);
    circle(handInfluenceX, handInfluenceY, 95);
    fill(220, 255, 255, 85);
    circle(handInfluenceX, handInfluYFix(handInfluenceY), 26);
  }

  updateAndDrawWaveParticles();
}

function handInfluYFix(v) {
  return v;
}

function glowRect(x, y, w, h, glowCol = FRAME_COL, coreCol = FRAME_COL, glowWeight = 10, coreWeight = 3) {
  noFill();

  stroke(glowCol[0], glowCol[1], glowCol[2], 65);
  strokeWeight(glowWeight);
  rect(x, y, w, h);

  stroke(glowCol[0], glowCol[1], glowCol[2], 26);
  strokeWeight(glowWeight * 1.8);
  rect(x, y, w, h);

  stroke(glowCol[0], glowCol[1], glowCol[2], 10);
  strokeWeight(glowWeight * 2.6);
  rect(x, y, w, h);

  stroke(...coreCol);
  strokeWeight(coreWeight);
  rect(x, y, w, h);
}

function glowLine(x1, y1, x2, y2, glowCol = FRAME_COL, coreCol = FRAME_COL, glowWeight = 7, coreWeight = 2) {
  stroke(glowCol[0], glowCol[1], glowCol[2], 65);
  strokeWeight(glowWeight);
  line(x1, y1, x2, y2);

  stroke(glowCol[0], glowCol[1], glowCol[2], 24);
  strokeWeight(glowWeight * 1.8);
  line(x1, y1, x2, y2);

  stroke(...coreCol);
  strokeWeight(coreWeight);
  line(x1, y1, x2, y2);
}

function glowBarRect(x, y, w, h) {
  noStroke();
  fill(BAR_COL[0], BAR_COL[1], BAR_COL[2], 38);
  rect(x - 2, y - 2, w + 4, h + 4);

  fill(BAR_COL[0], BAR_COL[1], BAR_COL[2], 16);
  rect(x - 5, y - 5, w + 10, h + 10);

  fill(...BAR_COL);
  rect(x, y, w, h);
}

function drawRetroScanlines() {
  if (!showRetroScanlines) return;

  push();
  noStroke();

  for (let y = 0; y < height; y += 4) {
    fill(255, 255, 255, 8);
    rect(0, y, width, 1);
  }

  for (let y = 2; y < height; y += 8) {
    fill(140, 255, 255, 6);
    rect(0, y, width, 1);
  }

  pop();
}

function drawCRTCurveOverlay() {
  push();
  noStroke();

  for (let i = 0; i < 12; i++) {
    let a = map(i, 0, 11, 0, 5);
    fill(0, a);
    rect(i * 2, i * 2, width - i * 4, height - i * 4, 18);
  }

  fill(0, 18);

  beginShape();
  vertex(0, 0);
  vertex(width * 0.06, 0);
  vertex(0, height * 0.06);
  endShape(CLOSE);

  beginShape();
  vertex(width, 0);
  vertex(width * 0.94, 0);
  vertex(width, height * 0.06);
  endShape(CLOSE);

  beginShape();
  vertex(0, height);
  vertex(0, height * 0.94);
  vertex(width * 0.06, height);
  endShape(CLOSE);

  beginShape();
  vertex(width, height);
  vertex(width * 0.94, height);
  vertex(width, height * 0.94);
  endShape(CLOSE);

  noFill();
  stroke(190, 255, 255, 8);
  strokeWeight(2);
  rect(width * 0.02, height * 0.02, width * 0.96, height * 0.96, 30);

  pop();
}

function isDayPage(pageNum) {
  return [5, 7, 9, 11, 13, 15, 17, 19].includes(pageNum);
}

function isStatusTemplatePage(pageNum) {
  return [6, 8, 10, 12, 14, 16, 18, 20].includes(pageNum);
}

function getDayLabel(pageNum) {
  const dayMap = {
    5: "DAY 0",
    7: "DAY 1825",
    9: "DAY 6570",
    11: "DAY 8760",
    13: "DAY 10950",
    15: "DAY 16425",
    17: "DAY 21900",
    19: "DAY 31025"
  };
  return dayMap[pageNum] || "";
}

function resetDayAnimation() {
  dayTyped = "";
  dayCharIndex = 0;
  dayLastTypeTime = millis();
  dayDoneTime = 0;
}

function getStatusPageData(pageNum) {
  const displayName = userName.trim() || "USER";

  const data = {
    6: {
      greeting: `Hello, ${displayName}!`,
      message: "TODAY IS THE BEAUTIFUL DAY!",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "23,000"],
        ["EAT (Times)", "3"],
        ["SLEEP (Times)", "3"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "FINISHED COLLECT TODAY",
        "SEE YOU NEXT DAY!",
        ">"
      ],
      dayLabel: "DAY 0"
    },
    8: {
      greeting: `Hello, ${displayName}!`,
      message: "YOU ARE DOING WELL TODAY.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "39,840"],
        ["EAT (Times)", "5"],
        ["SLEEP (Times)", "3"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "ROUTINE RECORDED",
        "KEEP MOVING FORWARD",
        ">"
      ],
      dayLabel: "DAY 1825"
    },
    10: {
      greeting: `Hello, ${displayName}!`,
      message: "ANOTHER DAY HAS BEEN SAVED.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "36,210"],
        ["EAT (Times)", "5"],
        ["SLEEP (Times)", "2"],
        ["MOOD", "HAPPY"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "MEMORY STORED",
        "PROCEED TO NEXT DAY",
        ">"
      ],
      dayLabel: "DAY 6570"
    },
    12: {
      greeting: `Hello, ${displayName}!`,
      message: "TODAY IS A BEAUTIFUL DAY.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "30,500"],
        ["EAT (Times)", "2"],
        ["SLEEP (Times)", "2"],
        ["MOOD", "CALM"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "DAY COMPLETED",
        "SEE YOU TOMORROW",
        ">"
      ],
      dayLabel: "DAY 8760"
    },
    14: {
      greeting: `Hello, ${displayName}!`,
      message: "TODAY IS RAINY DAY i SUGGEST TO STAY.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "28,980"],
        ["EAT (Times)", "3"],
        ["SLEEP (Times)", "1"],
        ["MOOD", "SAD"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "LOG UPDATED",
        "CONTINUE LIFE PROCESS",
        ">"
      ],
      dayLabel: "DAY 10950"
    },
    16: {
      greeting: `Hello, ${displayName}!`,
      message: "YOUR DATA IS STILL BEAUTIFUL.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "27,200"],
        ["EAT (Times)", "3"],
        ["SLEEP (Times)", "3"],
        ["MOOD", "HAPPY"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "COLLECTION FINISHED",
        "NEXT DAY AWAITS",
        ">"
      ],
      dayLabel: "DAY 16425"
    },
    18: {
      greeting: `Hello, ${displayName}!`,
      message: "TODAY IS BEAUTIFUL DAY TO GO OUT.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "25,740"],
        ["EAT (Times)", "3"],
        ["SLEEP (Times)", "4"],
        ["MOOD", "PEACEFUL"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "BODY STATUS STORED",
        "ADVANCE TO NEXT RECORD",
        ">"
      ],
      dayLabel: "DAY 21900"
    },
    20: {
      greeting: `Hello, ${displayName}!`,
      message: "TODAY IS A BEAUTIFUL DAY.",
      statusTitle: "STATUS",
      stats: [
        ["BREATH (Per)", "15,880"],
        ["EAT (Times)", "1"],
        ["SLEEP (Times)", "1"]
      ],
      overallTitle: "OVERALL",
      overallLines: [
        "THANK YOU FOR EVERYTHING",
        "PREPARE FOR TRANSFER",
        ">"
      ],
      dayLabel: "DAY 31025"
    }
  };

  return data[pageNum];
}

function resetStatusTyping(pageNum) {
  const page = getStatusPageData(pageNum);
  if (!page) return;

  statusTopLines = [
    page.greeting,
    page.message,
    "",
    "(press or pinch to quit)"
  ];

  statusTopTypedLines = ["", "", "", ""];
  statusTopIndex = 0;
  statusTopChar = 0;
  statusTopLastTypeTime = millis();

  statusRowLabelTyped = page.stats.map(() => "");
  statusRowValueTyped = page.stats.map(() => "");
  statusRowIndex = 0;
  statusRowLabelChar = 0;
  statusRowValueChar = 0;

  overallTypedLines = page.overallLines.map(() => "");
  overallTypingIndex = 0;
  overallTypingChar = 0;
  overallLastTypeTime = millis();

  statusTypingMode = "top";
  statusRowLastTypeTime = millis();
}

function updateStatusTypingAnimation(pageNum) {
  const page = getStatusPageData(pageNum);
  if (!page) return;

  if (statusTypingMode === "top") {
    if (statusTopIndex < statusTopLines.length) {
      if (millis() - statusTopLastTypeTime > statusTopInterval) {
        let fullLine = statusTopLines[statusTopIndex];

        if (statusTopChar < fullLine.length) {
          statusTopTypedLines[statusTopIndex] += fullLine.charAt(statusTopChar);
          statusTopChar++;
        } else {
          statusTopIndex++;
          statusTopChar = 0;
        }

        statusTopLastTypeTime = millis();
      }
      return;
    } else {
      statusTypingMode = "label";
    }
  }

  if (statusTypingMode === "label") {
    if (statusRowIndex >= page.stats.length) {
      statusTypingMode = "overall";
      return;
    }

    if (millis() - statusRowLastTypeTime > statusRowInterval) {
      let fullLabel = `[ ${page.stats[statusRowIndex][0]} ]`;

      if (statusRowLabelChar < fullLabel.length) {
        statusRowLabelTyped[statusRowIndex] += fullLabel.charAt(statusRowLabelChar);
        statusRowLabelChar++;
      } else {
        statusTypingMode = "value";
        statusRowValueChar = 0;
      }

      statusRowLastTypeTime = millis();
    }
    return;
  }

  if (statusTypingMode === "value") {
    if (statusRowIndex >= page.stats.length) {
      statusTypingMode = "overall";
      return;
    }

    if (millis() - statusRowLastTypeTime > statusRowInterval) {
      let fullValue = page.stats[statusRowIndex][1];

      if (statusRowValueChar < fullValue.length) {
        statusRowValueTyped[statusRowIndex] += fullValue.charAt(statusRowValueChar);
        statusRowValueChar++;
      } else {
        statusRowIndex++;
        statusRowLabelChar = 0;
        statusRowValueChar = 0;

        if (statusRowIndex < page.stats.length) {
          statusTypingMode = "label";
        } else {
          statusTypingMode = "overall";
        }
      }

      statusRowLastTypeTime = millis();
    }
    return;
  }

  if (statusTypingMode === "overall") {
    if (overallTypingIndex >= page.overallLines.length) {
      statusTypingMode = "done";
      return;
    }

    if (millis() - overallLastTypeTime > overallInterval) {
      let fullLine = page.overallLines[overallTypingIndex];

      if (overallTypingChar < fullLine.length) {
        overallTypedLines[overallTypingIndex] += fullLine.charAt(overallTypingChar);
        overallTypingChar++;
      } else {
        overallTypingIndex++;
        overallTypingChar = 0;

        if (overallTypingIndex >= page.overallLines.length) {
          statusTypingMode = "done";
        }
      }

      overallLastTypeTime = millis();
    }
  }
}

function buildPage21Lines() {
  const displayName = userName.trim() || "USER";

  page21Lines = [
    "MONITOR READY.",
    "> MEMORY_TRANSFER.audit",
    "",
    "Hello, " + displayName + "!",
    "ALL DAILY RECORDS HAVE BEEN CHECKED.",
    "EMOTIONAL STATUS INDEX ARCHIVED.",
    "LIFE PATTERN READY FOR TRANSFER.",
    "",
    "NO CRITICAL ERROR FOUND.",
    "FINAL MEMORY PACKAGE STABLE.",
    "",
    "(press right arrow / pinch to continue)",
    ">"
  ];
}

function resetPage21Typing() {
  buildPage21Lines();
  page21TypedLines = [];
  page21CurrentLine = 0;
  page21CurrentChar = 0;
  page21LastTypeTime = millis();
}

function getGlitchCursor(active = true) {
  if (!active) return "";

  if (millis() - glitchCursorLastChange > glitchCursorInterval) {
    if (random() < 0.75) {
      glitchCursorCurrent = "_";
    } else {
      glitchCursorCurrent = random(glitchCursorChars);
    }
    glitchCursorLastChange = millis();
  }

  return frameCount % 30 < 20 ? glitchCursorCurrent : "";
}

function getBlinkCursor() {
  return getGlitchCursor(true);
}

function getStatusTopCursor(lineIndex) {
  if (statusTypingMode === "top" && lineIndex === statusTopIndex) {
    return getGlitchCursor(true);
  }

  if (statusTypingMode !== "top" && lineIndex === statusTopLines.length - 1) {
    return getGlitchCursor(true);
  }

  return "";
}

function getStatusLabelCursor(rowIndex) {
  if (statusTypingMode === "label" && rowIndex === statusRowIndex) {
    return getGlitchCursor(true);
  }
  return "";
}

function getStatusValueCursor(rowIndex) {
  if (statusTypingMode === "value" && rowIndex === statusRowIndex) {
    return getGlitchCursor(true);
  }

  if ((statusTypingMode === "overall" || statusTypingMode === "done") &&
      rowIndex === statusRowValueTyped.length - 1) {
    return getGlitchCursor(true);
  }

  return "";
}

function getOverallCursor(lineIndex) {
  if (statusTypingMode === "overall" && lineIndex === overallTypingIndex) {
    return getGlitchCursor(true);
  }

  if (statusTypingMode === "done" && lineIndex === overallTypedLines.length - 1) {
    return getGlitchCursor(true);
  }

  return "";
}

function drawHeaderBox() {
  let frameX = width * 0.03;
  let frameY = height * 0.05;
  let frameW = width * 0.94;
  let headerW = min(width * 0.32, 560);
  let headerH = min(height * 0.055, 60);
  let headerX = frameX + frameW - headerW;
  let headerY = frameY;
  let label = "INTELEGENT SAVER COMPUTER V3";
  let paddingX = 16;

  glowRect(headerX, headerY, headerW, headerH, FRAME_COL, FRAME_COL, 10, 4);

  let testSize = 10;
  textFont(customFont);

  while (testSize < 100) {
    textSize(testSize);
    if (textWidth(label) > headerW - paddingX * 2 || testSize > 24) {
      testSize--;
      break;
    }
    testSize++;
  }

  textLayer.fill(...FRAME_COL);
  textLayer.noStroke();
  textLayer.textAlign(LEFT, CENTER);
  textLayer.textSize(testSize);
  textLayer.text(label, headerX + paddingX, headerY + headerH / 2 + 1);
}

function draw() {
  background(0);
  updatePageSound();

  if (currentPage === 1) {
    drawLoadingPage();
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (currentPage === 2) {
    drawWelcomeTypingPage();
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (currentPage === 3) {
    drawNameInputPage();
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (currentPage === 4) {
    drawTerminalPage();
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (isDayPage(currentPage)) {
    drawDayPage(currentPage);
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (currentPage === 22) {
    drawTransferPage();
    drawRetroScanlines();
    drawCRTCurveOverlay();
    endTextLayer();
    return;
  }

  if (pinchCooldown > 0) pinchCooldown--;

  if (currentPage === 21) {
    drawPage21Terminal();
  } else if (currentPage === totalPages) {
    drawLastPageTemplate();
  } else if (isStatusTemplatePage(currentPage)) {
    drawStatusTemplatePage(currentPage);
  } else {
    drawNormalPage(currentPage);
  }

  drawSoundWaveBackground();
  drawRetroScanlines();
  drawCRTCurveOverlay();
  endTextLayer();
  drawHandsTracked();
  handleHandPageTurn();
  drawPageUI();
}

function drawLoadingPage() {
  beginTextLayer();
  background(0);
  drawOuterFrame();

  let elapsed = millis() - loadingStartTime;
  let progress = constrain(elapsed / loadingDuration, 0, 1);
  let percent = floor(progress * 100);

  drawRetroLoadingBox("Loading ...", percent);

  if (progress >= 1 && !loadingFinished) {
    loadingFinished = true;
    setTimeout(() => {
      currentPage = 2;
      welcomeLastTypeTime = millis();
    }, 80);
  }
}

function drawWelcomeTypingPage() {
  beginTextLayer();
  background(0);
  drawOuterFrame();

  let cx = width / 2;
  let cy = height / 2 + height * 0.02;

  if (welcomeCharIndex < welcomeBaseText.length) {
    if (millis() - welcomeLastTypeTime > welcomeTypeInterval) {
      welcomeTyped += welcomeBaseText.charAt(welcomeCharIndex);
      welcomeCharIndex++;
      welcomeLastTypeTime = millis();
    }
  } else if (welcomeDoneTime === 0) {
    welcomeDoneTime = millis();
  } else if (millis() - welcomeDoneTime > 1800) {
    currentPage = 3;
  }

  textLayer.fill(245);
  textLayer.noStroke();
  textLayer.textAlign(CENTER, CENTER);
  textLayer.textSize(min(width * 0.10, 200));
  textLayer.text(welcomeTyped + getBlinkCursor(), cx, cy);
}

function drawNameInputPage() {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  let titleY = height * 0.36;
  let boxW = width * 0.44;
  let boxH = height * 0.11;
  let boxX = width / 2 - boxW / 2;
  let boxY = height * 0.49;

  textLayer.fill(...FRAME_COL);
  textLayer.noStroke();
  textLayer.textAlign(CENTER, CENTER);
  textLayer.textSize(min(width * 0.072, 120));
  textLayer.text("YOUR NAME IS", width / 2, titleY);

  glowRect(boxX, boxY, boxW, boxH, FRAME_COL, FRAME_COL, 10, 4);

  let displayName = userName + getBlinkCursor();

  textLayer.noStroke();
  textLayer.fill(245);
  textLayer.textSize(min(width * 0.038, 58));
  textLayer.textAlign(CENTER, CENTER);
  textLayer.text(displayName, width / 2, boxY + boxH / 2);

  textLayer.fill(...FRAME_COL);
  textLayer.textSize(min(width * 0.014, 18));
  textLayer.text("Type your name and press ENTER", width / 2, boxY + boxH + height * 0.045);
}

function buildTerminalLines() {
  let displayName = userName.trim();
  if (displayName.length === 0) {
    displayName = "USER";
  }

  terminalLines = [
    "INTELEGENT SAVER COMPUTER V3 BY TO// MO__K_",
    "DEBUG ROM V0.3 - 28 JUN 2__0",
    "READY AVAILABLE EMPTY MEMORY",
    "",
    "CARD: NO NAME",
    "CODE: 050202002",
    "OFFSETS: F33 R279 D311",
    "",
    "MONITOR READY.",
    "> MOKKAEKER.exe",
    "",
    "Hello, " + displayName + "!",
    "I WILL STAND BY YOU TO THE WHOLE LIFE",
    "SO BE SURE TO LIVE IT AS BEST !",
    "",
    "(press any key to quit)",
    "Let's go!",
    "",
    "BREAK AT 0117",
    "MONITOR READY.",
    ">"
  ];
}

function drawTerminalLikeBlock(linesTyped, currentLineIndex, currentText, left, top, right, bottom, totalLineCount = null, textSizeCap = 40, targetLayer = null) {
  let layer = targetLayer || window;
  let usableW = right - left;
  let usableH = bottom - top;
  let lineCount = totalLineCount || max(linesTyped.length, 1);
  let lineHeight = usableH / lineCount;
  let terminalTextSize = min(lineHeight * 0.82, width * 0.026, textSizeCap);

  layer.fill(245);
  layer.noStroke();
  layer.textAlign(LEFT, TOP);
  layer.textSize(terminalTextSize);

  for (let i = 0; i < linesTyped.length; i++) {
    let y = top + i * lineHeight;
    layer.text(linesTyped[i], left, y, usableW, lineHeight);
  }

  if (currentText !== null) {
    let cursorY = top + currentLineIndex * lineHeight;
    let safeText = currentText;
    let maxCursorX = right - layer.textWidth("_") - 8;
    let cursorX = left + layer.textWidth(safeText);

    while (cursorX > maxCursorX && safeText.length > 0) {
      safeText = safeText.slice(0, -1);
      cursorX = left + layer.textWidth(safeText);
    }

    let cursorChar = getGlitchCursor(true);
    if (cursorChar !== "") {
      layer.text(cursorChar, cursorX, cursorY);
    }
  }
}

function drawTerminalPage() {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  let left = width * 0.055;
  let top = height * 0.085;
  let right = width * 0.945;
  let bottom = height * 0.90;

  if (terminalCurrentLine < terminalLines.length) {
    if (millis() - terminalLastTypeTime > terminalTypeInterval) {
      let fullLine = terminalLines[terminalCurrentLine];

      if (!terminalTypedLines[terminalCurrentLine]) {
        terminalTypedLines[terminalCurrentLine] = "";
      }

      if (terminalCurrentChar < fullLine.length) {
        terminalTypedLines[terminalCurrentLine] += fullLine.charAt(terminalCurrentChar);
        terminalCurrentChar++;
      } else {
        terminalCurrentLine++;
        terminalCurrentChar = 0;
      }

      terminalLastTypeTime = millis();
    }
  } else if (terminalFinishedTime === 0) {
    terminalFinishedTime = millis();
  } else if (millis() - terminalFinishedTime > 1500) {
    currentPage = 5;
    resetDayAnimation();
  }

  let currentText = null;
  if (terminalCurrentLine < terminalLines.length) {
    currentText = terminalTypedLines[terminalCurrentLine] || "";
  }

  drawTerminalLikeBlock(
    terminalTypedLines,
    terminalCurrentLine,
    currentText,
    left,
    top,
    right,
    bottom,
    terminalLines.length,
    40,
    textLayer
  );
}

function drawPage21Terminal() {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  let left = width * 0.055;
  let top = height * 0.085;
  let right = width * 0.945;
  let bottom = height * 0.90;

  if (page21Lines.length === 0) {
    resetPage21Typing();
  }

  if (page21CurrentLine < page21Lines.length) {
    if (millis() - page21LastTypeTime > page21TypeInterval) {
      let fullLine = page21Lines[page21CurrentLine];

      if (!page21TypedLines[page21CurrentLine]) {
        page21TypedLines[page21CurrentLine] = "";
      }

      if (page21CurrentChar < fullLine.length) {
        page21TypedLines[page21CurrentLine] += fullLine.charAt(page21CurrentChar);
        page21CurrentChar++;
      } else {
        page21CurrentLine++;
        page21CurrentChar = 0;
      }

      page21LastTypeTime = millis();
    }
  }

  let currentText = null;
  let cursorLineIndex = 0;

  if (page21CurrentLine < page21Lines.length) {
    currentText = page21TypedLines[page21CurrentLine] || "";
    cursorLineIndex = page21CurrentLine;
  } else {
    currentText = page21TypedLines[page21TypedLines.length - 1] || "";
    cursorLineIndex = max(page21TypedLines.length - 1, 0);
  }

  drawTerminalLikeBlock(
    page21TypedLines,
    cursorLineIndex,
    currentText,
    left,
    top,
    right,
    bottom,
    page21Lines.length,
    40,
    textLayer
  );
}

function drawDayPage(pageNum) {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  let labelText = getDayLabel(pageNum);

  if (dayCharIndex < labelText.length) {
    if (millis() - dayLastTypeTime > dayTypeInterval) {
      dayTyped += labelText.charAt(dayCharIndex);
      dayCharIndex++;
      dayLastTypeTime = millis();
    }
  } else if (dayDoneTime === 0) {
    dayDoneTime = millis();
  } else if (millis() - dayDoneTime > 1400) {
    currentPage++;
    resetDayAnimation();

    if (isStatusTemplatePage(currentPage)) {
      resetStatusTyping(currentPage);
    }
    if (currentPage === 21) {
      resetPage21Typing();
    }
  }

  textLayer.fill(...FRAME_COL);
  textLayer.noStroke();
  textLayer.textAlign(CENTER, CENTER);
  textLayer.textSize(min(width * 0.12, 220));
  textLayer.text(dayTyped, width / 2, height / 2);
}

function drawStatusTemplatePage(pageNum) {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  const page = getStatusPageData(pageNum);
  if (!page) return;

  if (statusTopLines.length === 0) {
    resetStatusTyping(pageNum);
  }

  updateStatusTypingAnimation(pageNum);

  let leftPad = width * 0.045;
  let topPad = height * 0.085;

  textLayer.fill(245);
  textLayer.noStroke();
  textLayer.textAlign(LEFT, TOP);

  let topTextSize = min(width * 0.024, 34);
  textLayer.textSize(topTextSize);

  let topLineGap = height * 0.043;

  for (let i = 0; i < statusTopLines.length; i++) {
    let line = statusTopTypedLines[i] || "";
    line += getStatusTopCursor(i);
    textLayer.text(line, leftPad, topPad + i * topLineGap);
  }

  let statusX = width * 0.045;
  let statusY = height * 0.40;
  let statusW = width * 0.46;
  let statusH = height * 0.44;
  let statusBarH = height * 0.05;

  glowRect(statusX, statusY, statusW, statusH, FRAME_COL, FRAME_COL, 12, 3);
  glowBarRect(statusX, statusY, statusW, statusBarH);

  textLayer.fill(...TEXT_DARK);
  textLayer.textAlign(LEFT, CENTER);
  textLayer.textSize(min(width * 0.036, 54));
  textLayer.text(page.statusTitle, statusX + 18, statusY + statusBarH / 2);

  let statStartY = statusY + statusBarH + height * 0.03;
  let statGap = height * 0.072;

  let statTextSize = min(width * 0.034, 48);
  textLayer.fill(245);
  textLayer.textSize(statTextSize);

  for (let i = 0; i < page.stats.length; i++) {
    let rowY = statStartY + i * statGap;

    let labelText = statusRowLabelTyped[i] || "";
    let valueText = statusRowValueTyped[i] || "";

    labelText += getStatusLabelCursor(i);
    valueText += getStatusValueCursor(i);

    textLayer.textAlign(LEFT, TOP);
    textLayer.text(labelText, statusX + 18, rowY);

    textLayer.textAlign(RIGHT, TOP);
    textLayer.text(valueText, statusX + statusW - 18, rowY);
  }

  let overallX = width * 0.69;
  let overallY = height * 0.40;
  let overallW = width * 0.28;
  let overallH = height * 0.30;
  let overallBarH = height * 0.042;

  glowRect(overallX, overallY, overallW, overallH, FRAME_COL, FRAME_COL, 12, 3);
  glowBarRect(overallX, overallY, overallW, overallBarH);

  textLayer.fill(...TEXT_DARK);
  textLayer.textAlign(LEFT, CENTER);
  textLayer.textSize(min(width * 0.022, 28));
  textLayer.text(page.overallTitle, overallX + 12, overallY + overallBarH / 2);

  textLayer.fill(245);
  textLayer.textAlign(LEFT, TOP);
  textLayer.textSize(min(width * 0.027, 38));

  let overallTextY = overallY + overallBarH + 8;

  for (let i = 0; i < page.overallLines.length; i++) {
    let line = overallTypedLines[i] || "";
    line += getOverallCursor(i);
    textLayer.text(line, overallX + 14, overallTextY + i * height * 0.06);
  }

  textLayer.fill(...FRAME_COL);
  textLayer.noStroke();
  textLayer.textAlign(RIGHT, BOTTOM);
  textLayer.textSize(min(width * 0.08, 120));
  textLayer.text(page.dayLabel, width * 0.965, height * 0.955);
}

function drawTransferPage() {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  if (!transferStarted) {
    transferStarted = true;
    transferStartTime = millis();
  }

  let elapsed = millis() - transferStartTime;
  let progress = constrain(elapsed / transferDuration, 0, 1);
  let percent = floor(progress * 100);

  drawRetroLoadingBox("Transfer memory...", percent);

  if (progress >= 1 && !transferFinished) {
    transferFinished = true;
    setTimeout(() => {
      currentPage = 23;
    }, 80);
  }
}

function drawRetroLoadingBox(label, percent) {
  let boxW = width * 0.41;
  let boxH = height * 0.30;
  let boxX = width / 2 - boxW / 2;
  let boxY = height / 2 - boxH / 2;
  let topBarH = boxH * 0.18;

  glowRect(boxX, boxY, boxW, boxH, FRAME_COL, FRAME_COL, 12, 3);
  glowBarRect(boxX, boxY, boxW, topBarH);

  let progressFrameX = boxX + boxW * 0.03;
  let progressFrameY = boxY + boxH * 0.28;
  let progressFrameW = boxW * 0.94;
  let progressFrameH = boxH * 0.22;

  glowRect(progressFrameX, progressFrameY, progressFrameW, progressFrameH, FRAME_COL, FRAME_COL, 9, 3);

  let segments = 8;
  let gap = progressFrameW * 0.012;
  let innerPad = progressFrameW * 0.015;
  let segW = (progressFrameW - innerPad * 2 - gap * (segments - 1)) / segments;
  let segH = progressFrameH - innerPad * 2;
  let filledSegments = floor(map(percent, 0, 100, 0, segments));

  for (let i = 0; i < segments; i++) {
    let sx = progressFrameX + innerPad + i * (segW + gap);
    let sy = progressFrameY + innerPad;

    if (i < filledSegments) {
      noStroke();
      fill(...BAR_COL);
      rect(sx, sy, segW, segH);
    } else {
      glowRect(sx, sy, segW, segH, FRAME_COL, FRAME_COL, 6, 2);
    }
  }

  textLayer.fill(245);
  textLayer.noStroke();
  textLayer.textAlign(LEFT, CENTER);
  textLayer.textSize(min(width * 0.042, 62));
  textLayer.text(label, boxX + boxW * 0.03, boxY + boxH * 0.77);

  textLayer.textAlign(RIGHT, CENTER);
  textLayer.text(percent + "%", boxX + boxW * 0.97, boxY + boxH * 0.77);
}

function drawNormalPage(pageNum) {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  let marginX = width * 0.12;
  let marginY = height * 0.14;
  let contentW = width * 0.76;
  let contentH = height * 0.68;

  glowRect(marginX, marginY, contentW, contentH, FRAME_COL, FRAME_COL, 8, 2);

  textLayer.fill(240);
  textLayer.noStroke();
  textLayer.textAlign(LEFT, TOP);
  textLayer.textSize(min(width * 0.04, 42));
  textLayer.text("PAGE " + pageNum, marginX + 20, marginY + 20);

  textLayer.textSize(min(width * 0.022, 28));
  textLayer.text(getPageText(pageNum), marginX + 20, marginY + 90, contentW - 40, contentH - 140);

  glowRect(marginX + 20, marginY + contentH - 35, contentW - 40, 16, FRAME_COL, FRAME_COL, 6, 2);

  noStroke();
  fill(200, 235, 235);
  let progressW = map(pageNum, 1, totalPages, 0, contentW - 46);
  rect(marginX + 23, marginY + contentH - 32, progressW, 10);
}

function drawLastPageTemplate() {
  beginTextLayer();
  background(0);
  drawOuterFrame();
  drawHeaderBox();

  textLayer.fill(...FRAME_COL);
  textLayer.noStroke();
  textLayer.textAlign(LEFT, TOP);
  textLayer.textSize(min(width * 0.014, 20));
  textLayer.text("ESC to restart", width * 0.05, height * 0.065);

  let boxW = width * 0.46;
  let boxH = height * 0.48;
  let boxX = width / 2 - boxW / 2;
  let boxY = height * 0.18;
  let titleBarH = height * 0.045;

  let innerX = boxX;
  let innerY = boxY + titleBarH;
  let innerW = boxW;
  let innerH = boxH - titleBarH;

  noStroke();
  fill(0);
  rect(innerX, innerY, innerW, innerH);

  if (!showOnlyFaceArea) {
    drawVideoFitted(innerX, innerY, innerW, innerH);
    fill(120, 230, 255, 70);
    rect(innerX, innerY, innerW, innerH);
    fill(0, 170);
    rect(innerX, innerY, innerW, innerH);
  }

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(innerX, innerY, innerW, innerH);
  drawingContext.clip();

  if (faceResults && faceResults.multiFaceLandmarks && faceResults.multiFaceLandmarks.length > 0) {
    if (showOnlyFaceArea) {
      drawFaceCutoutVideo(faceResults.multiFaceLandmarks[0], innerX, innerY, innerW, innerH);
    }
    drawMatrixFaceInBox(faceResults.multiFaceLandmarks[0], innerX, innerY, innerW, innerH);
  }

  drawingContext.restore();
  pop();

  glowRect(boxX, boxY, boxW, boxH, FRAME_COL, FRAME_COL, 12, 3);
  glowBarRect(boxX, boxY, boxW, titleBarH);

  textLayer.fill(...TEXT_DARK);
  textLayer.textAlign(LEFT, CENTER);
  textLayer.textSize(min(width * 0.03, 40));
  textLayer.text("IDENTIFY", boxX + 18, boxY + titleBarH / 2);

  textLayer.fill(...FRAME_COL);
  textLayer.textAlign(CENTER, CENTER);
  textLayer.textSize(min(width * 0.045, 70));
  textLayer.text("WELCOME TO A NEW LIFE", width / 2, height * 0.80);
}

function drawFaceCutoutVideo(landmarks, boxX, boxY, boxW, boxH) {
  let facePoly = [];
  for (let idx of FACE_OVAL) {
    let x = width - landmarks[idx].x * width;
    let y = landmarks[idx].y * height;
    facePoly.push({ x, y });
  }

  video.loadPixels();
  if (video.pixels.length === 0) return;

  noStroke();
  let step = 6;

  for (let y = boxY; y < boxY + boxH; y += step) {
    for (let x = boxX; x < boxX + boxW; x += step) {
      if (!pointInPolygon(x, y, facePoly)) continue;

      let sx = floor(map(x, 0, width, width, 0));
      let sy = floor(y);
      sx = constrain(sx, 0, width - 1);
      sy = constrain(sy, 0, height - 1);

      let index = (sx + sy * width) * 4;
      let r = video.pixels[index + 0];
      let g = video.pixels[index + 1];
      let b = video.pixels[index + 2];
      let bright = (r + g + b) / 3;
      let cyanBoost = map(bright, 0, 255, 20, 255);

      fill(100, cyanBoost, 255, 110);
      rect(x, y, step, step);
    }
  }
}

function drawVideoFitted(x, y, w, h) {
  let videoAspect = video.width / video.height;
  let boxAspect = w / h;
  let drawW, drawH;

  if (videoAspect > boxAspect) {
    drawH = h;
    drawW = h * videoAspect;
  } else {
    drawW = w;
    drawH = w / videoAspect;
  }

  let drawX = x + (w - drawW) / 2;
  let drawY = y + (h - drawH) / 2;

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(x, y, w, h);
  drawingContext.clip();

  translate(drawX + drawW, drawY);
  scale(-1, 1);
  image(video, 0, 0, drawW, drawH);

  drawingContext.restore();
  pop();
}

function drawOuterFrame() {
  glowRect(width * 0.03, height * 0.05, width * 0.94, height * 0.90, FRAME_COL, FRAME_COL, 14, 4);
}

function drawPageUI() {
  if (
    currentPage === 1 ||
    currentPage === 2 ||
    currentPage === 3 ||
    currentPage === 4 ||
    currentPage === 22 ||
    isDayPage(currentPage)
  ) return;

  push();
  fill(255);
  noStroke();
  textFont(customFont);
  textAlign(LEFT, CENTER);
  textSize(min(width * 0.017, 24));

  let uiX = width * 0.06;
  let uiY = height * 0.91;
  let uiW = width * 0.50;

  text(
    "Pinch left = previous   |   Pinch right = next   |   Arrow keys also work",
    uiX,
    uiY,
    uiW
  );
  pop();
}

function drawMatrixFaceInBox(landmarks, boxX, boxY, boxW, boxH) {
  video.loadPixels();
  if (video.pixels.length === 0) return;

  faceLayer.clear();
  glowLayer.clear();
  faceLayer.textFont(customFont);

  let facePoly = [];
  for (let idx of FACE_OVAL) {
    let x = width - landmarks[idx].x * width;
    let y = landmarks[idx].y * height;
    facePoly.push({ x, y });
  }

  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let p of facePoly) {
    minX = min(minX, p.x);
    minY = min(minY, p.y);
    maxX = max(maxX, p.x);
    maxY = max(maxY, p.y);
  }

  minX -= 10;
  minY -= 10;
  maxX += 10;
  maxY += 10;

  faceLayer.textSize(min(width * 0.012, 16));
  faceLayer.textAlign(CENTER, CENTER);
  glowLayer.noStroke();

  let stepX = 8;
  let stepY = 10;

  for (let y = minY; y <= maxY; y += stepY) {
    for (let x = minX; x <= maxX; x += stepX) {
      if (!pointInPolygon(x, y, facePoly)) continue;
      if (x < boxX || x > boxX + boxW || y < boxY || y > boxY + boxH) continue;

      let sx = floor(map(x, 0, width, width, 0));
      let sy = floor(y);
      sx = constrain(sx, 0, width - 1);
      sy = constrain(sy, 0, height - 1);

      let index = (sx + sy * width) * 4;
      let r = video.pixels[index + 0];
      let g = video.pixels[index + 1];
      let b = video.pixels[index + 2];
      let bright = (r + g + b) / 3;

      if (bright > 40) {
        let alpha = map(bright, 40, 255, 80, 255);
        let digit = floor(random(10));

        glowLayer.fill(...CYAN_GLOW, alpha * 0.20);
        glowLayer.circle(x, y, map(bright, 40, 255, 12, 24));

        glowLayer.fill(...CYAN_GLOW, alpha * 0.08);
        glowLayer.rect(x - 1, y, 2, random(8, 24));

        faceLayer.fill(...CYAN_MAIN, alpha);
        faceLayer.text(digit, x, y);

        if (random() < 0.10) {
          faceLayer.fill(...CYAN_HIGHLIGHT, alpha);
          faceLayer.text(digit, x, y);
        }
      }
    }
  }

  image(glowLayer, 0, 0);
  image(faceLayer, 0, 0);
}

function pointInPolygon(x, y, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x;
    let yi = polygon[i].y;
    let xj = polygon[j].x;
    let yj = polygon[j].y;

    let intersect =
      ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function drawHandsTracked() {
  if (!handResults || !handResults.multiHandLandmarks) return;

  if (
    currentPage === 1 ||
    currentPage === 2 ||
    currentPage === 3 ||
    currentPage === 4 ||
    currentPage === 22 ||
    isDayPage(currentPage)
  ) return;

  let landmarksList = handResults.multiHandLandmarks;
  let handednessList = handResults.multiHandedness || [];

  for (let i = 0; i < landmarksList.length; i++) {
    let landmarks = landmarksList[i];
    let label = "Unknown";

    if (handednessList[i] && handednessList[i].label) {
      label = handednessList[i].label;
    }

    let handColour;
    if (label === "Left") {
      handColour = color(220, 245, 245);
    } else if (label === "Right") {
      handColour = color(120, 245, 255);
    } else {
      handColour = color(220, 245, 245);
    }

    drawHand(landmarks, handColour);
  }
}

function drawHand(landmarks, handColour) {
  stroke(handColour);
  strokeWeight(2);
  noFill();

  for (let c of HAND_CONNECTIONS) {
    let a = c[0];
    let b = c[1];
    let x1 = width - landmarks[a].x * width;
    let y1 = landmarks[a].y * height;
    let x2 = width - landmarks[b].x * width;
    let y2 = landmarks[b].y * height;
    line(x1, y1, x2, y2);
  }

  noStroke();
  fill(handColour);

  for (let lm of landmarks) {
    let x = width - lm.x * width;
    let y = lm.y * height;
    circle(x, y, 7);
  }
}

function handleHandPageTurn() {
  if (
    currentPage === 1 ||
    currentPage === 2 ||
    currentPage === 3 ||
    currentPage === 4 ||
    currentPage === 22 ||
    isDayPage(currentPage)
  ) return;

  if (!handResults || !handResults.multiHandLandmarks || handResults.multiHandLandmarks.length === 0) {
    lastPinchState = false;
    return;
  }

  let hand = handResults.multiHandLandmarks[0];
  let thumb = hand[4];
  let indexTip = hand[8];
  let wrist = hand[0];

  let tx = width - thumb.x * width;
  let ty = thumb.y * height;
  let ix = width - indexTip.x * width;
  let iy = indexTip.y * height;
  let wx = width - wrist.x * width;

  let pinchDist = dist(tx, ty, ix, iy);
  let isPinching = pinchDist < 30;

  if (isPinching && !lastPinchState && pinchCooldown <= 0) {
    if (wx < width / 2) {
      previousPage();
    } else {
      nextPage();
    }
    pinchCooldown = 25;
  }

  lastPinchState = isPinching;

  noFill();
  glowLine(tx, ty, ix, iy, [120, 245, 255], [120, 245, 255], 7, 1.5);
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;

    if (isStatusTemplatePage(currentPage)) {
      resetStatusTyping(currentPage);
    }
    if (currentPage === 21) {
      resetPage21Typing();
    }
  }
}

function previousPage() {
  if (currentPage > 2) {
    currentPage--;

    if (currentPage < 22) {
      transferStarted = false;
      transferFinished = false;
    }

    if (isStatusTemplatePage(currentPage)) {
      resetStatusTyping(currentPage);
    }
    if (currentPage === 21) {
      resetPage21Typing();
    }
  }
}

function keyPressed() {
  userStartAudio();

  if (currentPage === 23 && keyCode === ESCAPE) {
    restartExperience();
    return false;
  }

  if (
    currentPage === 1 ||
    currentPage === 2 ||
    currentPage === 4 ||
    currentPage === 22 ||
    isDayPage(currentPage)
  ) return;

  if (currentPage === 3) {
    if (keyCode === ENTER || keyCode === RETURN) {
      if (userName.trim().length > 0) {
        buildTerminalLines();
        terminalTypedLines = [];
        terminalCurrentLine = 0;
        terminalCurrentChar = 0;
        terminalLastTypeTime = millis();
        terminalFinishedTime = 0;
        currentPage = 4;
      }
    } else if (keyCode === BACKSPACE) {
      userName = userName.slice(0, -1);
    }
    return;
  }

  if (keyCode === RIGHT_ARROW) nextPage();
  if (keyCode === LEFT_ARROW) previousPage();
}

function keyTyped() {
  if (currentPage === 3) {
    if (userName.length < maxNameLength) {
      if (/^[a-zA-Z0-9 _-]$/.test(key)) {
        userName += key;
      }
    }
    return false;
  }
}

function mousePressed() {
  userStartAudio();

  if (
    currentPage === 1 ||
    currentPage === 2 ||
    currentPage === 3 ||
    currentPage === 4 ||
    currentPage === 22 ||
    isDayPage(currentPage)
  ) return;

  if (mouseX > width / 2) {
    nextPage();
  } else {
    previousPage();
  }
}

function restartExperience() {
  currentPage = 1;
  loadingFinished = false;
  loadingStartTime = millis();

  transferStarted = false;
  transferFinished = false;
  transferStartTime = 0;

  welcomeTyped = "";
  welcomeCharIndex = 0;
  welcomeLastTypeTime = millis();
  welcomeDoneTime = 0;

  userName = "";

  terminalLines = [];
  terminalTypedLines = [];
  terminalCurrentLine = 0;
  terminalCurrentChar = 0;
  terminalLastTypeTime = millis();
  terminalFinishedTime = 0;

  page21Lines = [];
  page21TypedLines = [];
  page21CurrentLine = 0;
  page21CurrentChar = 0;
  page21LastTypeTime = millis();

  resetDayAnimation();

  statusTopLines = [];
  statusTopTypedLines = [];
  statusTopIndex = 0;
  statusTopChar = 0;
  statusTopLastTypeTime = millis();

  statusRowLabelTyped = [];
  statusRowValueTyped = [];
  statusRowIndex = 0;
  statusRowLabelChar = 0;
  statusRowValueChar = 0;
  statusTypingMode = "top";
  statusRowLastTypeTime = millis();

  overallTypedLines = [];
  overallTypingIndex = 0;
  overallTypingChar = 0;
  overallLastTypeTime = millis();

  glitchCursorCurrent = "_";
  glitchCursorLastChange = millis();

  waveParticles = [];

  if (currentPlayingSound && currentPlayingSound.isPlaying()) {
    currentPlayingSound.stop();
  }
  currentPlayingSound = null;
  lastSoundPage = -1;
}

function getPageText(pageNum) {
  const pages = {
    22: "Transfer memory screen.",
    23: "Final face camera page."
  };
  return pages[pageNum] || "No content.";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  faceLayer = createGraphics(width, height);
  glowLayer = createGraphics(width, height);
  textLayer = createGraphics(width, height);

  faceLayer.textFont(customFont);
  glowLayer.textFont(customFont);
  textLayer.textFont(customFont);

  video.size(width, height);
}