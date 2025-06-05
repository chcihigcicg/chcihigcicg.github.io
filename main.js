class VideoEditor {
    constructor() {
        this.init();
        this.setupEventListeners();
    }

    init() {
        // Основные элементы
        this.videoInput = document.getElementById('videoInput');
        this.sourceVideo = document.getElementById('sourceVideo');
        this.editCanvas = document.getElementById('editCanvas');
        this.ctx = this.editCanvas.getContext('2d');
        this.editorSection = document.getElementById('editorSection');
        this.progressSection = document.getElementById('progressSection');
        this.circleMask = document.getElementById('circleMask');
        
        // Элементы управления
        this.circleMaskToggle = document.getElementById('circleMaskToggle');
        this.exportBtn = document.getElementById('exportBtn');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Упрощённый таймлайн
        this.timelineTrack = document.getElementById('timelineTrack');
        this.timelineSegment = document.getElementById('timelineSegment');
        this.timelineCursor = document.getElementById('timelineCursor');
        this.timelineMarks = document.getElementById('timelineMarks');
        this.playBtn = document.getElementById('playBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.currentTime = document.getElementById('currentTime');
        this.timeInfo = document.getElementById('timeInfo');
        
        // Упрощённое кадрирование
        this.cropModeToggle = document.getElementById('cropModeToggle');
        this.cropControls = document.getElementById('cropControls');
        this.cropOverlay = document.getElementById('cropOverlay');
        this.scaleIndicator = document.getElementById('scaleIndicator');
        
        // Состояние таймлайна
        this.startTime = 0;
        this.endTime = 3;
        this.videoDuration = 0;
        this.isDraggingSegment = false;
        this.segmentDragStart = 0;
        
        // Состояние кадрирования (упрощённое)
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isCropMode = false;
        this.isDragging = false;
        this.lastTouch = null;
        this.dragStart = { x: 0, y: 0 };
        this.scaleIndicatorTimeout = null;
        
        this.isProcessing = false;
        this.isExporting = false; // Добавляем флаг экспорта
    }

    setupEventListeners() {
        // Основные события
        if (this.videoInput) this.videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        if (this.sourceVideo) {
            this.sourceVideo.addEventListener('loadedmetadata', () => this.onVideoLoaded());
            this.sourceVideo.addEventListener('timeupdate', () => this.updateCanvas());
        }
        
        if (this.circleMaskToggle) {
            this.circleMaskToggle.addEventListener('change', (e) => {
                // Убираем обработку circleMask элемента, используем только canvas
                this.updateCanvas();
            });
        }
        
        if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportVideo());
        
        // Упрощённый таймлайн с поддержкой touch
        if (this.timelineSegment) {
            // Mouse события
            this.timelineSegment.addEventListener('mousedown', (e) => this.onSegmentMouseDown(e));
            // Touch события
            this.timelineSegment.addEventListener('touchstart', (e) => this.onSegmentTouchStart(e), { passive: false });
            this.timelineSegment.addEventListener('touchmove', (e) => this.onSegmentTouchMove(e), { passive: false });
            this.timelineSegment.addEventListener('touchend', (e) => this.onSegmentTouchEnd(e), { passive: false });
        }
        if (this.timelineTrack) {
            // Mouse события
            this.timelineTrack.addEventListener('click', (e) => this.onTimelineClick(e));
            // Touch события
            this.timelineTrack.addEventListener('touchstart', (e) => this.onTimelineTouchStart(e), { passive: false });
        }
        
        if (this.playBtn) this.playBtn.addEventListener('click', () => this.togglePlayback());
        if (this.resetBtn) this.resetBtn.addEventListener('click', () => this.resetSelection());
        
        // Исправленное кадрирование
        if (this.cropModeToggle) this.cropModeToggle.addEventListener('change', (e) => this.toggleCropMode(e.target.checked));
        
        // События для всего canvas и его контейнера
        if (this.editCanvas) {
            // Mouse события
            this.editCanvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
            this.editCanvas.addEventListener('wheel', (e) => this.onCanvasWheel(e), { passive: false });
            
            // Touch события
            this.editCanvas.addEventListener('touchstart', (e) => this.onCanvasTouchStart(e), { passive: false });
            this.editCanvas.addEventListener('touchmove', (e) => this.onCanvasTouchMove(e), { passive: false });
            this.editCanvas.addEventListener('touchend', (e) => this.onCanvasTouchEnd(e), { passive: false });
        }
        
        // Глобальные события для завершения перетаскивания
        document.addEventListener('mousemove', (e) => this.onGlobalMouseMove(e));
        document.addEventListener('mouseup', () => this.onGlobalMouseUp());
        // Глобальные touch события
        document.addEventListener('touchmove', (e) => this.onGlobalTouchMove(e), { passive: false });
        document.addEventListener('touchend', () => this.onGlobalTouchEnd());
    }

    handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const url = URL.createObjectURL(file);
        this.sourceVideo.src = url;
        this.sourceVideo.load();
    }

    onVideoLoaded() {
        this.editorSection.style.display = 'block';
        this.videoDuration = this.sourceVideo.duration;
        this.endTime = Math.min(3, this.videoDuration);
        this.generateTimelineMarks();
        this.updateTimelineDisplay();
        this.updateCanvas();
        this.sourceVideo.currentTime = this.startTime;
    }

    // Генерация отметок времени
    generateTimelineMarks() {
        if (!this.timelineMarks) return;
        
        this.timelineMarks.innerHTML = '';
        const totalSeconds = Math.ceil(this.videoDuration);
        const step = this.videoDuration > 30 ? 5 : 1; // Если видео длинное, показываем каждые 5 секунд
        
        const marks = [];
        for (let i = 0; i <= totalSeconds; i += step) {
            if (i > this.videoDuration) break;
            marks.push(i);
        }
        
        // Убеждаемся что последняя отметка соответствует концу видео
        if (marks[marks.length - 1] !== Math.floor(this.videoDuration)) {
            marks.push(Math.floor(this.videoDuration));
        }
        
        marks.forEach((seconds, index) => {
            const mark = document.createElement('div');
            mark.className = `timeline-mark ${seconds % (step * 5) === 0 ? 'major' : ''}`;
            mark.textContent = seconds + 's';
            mark.style.position = 'absolute';
            mark.style.left = `${(seconds / this.videoDuration) * 100}%`;
            
            // Особое выравнивание для первой и последней отметки
            if (index === 0) {
                // Первая отметка - выравнивание по левому краю
                mark.style.transform = 'translateX(0%)';
            } else if (index === marks.length - 1) {
                // Последняя отметка - выравнивание по правому краю
                mark.style.transform = 'translateX(-100%)';
            } else {
                // Средние отметки - центрирование
                mark.style.transform = 'translateX(-50%)';
            }
            
            this.timelineMarks.appendChild(mark);
        });
    }

    // Упрощённые методы таймлайна
    onSegmentMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingSegment = true;
        const rect = this.timelineTrack.getBoundingClientRect();
        this.segmentDragStart = e.clientX - rect.left - (this.startTime / this.videoDuration) * rect.width;
    }

    onTimelineClick(e) {
        if (this.isDraggingSegment) return;
        
        const rect = this.timelineTrack.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * this.videoDuration;
        
        this.sourceVideo.currentTime = time;
        this.updateTimelineDisplay();
    }

    // Touch события для сегмента таймлайна
    onSegmentTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1) {
            this.isDraggingSegment = true;
            const rect = this.timelineTrack.getBoundingClientRect();
            const touch = e.touches[0];
            this.segmentDragStart = touch.clientX - rect.left - (this.startTime / this.videoDuration) * rect.width;
            
            // Визуальная обратная связь
            this.timelineSegment.style.opacity = '0.8';
        }
    }

    onSegmentTouchMove(e) {
        if (!this.isDraggingSegment) return;
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1) {
            const rect = this.timelineTrack.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left - this.segmentDragStart;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            
            this.startTime = percentage * this.videoDuration;
            this.endTime = Math.min(this.videoDuration, this.startTime + 3);
            
            // Если достигли конца видео, сдвигаем начало
            if (this.endTime >= this.videoDuration) {
                this.endTime = this.videoDuration;
                this.startTime = Math.max(0, this.endTime - 3);
            }
            
            // Обновляем позицию видео в реальном времени при перетаскивании
            this.sourceVideo.currentTime = this.startTime;
            this.updateTimelineDisplay();
        }
    }

    onSegmentTouchEnd(e) {
        e.preventDefault();
        this.isDraggingSegment = false;
        
        // Восстанавливаем визуальное состояние
        this.timelineSegment.style.opacity = '1';
        
        // Убеждаемся что видео показывает начало нового фрагмента
        this.sourceVideo.currentTime = this.startTime;
        // Небольшая задержка для обновления кадра
        setTimeout(() => {
            this.updateCanvas();
        }, 50);
    }

    // Touch события для трека таймлайна
    onTimelineTouchStart(e) {
        // Проверяем, что касание не на сегменте
        if (e.target === this.timelineSegment) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1) {
            const rect = this.timelineTrack.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const percentage = x / rect.width;
            const time = percentage * this.videoDuration;
            
            this.sourceVideo.currentTime = time;
            this.updateTimelineDisplay();
        }
    }

    // Исправленные методы кадрирования для canvas
    onCanvasMouseDown(e) {
        if (!this.isCropMode) return;
        e.preventDefault();
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    onCanvasWheel(e) {
        if (!this.isCropMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.scale = Math.max(0.5, Math.min(5, this.scale + delta));
        
        this.updateScaleIndicator();
        this.updateCanvas();
    }

    // Touch события для canvas
    onCanvasTouchStart(e) {
        if (!this.isCropMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1) {
            // Одно касание - перемещение
            this.isDragging = true;
            this.dragStart = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
        } else if (e.touches.length === 2) {
            // Два касания - масштабирование
            this.isDragging = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            this.lastTouch = {
                distance: this.getTouchDistance(touch1, touch2),
                scale: this.scale,
                centerX: centerX,
                centerY: centerY
            };
        }
    }

    onCanvasTouchMove(e) {
        if (!this.isCropMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1 && this.isDragging) {
            // Перемещение с улучшенной чувствительностью
            const deltaX = e.touches[0].clientX - this.dragStart.x;
            const deltaY = e.touches[0].clientY - this.dragStart.y;
            
            // Увеличиваем чувствительность для мобильных
            const sensitivity = window.innerWidth < 768 ? 1.2 : 1;
            this.offsetX += deltaX * sensitivity;
            this.offsetY += deltaY * sensitivity;
            
            this.dragStart = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
            
            this.updateCanvas();
        } else if (e.touches.length === 2 && this.lastTouch) {
            // Масштабирование с улучшенной точностью
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = this.getTouchDistance(touch1, touch2);
            const scaleChange = currentDistance / this.lastTouch.distance;
            
            // Ограничиваем скорость масштабирования для плавности
            const maxScaleChange = 1.5;
            const minScaleChange = 0.5;
            const limitedScaleChange = Math.max(minScaleChange, Math.min(maxScaleChange, scaleChange));
            
            this.scale = Math.max(0.5, Math.min(5, this.lastTouch.scale * limitedScaleChange));
            this.updateScaleIndicator();
            this.updateCanvas();
        }
    }

    onCanvasTouchEnd(e) {
        if (!this.isCropMode) return;
        e.preventDefault();
        
        if (e.touches.length === 0) {
            this.isDragging = false;
            this.lastTouch = null;
        } else if (e.touches.length === 1) {
            this.lastTouch = null;
            // Если остался один палец, начинаем перемещение заново
            if (this.isCropMode) {
                this.isDragging = true;
                this.dragStart = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };
            }
        }
    }

    // Глобальные события мыши
    onGlobalMouseMove(e) {
        // Таймлайн
        if (this.isDraggingSegment) {
            const rect = this.timelineTrack.getBoundingClientRect();
            const x = e.clientX - rect.left - this.segmentDragStart;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            
            this.startTime = percentage * this.videoDuration;
            this.endTime = Math.min(this.videoDuration, this.startTime + 3);
            
            // Если достигли конца видео, сдвигаем начало
            if (this.endTime >= this.videoDuration) {
                this.endTime = this.videoDuration;
                this.startTime = Math.max(0, this.endTime - 3);
            }
            
            // Обновляем позицию видео в реальном времени при перетаскивании
            this.sourceVideo.currentTime = this.startTime;
            this.updateTimelineDisplay();
            return;
        }
        
        // Перемещение в режиме кадрирования
        if (this.isDragging && this.isCropMode) {
            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;
            
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.updateCanvas();
        }
    }

    onGlobalMouseUp() {
        this.isDraggingSegment = false;
        this.isDragging = false;
        this.lastTouch = null;
        
        // Обновляем видео на новое начало фрагмента
        if (this.sourceVideo) {
            this.sourceVideo.currentTime = this.startTime;
            setTimeout(() => {
                this.updateCanvas();
            }, 100);
        }
    }

    // Глобальные touch события
    onGlobalTouchMove(e) {
        if (this.isDraggingSegment) {
            this.onSegmentTouchMove(e);
            return;
        }
        
        // Перемещение в режиме кадрирования
        if (this.isDragging && this.isCropMode && e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.dragStart.x;
            const deltaY = touch.clientY - this.dragStart.y;
            
            const sensitivity = window.innerWidth < 768 ? 1.2 : 1;
            this.offsetX += deltaX * sensitivity;
            this.offsetY += deltaY * sensitivity;
            
            this.dragStart = { 
                x: touch.clientX, 
                y: touch.clientY 
            };
            
            this.updateCanvas();
        }
    }

    onGlobalTouchEnd() {
        this.isDraggingSegment = false;
        this.isDragging = false;
        this.lastTouch = null;
        
        // Восстанавливаем визуальное состояние сегмента
        if (this.timelineSegment) {
            this.timelineSegment.style.opacity = '1';
        }
        
        // ВАЖНО: Обновляем видео на новое начало фрагмента
        if (this.sourceVideo) {
            this.sourceVideo.currentTime = this.startTime;
            // Принудительно обновляем canvas для отображения нового кадра
            setTimeout(() => {
                this.updateCanvas();
            }, 100);
        }
    }

    updateTimelineDisplay() {
        if (!this.sourceVideo || !this.timelineSegment || !this.timelineCursor) return;
        
        const startPercent = (this.startTime / this.videoDuration) * 100;
        const segmentWidth = ((this.endTime - this.startTime) / this.videoDuration) * 100;
        const currentPercent = (this.sourceVideo.currentTime / this.videoDuration) * 100;
        
        this.timelineSegment.style.left = startPercent + '%';
        this.timelineSegment.style.width = segmentWidth + '%';
        this.timelineCursor.style.left = currentPercent + '%';
        
        if (this.timeInfo) this.timeInfo.textContent = `${this.formatTime(this.startTime)} - ${this.formatTime(this.endTime)}`;
        if (this.currentTime) this.currentTime.textContent = this.formatTime(this.sourceVideo.currentTime);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    togglePlayback() {
        if (!this.sourceVideo) return;
        
        if (this.sourceVideo.paused) {
            this.sourceVideo.currentTime = this.startTime;
            this.sourceVideo.play();
            if (this.playBtn) this.playBtn.textContent = '⏸';
        } else {
            this.sourceVideo.pause();
            if (this.playBtn) this.playBtn.textContent = '▶';
        }
    }

    resetSelection() {
        this.startTime = 0;
        this.endTime = Math.min(3, this.videoDuration);
        this.sourceVideo.currentTime = this.startTime;
        this.updateTimelineDisplay();
    }

    // Упрощённые методы кадрирования
    toggleCropMode(enabled) {
        this.isCropMode = enabled;
        if (this.cropControls) this.cropControls.classList.toggle('active', enabled);
        if (this.editCanvas) this.editCanvas.classList.toggle('crop-mode', enabled);
        
        if (enabled) {
            this.resetCrop();
        } else {
            // Сбрасываем состояние при выключении режима
            this.isDragging = false;
            this.lastTouch = null;
        }
        this.updateCanvas();
    }

    resetCrop() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastTouch = null;
        this.updateScaleIndicator();
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateScaleIndicator() {
        if (!this.scaleIndicator) return;
        
        this.scaleIndicator.textContent = Math.round(this.scale * 100) + '%';
        this.scaleIndicator.classList.add('visible');
        
        // Скрываем индикатор через 2 секунды
        clearTimeout(this.scaleIndicatorTimeout);
        this.scaleIndicatorTimeout = setTimeout(() => {
            this.scaleIndicator.classList.remove('visible');
        }, 2000);
    }

    // Улучшенное обновление canvas для мобильных
    updateCanvas() {
        // Если идёт экспорт, НЕ обновляем canvas с сеткой
        if (this.isExporting) return;
        
        if (!this.sourceVideo || !this.sourceVideo.videoWidth) return;
        
        // Проверяем, нужно ли остановить воспроизведение
        if (this.sourceVideo.currentTime >= this.endTime && !this.sourceVideo.paused && !this.isExporting) {
            this.sourceVideo.pause();
            if (this.playBtn) this.playBtn.textContent = '▶';
            this.sourceVideo.currentTime = this.startTime;
        }
        
        // Адаптивный размер canvas для мобильных
        const canvasSize = this.editCanvas.width;
        this.ctx.clearRect(0, 0, canvasSize, canvasSize);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        // Вычисляем параметры отображения
        const videoAspect = this.sourceVideo.videoWidth / this.sourceVideo.videoHeight;
        let baseWidth, baseHeight;
        
        if (videoAspect > 1) {
            baseWidth = canvasSize;
            baseHeight = canvasSize / videoAspect;
        } else {
            baseHeight = canvasSize;
            baseWidth = canvasSize * videoAspect;
        }
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (this.isCropMode) {
            // В режиме кадрирования применяем масштаб и смещение
            drawWidth = baseWidth * this.scale;
            drawHeight = baseHeight * this.scale;
            drawX = (canvasSize - drawWidth) / 2 + this.offsetX;
            drawY = (canvasSize - drawHeight) / 2 + this.offsetY;
        } else {
            // Обычный режим - центрируем видео
            drawWidth = baseWidth;
            drawHeight = baseHeight;
            drawX = (canvasSize - drawWidth) / 2;
            drawY = (canvasSize - drawHeight) / 2;
        }
        
        this.ctx.drawImage(this.sourceVideo, drawX, drawY, drawWidth, drawHeight);
        
        if (this.circleMaskToggle && this.circleMaskToggle.checked) {
            // Используем версию с сеткой ТОЛЬКО для предварительного просмотра
            this.applyCircleMaskWithPreview();
        }
        
        this.updateTimelineDisplay();
    }

    applyCircleMask() {
        const canvasSize = this.editCanvas.width;
        const imageData = this.ctx.getImageData(0, 0, canvasSize, canvasSize);
        const data = imageData.data;
        const centerX = canvasSize / 2;
        const centerY = canvasSize / 2;
        const radius = canvasSize / 2;
        
        // Просто делаем пиксели прозрачными за пределами круга
        for (let y = 0; y < canvasSize; y++) {
            for (let x = 0; x < canvasSize; x++) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance > radius) {
                    const index = (y * canvasSize + x) * 4;
                    data[index + 3] = 0; // Делаем полностью прозрачным
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    // Новый метод только для визуализации во время редактирования
    applyCircleMaskWithPreview() {
        const canvasSize = this.editCanvas.width;
        const imageData = this.ctx.getImageData(0, 0, canvasSize, canvasSize);
        const data = imageData.data;
        const centerX = canvasSize / 2;
        const centerY = canvasSize / 2;
        const radius = canvasSize / 2;
        
        // Адаптивный размер сетки для разных размеров canvas
        const gridSize = Math.max(8, Math.floor(canvasSize / 32));
        
        // Создаем паттерн прозрачности с сеткой для предварительного просмотра
        for (let y = 0; y < canvasSize; y++) {
            for (let x = 0; x < canvasSize; x++) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance > radius) {
                    const index = (y * canvasSize + x) * 4;
                    
                    const gridX = Math.floor(x / gridSize);
                    const gridY = Math.floor(y / gridSize);
                    const isCheckerboard = (gridX + gridY) % 2 === 0;
                    
                    // Устанавливаем цвет сетки для предварительного просмотра
                    if (isCheckerboard) {
                        data[index] = 200;     // R - светло-серый
                        data[index + 1] = 200; // G
                        data[index + 2] = 200; // B
                        data[index + 3] = 100; // A - полупрозрачный
                    } else {
                        data[index] = 160;     // R - темно-серый
                        data[index + 1] = 160; // G
                        data[index + 2] = 160; // B
                        data[index + 3] = 100; // A - полупрозрачный
                    }
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // Добавляем тонкую границу круга для лучшего понимания области
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = Math.max(1, canvasSize / 256);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    async exportVideo() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.exportBtn.disabled = true;
        this.progressSection.style.display = 'block';
        
        try {
            const duration = this.endTime - this.startTime;
            const targetSizeKB = 256; // Целевой размер в KB
            
            // Запускаем оптимизацию параметров
            const optimalParams = await this.findOptimalParams(duration, targetSizeKB);
            
            this.updateProgressText('Экспорт с оптимальными параметрами...');
            
            const finalBlob = await this.recordWithParams(optimalParams);
            
            // КРИТИЧЕСКАЯ ПРОВЕРКА: если файл больше лимита, пересжимаем
            const finalSizeKB = Math.round(finalBlob.size / 1024);
            if (finalSizeKB > targetSizeKB) {
                console.warn(`Финальный файл слишком большой: ${finalSizeKB}KB > ${targetSizeKB}KB`);
                this.updateProgressText('Файл превысил лимит! Дополнительное сжатие...');
                
                // Принудительно снижаем битрейт на 30%
                const emergencyParams = {
                    ...optimalParams,
                    bitrate: Math.floor(optimalParams.bitrate * 0.7)
                };
                
                console.log(`Экстренное сжатие: ${Math.round(optimalParams.bitrate/1000)}k → ${Math.round(emergencyParams.bitrate/1000)}k`);
                
                const compressedBlob = await this.recordWithParams(emergencyParams);
                this.downloadVideo(compressedBlob);
            } else {
                this.downloadVideo(finalBlob);
            }
            
            this.isProcessing = false;
            this.exportBtn.disabled = false;
            
        } catch (error) {
            console.error('Ошибка при экспорте видео:', error);
            alert('Ошибка при экспорте видео. Попробуйте еще раз.');
            this.isExporting = false;
            this.isProcessing = false;
            this.exportBtn.disabled = false;
            this.progressSection.style.display = 'none';
        }
    }

    async findOptimalParams(duration, targetSizeKB) {
        const targetSizeBytes = targetSizeKB * 1024;
        // Добавляем безопасный запас 10% для гарантии
        const safeTargetBytes = Math.floor(targetSizeBytes * 0.90);
        
        // Фиксированные параметры
        const fixedParams = { fps: 30, scale: 1.0 };
        
        // Расчет теоретического максимального битрейта с запасом
        // Формула: размер = (битрейт * длительность) / 8 (биты в байты)
        const theoreticalMaxBitrate = Math.floor((safeTargetBytes * 8) / duration);
        console.log(`Теоретический максимум с запасом: ${Math.round(theoreticalMaxBitrate/1000)}k для ${duration}сек (цель: ${Math.round(safeTargetBytes/1024)}KB)`);
        
        // Диапазон битрейтов для тестирования (от высокого к низкому)
        const testBitrates = [
            Math.floor(theoreticalMaxBitrate * 0.95), // 95% от теоретического максимума
            Math.floor(theoreticalMaxBitrate * 0.90), // 90%
            Math.floor(theoreticalMaxBitrate * 0.85), // 85%
            Math.floor(theoreticalMaxBitrate * 0.80), // 80%
            Math.floor(theoreticalMaxBitrate * 0.75), // 75%
            Math.floor(theoreticalMaxBitrate * 0.70), // 70%
            Math.floor(theoreticalMaxBitrate * 0.65), // 65%
            Math.floor(theoreticalMaxBitrate * 0.60), // 60%
            Math.floor(theoreticalMaxBitrate * 0.55), // 55%
            Math.floor(theoreticalMaxBitrate * 0.50), // 50%
            1200000, 1100000, 1000000, 900000, 800000, 700000, 600000, 
            500000, 400000, 300000, 250000, 200000, 150000, 100000, 80000
        ].filter(bitrate => bitrate > 50000) // Убираем слишком низкие битрейты
         .sort((a, b) => b - a); // От высокого к низкому
        
        // Убираем дубликаты и ограничиваем разумными пределами
        const uniqueBitrates = [...new Set(testBitrates)]
            .filter(bitrate => bitrate >= 80000 && bitrate <= 2000000);
        
        console.log('Тестируемые битрейты:', uniqueBitrates.map(b => Math.round(b/1000) + 'k'));
        
        let bestParams = { ...fixedParams, bitrate: uniqueBitrates[uniqueBitrates.length - 1] };
        let bestSize = 0;
        
        this.updateProgressText('Подбор оптимального битрейта...');
        
        // Тестируем битрейты от высокого к низкому
        for (let i = 0; i < uniqueBitrates.length; i++) {
            const bitrate = uniqueBitrates[i];
            const params = { ...fixedParams, bitrate };
            
            this.updateProgressText(`Тест ${i + 1}/${uniqueBitrates.length}: ${Math.round(bitrate/1000)}k битрейт`);
            this.progressFill.style.width = `${(i / uniqueBitrates.length) * 50}%`;
            
            try {
                const testBlob = await this.recordWithParams(params, true);
                
                if (testBlob.size === 0) {
                    console.warn(`Пустой тест для битрейта ${Math.round(bitrate/1000)}k`);
                    continue;
                }
                
                // Более точная оценка с учетом реального сжатия + дополнительный запас
                const compressionRatio = testBlob.size / (bitrate / 8);
                const estimatedFullSize = compressionRatio * duration * (bitrate / 8) * 1.1; // +10% запас
                
                console.log(`Тест ${i + 1}: ${Math.round(bitrate/1000)}k → ${Math.round(testBlob.size/1024)}KB за 1сек → оценка: ${Math.round(estimatedFullSize/1024)}KB`);
                
                if (estimatedFullSize <= safeTargetBytes) {
                    bestParams = params;
                    bestSize = estimatedFullSize;
                    console.log(`✓ Найден подходящий битрейт: ${Math.round(bitrate/1000)}k (${Math.round(estimatedFullSize/1024)}KB)`);
                    break;
                } else {
                    console.log(`✗ Слишком большой: ${Math.round(estimatedFullSize/1024)}KB > ${Math.round(safeTargetBytes/1024)}KB`);
                }
            } catch (error) {
                console.warn(`Ошибка при тестировании битрейта ${Math.round(bitrate/1000)}k:`, error);
                continue;
            }
        }
        
        // НЕ увеличиваем битрейт - используем консервативный подход
        console.log('Финальные параметры (консервативные):', bestParams, `→ ~${Math.round(bestSize/1024)}KB`);
        return bestParams;
    }

    async optimizeBitrate(baseParams, duration, targetSizeBytes, currentEstimatedSize) {
        // Убираем оптимизацию вверх - слишком рискованно
        // Всегда возвращаем консервативные параметры
        return baseParams;
    }

    async finetuneParams(baseParams, duration, targetSizeBytes) {
        // Более точная корректировка только битрейта
        const theoreticalMaxBitrate = Math.floor((targetSizeBytes * 8) / duration);
        const safeBitrate = Math.floor(theoreticalMaxBitrate * 0.8); // 80% от теоретического максимума
        
        return {
            fps: 30, // Всегда 30 FPS
            bitrate: Math.max(80000, Math.min(safeBitrate, baseParams.bitrate)),
            scale: 1.0 // Всегда полный размер
        };
    }

    async recordWithParams(params, isTest = false) {
        return new Promise((resolve, reject) => {
            try {
                // Применяем масштабирование canvas если нужно
                const originalSize = this.editCanvas.width;
                const scaledSize = Math.round(originalSize * params.scale);
                
                if (params.scale !== 1.0) {
                    this.editCanvas.width = scaledSize;
                    this.editCanvas.height = scaledSize;
                }
                
                const stream = this.editCanvas.captureStream(params.fps);
                const mimeType = this.getBestMimeType();
                
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: params.bitrate
                });
                
                const chunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    // Восстанавливаем оригинальный размер canvas
                    if (params.scale !== 1.0) {
                        this.editCanvas.width = originalSize;
                        this.editCanvas.height = originalSize;
                    }
                    
                    const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                    console.log(`Запись завершена: ${Math.round(blob.size/1024)}KB`);
                    resolve(blob);
                };
                
                mediaRecorder.onerror = (error) => {
                    reject(error);
                };
                
                mediaRecorder.start();
                this.isExporting = true;
                
                // Для теста записываем только 1 секунду
                const recordDuration = isTest ? 1000 : (this.endTime - this.startTime) * 1000;
                
                this.sourceVideo.currentTime = this.startTime;
                this.sourceVideo.play();
                
                const startTime = Date.now();
                const updateProgress = () => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const progress = Math.min(elapsed / (recordDuration / 1000), 1);
                    
                    if (!isTest) {
                        this.progressFill.style.width = `${50 + progress * 50}%`; // Вторые 50% прогресса
                    }
                    
                    if (this.sourceVideo.currentTime >= this.endTime || elapsed >= recordDuration / 1000) {
                        this.isExporting = false;
                        mediaRecorder.stop();
                        this.sourceVideo.pause();
                    } else {
                        this.updateCanvasForExport();
                        requestAnimationFrame(updateProgress);
                    }
                };
                
                requestAnimationFrame(updateProgress);
                
                // Автоматическая остановка для теста
                if (isTest) {
                    setTimeout(() => {
                        if (mediaRecorder.state === 'recording') {
                            this.isExporting = false;
                            mediaRecorder.stop();
                            this.sourceVideo.pause();
                        }
                    }, recordDuration);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }

    getBestMimeType() {
        // Проверяем поддерживаемые форматы в порядке предпочтения
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4;codecs=h264',
            'video/mp4'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('Используется кодек:', type);
                return type;
            }
        }
        
        console.warn('Не найден оптимальный кодек, используется по умолчанию');
        return 'video/webm';
    }

    updateProgressText(text) {
        if (this.progressText) {
            this.progressText.textContent = text;
        }
    }

    // Специальный метод обновления canvas для экспорта (без сетки)
    updateCanvasForExport() {
        if (!this.sourceVideo || !this.sourceVideo.videoWidth) return;
        
        const canvasSize = this.editCanvas.width;
        this.ctx.clearRect(0, 0, canvasSize, canvasSize);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        const videoAspect = this.sourceVideo.videoWidth / this.sourceVideo.videoHeight;
        let baseWidth, baseHeight;
        
        if (videoAspect > 1) {
            baseWidth = canvasSize;
            baseHeight = canvasSize / videoAspect;
        } else {
            baseHeight = canvasSize;
            baseWidth = canvasSize * videoAspect;
        }
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (this.isCropMode) {
            drawWidth = baseWidth * this.scale;
            drawHeight = baseHeight * this.scale;
            drawX = (canvasSize - drawWidth) / 2 + this.offsetX;
            drawY = (canvasSize - drawHeight) / 2 + this.offsetY;
        } else {
            drawWidth = baseWidth;
            drawHeight = baseHeight;
            drawX = (canvasSize - drawWidth) / 2;
            drawY = (canvasSize - drawHeight) / 2;
        }
        
        this.ctx.drawImage(this.sourceVideo, drawX, drawY, drawWidth, drawHeight);
        
        if (this.circleMaskToggle && this.circleMaskToggle.checked) {
            // Используем версию без сетки для финального видео
            this.applyCircleMask();
        }
    }

    downloadVideo(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Михаил_Круг_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Показываем финальный размер с проверкой
        const finalSizeKB = Math.round(blob.size / 1024);
        const isOverLimit = finalSizeKB > 256;
        
        console.log(`Финальное видео: ${finalSizeKB}KB ${isOverLimit ? '⚠️ ПРЕВЫШЕН ЛИМИТ!' : '✅'}`);
        
        if (isOverLimit) {
            this.updateProgressText(`⚠️ Готово! Размер: ${finalSizeKB}KB (превышен лимит 256KB)`);
        } else {
            this.updateProgressText(`✅ Готово! Размер: ${finalSizeKB}KB`);
        }
        
        // Скрываем прогресс через 5 секунд если превышен лимит
        setTimeout(() => {
            this.progressSection.style.display = 'none';
        }, isOverLimit ? 5000 : 3000);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new VideoEditor();
});
