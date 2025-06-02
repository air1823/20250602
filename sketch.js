let grid = [];
let charGrid = [];
let colorGrid = []; // 新增：記錄每顆球的顏色
let cols, rows; 
let size = 32; // 原本是10，改大一點

let handPose;
let video;
let hands = [];
let options = {flipped: true};

let dropInterval = 150; // 2秒（假設60fps）
let lastDropFrame = 0;
let fallInterval = 15;   // 每15幀才下落一次
let fallFrame = 0;

let score = 0; // 新增分數變數

// 全域
let effects = [];

let difficultySelect; // 下拉式選單
let timerButton; // 計時按鈕
let gameTimer = null; // 計時器
let timeLeft = 60; // 倒數計時秒數

function preload() {
  handPose = ml5.handPose(options);
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, {flipped: true});
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);

  cols = floor(width / size);
  rows = floor(height / size);
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    charGrid[i] = [];
    colorGrid[i] = [];
    for (let j = 0; j < rows; j++) {
      grid[i][j] = 0;
      charGrid[i][j] = null;
      colorGrid[i][j] = null;
    }
  }

  // 新增下拉式選單
  difficultySelect = createSelect();
  difficultySelect.position(10, 10);
  difficultySelect.option('簡單');
  difficultySelect.option('普通');
  difficultySelect.option('困難');
  difficultySelect.selected('普通'); // 預設值
  difficultySelect.style('background-color', '#FFCCFF'); // 粉紫色背景
  difficultySelect.style('color', '#FF4080'); // 粉紅文字
  difficultySelect.style('font-size', '16px'); // 可愛字體大小
  difficultySelect.style('border', '2px solid #FF80C0'); // 粉紅邊框
  difficultySelect.style('border-radius', '8px'); // 圓角
  difficultySelect.changed(changeDifficulty);

  // 新增計時按鈕
  timerButton = createButton('計時');
  timerButton.position(80, 10); // 按鈕位置向左移動
  timerButton.style('background-color', '#FFCCFF'); // 粉紫色背景
  timerButton.style('color', '#FF4080'); // 粉紅文字
  timerButton.style('font-size', '16px'); // 可愛字體大小
  timerButton.style('border', '2px solid #FF80C0'); // 粉紅邊框
  timerButton.style('border-radius', '8px'); // 圓角
  timerButton.style('padding', '6px 12px'); // 增加內距
  timerButton.mousePressed(startTimer);

  // 新增結束按鈕
  let endButton = createButton('結束');
  endButton.position(160, 10); // 按鈕位置向左移動
  endButton.style('background-color', '#FFCCFF'); // 粉紫色背景
  endButton.style('color', '#FF4080'); // 粉紅文字
  endButton.style('font-size', '16px'); // 可愛字體大小
  endButton.style('border', '2px solid #FF80C0'); // 粉紅邊框
  endButton.style('border-radius', '8px'); // 圓角
  endButton.style('padding', '6px 12px'); // 增加內距
  endButton.mousePressed(() => {
    endGame(); // 直接跳出結算畫面
  });
}

let showIntro = true;
let introEffects = [];

function draw() {
  background(0);
  image(video, 0, 0, width, height);

  if (showIntro) {
    drawIntro();
    drawIntroEffects();
    return; // 不進行遊戲主邏輯
  }

  let fingerXGrid = null;
  if (hands.length > 0) {
    let hand = hands[0];
    let indexFinger = hand.keypoints[8];
    fingerXGrid = floor(indexFinger.x / size);
    fingerXGrid = constrain(fingerXGrid, 0, cols - 1);

    // 畫透明提示格子
    fill(255, 255, 0, 60); // 黃色，透明度60
    noStroke();
    rect(fingerXGrid * size, 0, size, height);

    // 只有沒有球在空中時才產生新球
    if (!hasFallingBall() && frameCount - lastDropFrame > dropInterval) {
      addCoins(indexFinger.x, indexFinger.y);
      lastDropFrame = frameCount;
    }
  }

  drawRect();

  // 在 draw() 裡分數區塊
  fill(255, 204, 255, 180); // 粉紫色
  rect(width - 170, 0, 170, 48, 16);
  fill(255, 80, 180);
  textAlign(RIGHT, TOP);
  textSize(32);
  text("得分: " + score, width - 35, 10);

  // 控制下落速度
  fallFrame++;
  if (fallFrame >= fallInterval) {
    let nextGrid = [];
    let nextCharGrid = [];
    let nextColorGrid = [];
    for (let i = 0; i < cols; i++) {
      nextGrid[i] = [];
      nextCharGrid[i] = [];
      nextColorGrid[i] = [];
      for (let j = 0; j < rows; j++) {
        nextGrid[i][j] = 0;
        nextCharGrid[i][j] = null;
        nextColorGrid[i][j] = null;
      }
    }

    for (let i = 0; i < cols; i++) {
      for (let j = rows - 1; j >= 0; j--) {
        let state = grid[i][j];
        let c = charGrid[i][j];
        let col = colorGrid[i][j];
        if (state > 0) {
          let newI = i;
          // 只有「最上面那顆球」才允許左右移動
          let isTop = (j === 0) || (grid[i][j - 1] === 0);
          if (
            fingerXGrid !== null &&
            j + 1 < rows &&
            grid[i][j + 1] === 0 &&
            nextGrid[i][j + 1] === 0 &&
            isTop // 只有最上面那顆球才跟手指
          ) {
            if (fingerXGrid > i && i < cols - 1 && grid[i + 1][j] === 0 && grid[i + 1][j + 1] === 0) newI = i + 1;
            else if (fingerXGrid < i && i > 0 && grid[i - 1][j] === 0 && grid[i - 1][j + 1] === 0) newI = i - 1;
          }
          // 嘗試往下移動
          if (j + 1 < rows && grid[newI][j + 1] === 0 && nextGrid[newI][j + 1] === 0) {
            nextGrid[newI][j + 1] = state;
            nextCharGrid[newI][j + 1] = c;
            nextColorGrid[newI][j + 1] = col;
          } else {
            nextGrid[i][j] = state;
            nextCharGrid[i][j] = c;
            nextColorGrid[i][j] = col;
          }
        }
      }
    }
    grid = nextGrid;
    charGrid = nextCharGrid;
    colorGrid = nextColorGrid;

    // 檢查是否有「淡江大學教科系」橫向或直向連續排列
    checkAndRemoveSequence();

    fallFrame = 0;
  }

  // draw() 裡繪製特效
  for (let e = effects.length - 1; e >= 0; e--) {
    let eff = effects[e];
    let px = eff.x * size + size / 2;
    let py = eff.y * size + size / 2;
    for (let n = 0; n < 10; n++) {
      let angle = random(TWO_PI);
      let r = eff.t * random(1, 2);
      let ex = px + cos(angle) * r;
      let ey = py + sin(angle) * r;
      fill(random(200,255), random(100,255), random(200,255), 180 - eff.t*8);
      noStroke();
      ellipse(ex, ey, random(4,8));
    }
    eff.t++;
    if (eff.t > 15) effects.splice(e, 1);
  }

  // 繪製倒數計時
  if (gameTimer !== null) {
    fill(255, 204, 255, 180); // 粉紫色
    rect(width - 170, 50, 170, 48, 16);
    fill(255, 80, 180);
    textAlign(RIGHT, TOP);
    textSize(32);
    text("時間: " + timeLeft, width - 35, 60);
  }

  // 確保結算畫面在最上層
  if (noLoopCalled) {
    endGameRender(); // 將結算畫面的繪製移到這裡
  }
}

function drawBoardGrid() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 2 === 0) {
        fill(255, 220, 235, 90); // 粉色
      } else {
        fill(200, 235, 255, 90); // 淡藍
      }
      noStroke();
      rect(i * size, j * size, size, size, 10); // 圓角
    }
  }
}

function drawRect() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j] > 0) {
        let col = colorGrid[i][j];
        if (!col) col = color(220, 220, 220);
        noStroke();
        // 陰影
        fill(red(col), green(col), blue(col), 80);
        ellipse(i * size + size / 2 + size/8, j * size + size / 2 + size/8, size * 0.95, size * 0.95);
        // 球本體
        fill(col);
        ellipse(i * size + size / 2, j * size + size / 2, size, size);
        // 高光
        fill(255, 255, 255, 120);
        ellipse(i * size + size / 2 - size / 5, j * size + size / 2 - size / 5, size / 3, size / 3);
        // 文字
        let c = charGrid[i][j];
        if (c) {
          fill(80, 40, 40);
          textAlign(CENTER, CENTER);
          textSize(size * 0.7);
          text(c, i * size + size / 2, j * size + size / 2);
        }
      }
    }
  }
}

function addCoins(fingerX, fingerY) {
  const chars = ["淡", "江", "大", "學", "教", "科", "系"];
  const candyColors = [
    color(255, 153, 204), // 粉紅
    color(255, 204, 102), // 橙黃
    color(153, 204, 255), // 淡藍
    color(204, 255, 153), // 淡綠
    color(255, 255, 153), // 淡黃
    color(255, 153, 153), // 淡紅
    color(204, 153, 255)  // 淡紫
  ];
  let x = floor(fingerX / size);
  let y = floor(fingerY / size);
  x = constrain(x, 0, cols-1);
  y = constrain(y, 0, rows-1);
  for (let j = 0; j < rows; j++) {
    if (grid[x][j] === 0) {
      grid[x][j] = (frameCount % 205) + 50;
      charGrid[x][j] = chars[floor(random(chars.length))];
      colorGrid[x][j] = random(candyColors);
      break;
    }
  }
}

// 新增：檢查並消除「淡江大學教科系」橫向連續排列
function checkAndRemoveSequence() {
  // 支援多種可消除組合
  const targets = [
    ["淡", "江", "大", "學"],
    ["教", "科", "系"],
    ["淡", "大", "教", "科"]
  ];

  // 檢查橫向
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      for (let t = 0; t < targets.length; t++) {
        let target = targets[t];
        if (i + target.length <= cols) {
          let match = true;
          for (let k = 0; k < target.length; k++) {
            if (charGrid[i + k][j] !== target[k] || grid[i + k][j] === 0) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let k = 0; k < target.length; k++) {
              effects.push({x: i + k, y: j, t: 0});
              grid[i + k][j] = 0;
              charGrid[i + k][j] = null;
            }
            score++;
          }
        }
      }
    }
  }
  // 檢查直向
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      for (let t = 0; t < targets.length; t++) {
        let target = targets[t];
        if (j + target.length <= rows) {
          let match = true;
          for (let k = 0; k < target.length; k++) {
            if (charGrid[i][j + k] !== target[k] || grid[i][j + k] === 0) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let k = 0; k < target.length; k++) {
              effects.push({x: i, y: j + k, t: 0});
              grid[i][j + k] = 0;
              charGrid[i][j + k] = null;
            }
            score++;
          }
        }
      }
    }
  }
}

function gotHands(results) {
  hands = results;
}

function hasFallingBall() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows - 1; j++) {
      if (grid[i][j] > 0 && grid[i][j + 1] === 0) {
        return true; // 有球下方是空的，表示還在下落
      }
    }
  }
  return false;
}

// 畫說明區塊和按鈕
function drawIntro() {
  let margin = size * 2;
  let boxH = height - margin * 2;
  let boxW = width * 0.8;
  let boxX = (width - boxW) / 2;
  let boxY = margin;

  // 白色半透明長方形
  fill(255, 180);
  rect(boxX, boxY, boxW, boxH, 24);

  // 規則文字
  fill(120, 80, 180);
  textAlign(CENTER, TOP);
  textSize(28);
  text("淡大教科消消樂", width / 2, boxY + 32);

  fill(80);
  textSize(18);
  textAlign(CENTER, TOP);
  text(
    "規則說明：\n" +
    "1. 用手指控制球球掉落的位置。\n" +
    "2. 球球上會隨機出現\n「淡」「江」「大」「學」「教」「科」「系」等字。\n" +
    "3. 當「淡江大學」、「教科系」、「淡大教科」\n等組合橫向或直向連成一線時\n" +
    "   球球會消除並獲得分數。\n" +
    "4. 在左上方可以選擇模式，預設為普通。\n" ,
    boxX + 20, boxY + 80, boxW - 60, boxH - 120 // ←這裡加上 boxX+20，並將寬度縮小
  );

  // 開始按鈕
  let btnW = 160, btnH = 48;
  let btnX = width / 2 - btnW / 2;
  let btnY = boxY + boxH - btnH - 32;
  fill(255, 153, 204, 220);
  stroke(255, 80, 180);
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 24);
  noStroke();
  fill(255, 80, 180);
  textSize(24);
  textAlign(CENTER, CENTER);
  text("開始遊戲", width / 2, btnY + btnH / 2);

  // 儲存按鈕區域供 mousePressed 用
  drawIntro.btn = {x: btnX, y: btnY, w: btnW, h: btnH};
}

// 點擊開始按鈕時觸發特效
function mousePressed() {
  if (showIntro && drawIntro.btn) {
    let b = drawIntro.btn;
    if (mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h) {
      // 在 intro 區域產生繽紛特效
      let margin = size * 2;
      let boxH = height - margin * 2;
      let boxW = width * 0.8;
      let boxX = (width - boxW) / 2;
      let boxY = margin;
      for (let i = 0; i < 20; i++) {
        let rx = random(boxX + 40, boxX + boxW - 40);
        let ry = random(boxY + 40, boxY + boxH - 40);
        introEffects.push({x: rx, y: ry, t: 0});
      }
      showIntro = false;
    }
  }
}

// intro特效動畫
function drawIntroEffects() {
  for (let e = introEffects.length - 1; e >= 0; e--) {
    let eff = introEffects[e];
    for (let n = 0; n < 12; n++) {
      let angle = random(TWO_PI);
      let r = eff.t * random(1, 2.5);
      let ex = eff.x + cos(angle) * r;
      let ey = eff.y + sin(angle) * r;
      fill(random(200,255), random(100,255), random(200,255), 180 - eff.t*8);
      noStroke();
      ellipse(ex, ey, random(6,12));
    }
    eff.t++;
    if (eff.t > 18) introEffects.splice(e, 1);
  }
}

function changeDifficulty() {
  const selected = difficultySelect.value();
  if (selected === '簡單') {
    fallInterval = 20; // 球下降速度變慢
  } else if (selected === '普通') {
    fallInterval = 15; // 球下降速度保持不變
  } else if (selected === '困難') {
    fallInterval = 10; // 球下降速度變快
  }
}

function startTimer() {
  if (gameTimer === null) {
    gameTimer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(gameTimer);
        gameTimer = null;
        endGame();
      }
    }, 1000);
  }
}

function endGame() {
  if (!noLoopCalled) { // 確保只執行一次
    noLoopCalled = true;

    noLoop(); // 停止遊戲

    // 停止計時器
    if (gameTimer !== null) {
      clearInterval(gameTimer);
      gameTimer = null;
    }

    // 白色半透明長方形
    let margin = size * 2;
    let boxH = height - margin * 2;
    let boxW = width * 0.8;
    let boxX = (width - boxW) / 2;
    let boxY = margin;

    fill(255, 180); // 白色半透明
    rect(boxX, boxY, boxW, boxH, 24); // 圓角矩形

    // 顯示分數文字
    fill(120, 80, 180); // 粉紫色文字
    textAlign(CENTER, TOP);
    textSize(28); // 可愛字體大小
    text("遊戲結束", width / 2, boxY + 32);

    fill(80);
    textSize(18);
    textAlign(CENTER, TOP);
    text(
      `恭喜獲得: ${score} 分\n` +
      "點擊重新開始按鈕以重新遊戲。",
      boxX + 20, boxY + 80, boxW - 60, boxH - 120 // 調整文字位置和寬度
    );

    // 重新開始按鈕
    let btnW = 160, btnH = 48;
    let btnX = width / 2 - btnW / 2;
    let btnY = boxY + boxH - btnH - 32;
    let restartButton = createButton('重新開始');
    restartButton.position(btnX, btnY); // 按鈕位置
    restartButton.style('background-color', '#FFCCFF'); // 粉紫色背景
    restartButton.style('color', '#FF4080'); // 粉紅文字
    restartButton.style('font-size', '16px'); // 可愛字體大小
    restartButton.style('border', '2px solid #FF80C0'); // 粉紅邊框
    restartButton.style('border-radius', '8px'); // 圓角
    restartButton.style('padding', '6px 12px'); // 增加內距
    restartButton.mousePressed(() => {
      // 重置遊戲狀態
      score = 0; // 重置分數
      timeLeft = 60; // 重置倒數計時
      fallFrame = 0; // 重置下落計時
      lastDropFrame = 0; // 重置最後下落時間
      grid = [];
      charGrid = [];
      colorGrid = [];
      effects = [];
      for (let i = 0; i < cols; i++) {
        grid[i] = [];
        charGrid[i] = [];
        colorGrid[i] = [];
        for (let j = 0; j < rows; j++) {
          grid[i][j] = 0;
          charGrid[i][j] = null;
          colorGrid[i][j] = null;
        }
      }
      noLoopCalled = false; // 重置狀態
      loop(); // 恢復遊戲
      restartButton.remove(); // 移除按鈕
    });
  }
}

// 新增全域變數
let noLoopCalled = false; // 確保結算畫面只顯示一次

function endGameRender() {
  // 白色半透明長方形
  let margin = size * 2;
  let boxH = height - margin * 2;
  let boxW = width * 0.8;
  let boxX = (width - boxW) / 2;
  let boxY = margin;

  fill(255, 180); // 白色半透明
  rect(boxX, boxY, boxW, boxH, 24); // 圓角矩形

  // 顯示分數文字
  fill(120, 80, 180); // 粉紫色文字
  textAlign(CENTER, TOP);
  textSize(28); // 可愛字體大小
  text("遊戲結束", width / 2, boxY + 32);

  fill(80);
  textSize(18);
  textAlign(CENTER, TOP);
  text(
    `恭喜獲得: ${score} 分\n` +
    "點擊重新開始按鈕以重新遊戲。",
    boxX + 20, boxY + 80, boxW - 60, boxH - 120 // 調整文字位置和寬度
  );
}

