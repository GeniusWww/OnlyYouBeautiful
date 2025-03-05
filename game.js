/**
 * Chrome 恐龙游戏 - 游戏逻辑实现
 * 实现了跳跃的恐龙角色、自动生成的障碍物、计分系统、游戏难度递增、日/夜模式切换和音效
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const gameOverScreen = document.getElementById('game-over');
    const startScreen = document.getElementById('start-screen');
    const toggleModeBtn = document.getElementById('toggle-mode');
    const toggleSoundBtn = document.getElementById('toggle-sound');
    const restartBtn = document.getElementById('restart');
    
    // 加载恐龙图片
    const dinoImage = new Image();
    dinoImage.src = 'img/cxk.png';
    
    // 音效元素
    const jumpSound = document.getElementById('jump-sound');
    const collisionSound = document.getElementById('collision-sound');
    const pointSound = document.getElementById('point-sound');
    
    // 游戏配置
    const config = {
        gravity: 0.6,         // 重力加速度
        jumpForce: -15,       // 跳跃力度
        groundHeight: 20,     // 地面高度
        gameSpeed: 5,         // 初始游戏速度
        maxSpeed: 12,         // 最大游戏速度
        speedIncrement: 0.0002, // 速度增量
        obstacleInterval: 1500, // 障碍物生成间隔(ms)
        minObstacleInterval: 700, // 最小障碍物生成间隔
        soundEnabled: true,   // 声音开关
        darkMode: false,      // 暗色模式开关
        scoreIncrement: 0.1   // 分数增量
    };
    
    // 游戏状态
    let gameState = {
        running: false,
        gameOver: false,
        score: 0,
        highScore: localStorage.getItem('dinoHighScore') || 0,
        lastObstacleTime: 0,
        obstacles: [],
        nextObstacleInterval: config.obstacleInterval,
        animationFrame: null,
        lastFrameTime: 0,
        crouching: false
    };
    
    // 恐龙角色
    const dino = {
        x: 50,
        y: 0,
        width: 40,
        height: 60,
        velocityY: 0,
        jumping: false,
        crouchHeight: 30,  // 下蹲时的高度
        normalHeight: 60,  // 正常高度
        draw() {
            // 根据是否下蹲调整恐龙形状
            if (gameState.crouching && !this.jumping) {
                // 下蹲状态 - 绘制扁平的恐龙
                this.height = this.crouchHeight;
                this.y = canvas.height - this.height - config.groundHeight;
                
                // 绘制下蹲状态的图片（拉伸处理）
                ctx.drawImage(
                    dinoImage, 
                    this.x, 
                    this.y, 
                    this.width + 10, // 下蹲时宽度增加
                    this.crouchHeight
                );
            } else {
                // 正常状态 - 绘制直立的恐龙
                this.height = this.normalHeight;
                
                // 绘制正常状态的图片
                ctx.drawImage(
                    dinoImage, 
                    this.x, 
                    this.y, 
                    this.width, 
                    this.normalHeight
                );
            }
            
            // 不再需要绘制眼睛细节，因为图片已经包含了
        },
        update() {
            // 应用重力
            this.velocityY += config.gravity;
            this.y += this.velocityY;
            
            // 地面碰撞检测
            const groundY = canvas.height - this.height - config.groundHeight;
            if (this.y > groundY) {
                this.y = groundY;
                this.velocityY = 0;
                this.jumping = false;
            }
        },
        jump() {
            // 只有在地面上才能跳跃
            if (!this.jumping) {
                this.velocityY = config.jumpForce;
                this.jumping = true;
                
                // 播放跳跃音效
                if (config.soundEnabled) {
                    jumpSound.currentTime = 0;
                    jumpSound.play().catch(e => console.log('音频播放失败:', e));
                }
            }
        },
        crouch(isCrouching) {
            gameState.crouching = isCrouching;
        },
        reset() {
            this.y = canvas.height - this.height - config.groundHeight;
            this.velocityY = 0;
            this.jumping = false;
        }
    };
    
    // 障碍物类型
    const obstacleTypes = [
        {
            name: 'cactus',
            width: 20,
            height: 50,
            y: 0,  // 将根据地面高度计算
            draw(x, ctx) {
                const y = canvas.height - this.height - config.groundHeight;
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--obstacle-color');
                ctx.fillRect(x, y, this.width, this.height);
                
                // 添加仙人掌细节
                ctx.fillRect(x - 5, y + 20, 5, 20);
                ctx.fillRect(x + this.width, y + 15, 5, 15);
            }
        }
    ];
    
    // 生成障碍物
    function createObstacle() {
        // 随机选择障碍物类型
        const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
        const type = obstacleTypes[typeIndex];
        
        let obstacleY;
        if (type.name === 'bird') {
            // 鸟的高度随机 - 可以是高空、中空或低空
            const heightOptions = [
                canvas.height - 120 - config.groundHeight,  // 高空
                canvas.height - 80 - config.groundHeight,   // 中空
                canvas.height - 50 - config.groundHeight    // 低空
            ];
            obstacleY = heightOptions[Math.floor(Math.random() * heightOptions.length)];
        } else {
            // 仙人掌在地面上
            obstacleY = canvas.height - type.height - config.groundHeight;
        }
        
        // 创建障碍物对象
        const obstacle = {
            x: canvas.width,
            y: obstacleY,
            width: type.width,
            height: type.height,
            type: type
        };
        
        gameState.obstacles.push(obstacle);
        
        // 根据游戏速度动态调整下一个障碍物的生成间隔
        const speedFactor = config.gameSpeed / config.maxSpeed;
        const intervalReduction = (config.obstacleInterval - config.minObstacleInterval) * speedFactor;
        gameState.nextObstacleInterval = config.obstacleInterval - intervalReduction;
    }
    
    // 更新障碍物
    function updateObstacles(deltaTime) {
        const currentTime = performance.now();
        
        // 检查是否应该生成新的障碍物
        if (currentTime - gameState.lastObstacleTime > gameState.nextObstacleInterval) {
            createObstacle();
            gameState.lastObstacleTime = currentTime;
        }
        
        // 更新所有障碍物的位置
        for (let i = 0; i < gameState.obstacles.length; i++) {
            const obstacle = gameState.obstacles[i];
            obstacle.x -= config.gameSpeed * (deltaTime / 16); // 根据帧率调整移动速度
            
            // 移除已经移出屏幕的障碍物
            if (obstacle.x + obstacle.width < 0) {
                gameState.obstacles.splice(i, 1);
                i--;
            }
        }
    }
    
    // 绘制障碍物
    function drawObstacles() {
        gameState.obstacles.forEach(obstacle => {
            obstacle.type.draw(obstacle.x, ctx);
        });
    }
    
    // 绘制地面
    function drawGround() {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ground-color');
        ctx.fillRect(0, canvas.height - config.groundHeight, canvas.width, config.groundHeight);
        
        // 添加地面纹理
        ctx.fillStyle = config.darkMode ? '#3c4043' : '#ccc';
        for (let i = 0; i < canvas.width; i += 50) {
            const height = Math.random() * 5 + 2;
            ctx.fillRect(i, canvas.height - config.groundHeight + 5, 20, height);
        }
    }
    
    // 碰撞检测
    function checkCollision() {
        const hitboxPadding = 5; // 减小碰撞检测的缓冲区，使碰撞更精确
        for (const obstacle of gameState.obstacles) {
            // 根据恐龙状态调整碰撞盒大小，使其更贴近视觉边界
            const dinoHitbox = {
                x: dino.x + hitboxPadding,
                y: dino.y + hitboxPadding,
                width: dino.width - (hitboxPadding * 2),
                height: dino.height - (hitboxPadding * 2)
            };
            
            // 为障碍物设置更精确的碰撞盒
            const obstacleHitbox = {
                x: obstacle.x + hitboxPadding,
                y: obstacle.y + hitboxPadding,
                width: obstacle.width - (hitboxPadding * 2),
                height: obstacle.height - (hitboxPadding * 2)
            };
            
            // 如果恐龙处于下蹲状态，进一步调整碰撞盒
            if (gameState.crouching && !dino.jumping) {
                dinoHitbox.height = dino.crouchHeight - (hitboxPadding * 2);
            }
            
            if (
                dinoHitbox.x < obstacleHitbox.x + obstacleHitbox.width &&
                dinoHitbox.x + dinoHitbox.width > obstacleHitbox.x &&
                dinoHitbox.y < obstacleHitbox.y + obstacleHitbox.height &&
                dinoHitbox.y + dinoHitbox.height > obstacleHitbox.y
            ) {
                return true; // 发生碰撞
            }
        }
        return false; // 没有碰撞
    }
    
    // 游戏结束处理
    function handleGameOver() {
        gameState.running = false;
        gameState.gameOver = true;
        gameOverScreen.classList.remove('hidden');
        restartBtn.classList.remove('hidden');
        
        // 播放碰撞音效
        if (config.soundEnabled) {
            collisionSound.currentTime = 0;
            collisionSound.play().catch(e => console.log('音频播放失败:', e));
        }
        
        // 更新最高分
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('dinoHighScore', gameState.highScore);
            highScoreElement.textContent = `HI: ${Math.floor(gameState.highScore)}`;
        }
    }
    
    // 重置游戏
    function resetGame() {
        // 确保所有游戏状态完全重置
        gameState.running = true;
        gameState.gameOver = false;
        gameState.score = 0;
        gameState.obstacles = [];
        gameState.lastObstacleTime = performance.now();
        gameState.nextObstacleInterval = config.obstacleInterval;
        gameState.lastFrameTime = performance.now();
        gameState.crouching = false;
        config.gameSpeed = 5; // 重置游戏速度
        
        // 重置UI元素
        scoreElement.textContent = '0';
        gameOverScreen.classList.add('hidden');
        restartBtn.classList.add('hidden');
        startScreen.classList.add('hidden');
        
        // 重置恐龙状态
        dino.reset();
        
        // 确保动画帧正确重启
        if (gameState.animationFrame) {
            cancelAnimationFrame(gameState.animationFrame);
        }
        gameState.animationFrame = requestAnimationFrame(gameLoop);
    }
    
    // 更新分数
    function updateScore(deltaTime) {
        if (gameState.running) {
            gameState.score += config.scoreIncrement * (deltaTime / 16) * (config.gameSpeed / 5);
            scoreElement.textContent = Math.floor(gameState.score);
            
            // 每100分播放得分音效
            if (Math.floor(gameState.score) % 100 === 0 && Math.floor(gameState.score) > 0) {
                if (config.soundEnabled) {
                    pointSound.currentTime = 0;
                    pointSound.play().catch(e => console.log('音频播放失败:', e));
                }
            }
            
            // 随着分数增加游戏速度
            if (config.gameSpeed < config.maxSpeed) {
                config.gameSpeed += config.speedIncrement * deltaTime;
            }
        }
    }
    
    // 游戏主循环
    function gameLoop(timestamp) {
        // 计算帧间隔时间
        const deltaTime = timestamp - gameState.lastFrameTime || 0;
        gameState.lastFrameTime = timestamp;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 更新游戏状态
        if (gameState.running) {
            // 更新恐龙位置
            dino.update();
            
            // 更新障碍物
            updateObstacles(deltaTime);
            
            // 更新分数
            updateScore(deltaTime);
            
            // 检查碰撞
            if (checkCollision()) {
                handleGameOver();
            }
        }
        
        // 绘制游戏元素
        drawGround();
        dino.draw();
        drawObstacles();
        
        // 继续游戏循环
        if (!gameState.gameOver) {
            gameState.animationFrame = requestAnimationFrame(gameLoop);
        }
    }
    
    // 调整画布大小
    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        // 重置恐龙位置
        if (!gameState.running) {
            dino.y = canvas.height - dino.height - config.groundHeight;
        }
    }
    
    // 切换日/夜模式
    function toggleDarkMode() {
        config.darkMode = !config.darkMode;
        document.body.classList.toggle('dark-mode');
        toggleModeBtn.querySelector('.icon').textContent = config.darkMode ? '🌞' : '🌓';
    }
    
    // 切换声音
    function toggleSound() {
        config.soundEnabled = !config.soundEnabled;
        toggleSoundBtn.querySelector('.icon').textContent = config.soundEnabled ? '🔊' : '🔇';
    }
    
    // 开始游戏
    function startGame() {
        if (gameState.gameOver) {
            resetGame();
        }
        
        if (!gameState.running) {
            gameState.running = true;
            startScreen.classList.add('hidden');
            gameState.lastObstacleTime = performance.now();
            gameState.animationFrame = requestAnimationFrame(gameLoop);
        }
    }
    
    // 初始化游戏
    function init() {
        // 设置画布大小
        resizeCanvas();
        
        // 初始化恐龙位置
        dino.y = canvas.height - dino.height - config.groundHeight;
        
        // 显示最高分
        highScoreElement.textContent = `HI: ${Math.floor(gameState.highScore)}`;
        
        // 绘制初始画面
        drawGround();
        dino.draw();
        
        // 添加事件监听
        window.addEventListener('resize', resizeCanvas);
        
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) {
                if (!gameState.running && !gameState.gameOver) {
                    startGame();
                } else if (gameState.gameOver) {
                    resetGame();
                } else {
                    dino.jump();
                }
                e.preventDefault();
            } else if (e.code === 'ArrowDown') {
                dino.crouch(true);
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowDown') {
                dino.crouch(false);
                e.preventDefault();
            }
        });
        
        // 触摸控制
        let lastTapTime = 0;
        canvas.addEventListener('touchstart', (e) => {
            const currentTime = performance.now();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                // 双击 - 下蹲
                dino.crouch(true);
                setTimeout(() => dino.crouch(false), 500); // 短暂下蹲后恢复
            } else {
                // 单击 - 跳跃或开始游戏
                if (!gameState.running && !gameState.gameOver) {
                    startGame();
                } else if (gameState.gameOver) {
                    resetGame();
                } else {
                    dino.jump();
                }
            }
            
            lastTapTime = currentTime;
            e.preventDefault();
        });
        
        // 点击屏幕开始游戏
        canvas.addEventListener('click', () => {
            if (!gameState.running && !gameState.gameOver) {
                startGame();
            } else if (gameState.gameOver) {
                resetGame();
            } else {
                dino.jump();
            }
        });
        
        // 按钮控制
        toggleModeBtn.addEventListener('click', toggleDarkMode);
        toggleSoundBtn.addEventListener('click', toggleSound);
        restartBtn.addEventListener('click', resetGame);
    }
    
    // 创建音效文件夹
    function createSoundFolder() {
        // 这里可以添加创建音效文件的代码
        // 由于我们使用的是HTML5 Audio元素，实际上不需要创建物理文件
        // 在实际部署时，需要确保sounds文件夹和音效文件存在
        console.log('游戏初始化完成，等待音效文件...');
    }
    
    // 初始化游戏
    init();
    createSoundFolder();
});