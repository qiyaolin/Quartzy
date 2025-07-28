/**
 * ZBar-WASM条形码扫描器
 * 使用WebAssembly实现高性能、真实的条形码识别
 */

import { scanImageData } from '@undecaf/zbar-wasm';

export interface ZBarBarcodeResult {
  type: string;
  value: string;
  quality: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ZBarScannerOptions {
  enableCache?: boolean;
  tryHarder?: boolean;
  enableAllFormats?: boolean;
  formats?: string[];
}

/**
 * ZBar-WASM条形码扫描器类
 */
export class ZBarBarcodeScanner {
  private isInitialized = false;
  private lastScanTime = 0;
  private cooldownMs = 1000; // 1秒冷却时间
  private options: ZBarScannerOptions;

  constructor(options: ZBarScannerOptions = {}) {
    this.options = {
      enableCache: true,
      tryHarder: true,
      enableAllFormats: true,
      ...options
    };
  }

  async initialize(): Promise<void> {
    try {
      // ZBar-WASM会自动初始化，不需要显式初始化
      this.isInitialized = true;
      console.log('ZBar-WASM Barcode Scanner initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ZBar-WASM Barcode Scanner:', error);
      throw new Error(`Initialization failed: ${error}`);
    }
  }

  /**
   * 从视频帧检测条形码
   */
  async detectForVideo(videoElement: HTMLVideoElement): Promise<{ barcodes: ZBarBarcodeResult[] }> {
    if (!this.isInitialized) {
      throw new Error('Scanner not initialized');
    }

    // 实现冷却时间防止重复检测
    const currentTime = Date.now();
    if (currentTime - this.lastScanTime < this.cooldownMs) {
      return { barcodes: [] };
    }

    try {
      // 创建canvas从video元素获取ImageData
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // 设置canvas尺寸
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // 绘制当前视频帧
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // 获取ImageData
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 使用ZBar-WASM扫描
      const scanResults = await scanImageData(imageData);
      
      const barcodes: ZBarBarcodeResult[] = scanResults.map(result => ({
        type: result.typeName,
        value: result.decode(),
        quality: result.quality,
        boundingBox: {
          x: result.points[0].x,
          y: result.points[0].y,
          width: Math.max(...result.points.map(p => p.x)) - Math.min(...result.points.map(p => p.x)),
          height: Math.max(...result.points.map(p => p.y)) - Math.min(...result.points.map(p => p.y))
        }
      }));

      if (barcodes.length > 0) {
        this.lastScanTime = currentTime;
        console.log('ZBar detected barcodes:', barcodes);
      }

      return { barcodes };
    } catch (error) {
      console.error('ZBar detection error:', error);
      return { barcodes: [] };
    }
  }

  /**
   * 从图像数据检测条形码
   */
  async detectFromImageData(imageData: ImageData): Promise<{ barcodes: ZBarBarcodeResult[] }> {
    if (!this.isInitialized) {
      throw new Error('Scanner not initialized');
    }

    try {
      const scanResults = await scanImageData(imageData);
      
      const barcodes: ZBarBarcodeResult[] = scanResults.map(result => ({
        type: result.typeName,
        value: result.decode(),
        quality: result.quality,
        boundingBox: {
          x: result.points[0].x,
          y: result.points[0].y,
          width: Math.max(...result.points.map(p => p.x)) - Math.min(...result.points.map(p => p.x)),
          height: Math.max(...result.points.map(p => p.y)) - Math.min(...result.points.map(p => p.y))
        }
      }));

      console.log('ZBar detected barcodes from image:', barcodes);
      return { barcodes };
    } catch (error) {
      console.error('ZBar image detection error:', error);
      return { barcodes: [] };
    }
  }

  /**
   * 设置冷却时间
   */
  setCooldown(milliseconds: number): void {
    this.cooldownMs = milliseconds;
  }

  /**
   * 检查扫描器是否准备就绪
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 清理资源
   */
  close(): void {
    this.isInitialized = false;
  }
}

/**
 * 条形码格式验证工具
 */
export class ZBarBarcodeValidator {
  /**
   * 验证条形码值是否有效
   */
  static validateBarcode(value: string, type: string): {
    isValid: boolean;
    errorMessage?: string;
  } {
    if (!value || value.trim().length === 0) {
      return { isValid: false, errorMessage: 'Barcode value is empty' };
    }

    const cleanValue = value.trim();

    switch (type.toUpperCase()) {
      case 'EAN-13':
      case 'EAN13':
        if (!/^\d{13}$/.test(cleanValue)) {
          return { isValid: false, errorMessage: 'EAN-13 must be 13 digits' };
        }
        break;

      case 'EAN-8':
      case 'EAN8':
        if (!/^\d{8}$/.test(cleanValue)) {
          return { isValid: false, errorMessage: 'EAN-8 must be 8 digits' };
        }
        break;

      case 'UPC-A':
      case 'UPCA':
        if (!/^\d{12}$/.test(cleanValue)) {
          return { isValid: false, errorMessage: 'UPC-A must be 12 digits' };
        }
        break;

      case 'CODE-39':
      case 'CODE39':
        if (!/^[A-Z0-9\-. $\\/+%]+$/i.test(cleanValue)) {
          return { isValid: false, errorMessage: 'Invalid Code 39 characters' };
        }
        break;

      case 'CODE-128':
      case 'CODE128':
        if (cleanValue.length < 1) {
          return { isValid: false, errorMessage: 'Code 128 cannot be empty' };
        }
        break;

      case 'QR-CODE':
      case 'QRCODE':
        // QR码可以包含任何字符
        break;

      default:
        // 对于未知格式，只检查非空
        break;
    }

    return { isValid: true };
  }

  /**
   * 格式化条形码显示
   */
  static formatBarcodeDisplay(value: string, type: string): string {
    const cleanValue = value.trim();

    switch (type.toUpperCase()) {
      case 'EAN-13':
      case 'EAN13':
        // 格式化为: 1 234567 890123
        return cleanValue.replace(/(\d{1})(\d{6})(\d{6})/, '$1 $2 $3');

      case 'EAN-8':
      case 'EAN8':
        // 格式化为: 1234 5678
        return cleanValue.replace(/(\d{4})(\d{4})/, '$1 $2');

      case 'UPC-A':
      case 'UPCA':
        // 格式化为: 1 23456 78901 2
        return cleanValue.replace(/(\d{1})(\d{5})(\d{5})(\d{1})/, '$1 $2 $3 $4');

      default:
        return cleanValue;
    }
  }
}

/**
 * 相机工具类
 */
export class ZBarCameraUtils {
  /**
   * 获取优化的相机约束
   */
  static getOptimalConstraints(): MediaStreamConstraints {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return {
      video: {
        width: { ideal: isMobile ? 720 : 1280, max: isMobile ? 1280 : 1920 },
        height: { ideal: isMobile ? 480 : 720, max: isMobile ? 720 : 1080 },
        facingMode: { ideal: 'environment' },
        frameRate: { ideal: isMobile ? 20 : 30, min: isMobile ? 10 : 15 }
      }
    };
  }

  /**
   * 测试相机支持
   */
  static async testCameraSupport(): Promise<{
    hasCamera: boolean;
    hasPermission: boolean;
    errorMessage?: string;
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      if (cameras.length === 0) {
        return { hasCamera: false, hasPermission: false, errorMessage: 'No cameras found' };
      }
      
      // 测试相机访问
      const stream = await navigator.mediaDevices.getUserMedia(this.getOptimalConstraints());
      
      // 清理测试流
      stream.getTracks().forEach(track => track.stop());
      
      return { hasCamera: true, hasPermission: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { 
        hasCamera: true, 
        hasPermission: false, 
        errorMessage: `Camera access denied: ${errorMsg}` 
      };
    }
  }
}