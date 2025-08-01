// ==UserScript==
// @name         1688接口监控器 - 超简单版本
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  监控1688接口请求
// @author       Your name
// @match        *://air.1688.com/*
// @match        *://*.air.1688.com/*
// @require      https://cdn.jsdelivr.net/gh/jiangxiaoyu66/scritpts_cat_sdks@main/api-monitor-standalone.js
// @grant        GM_log
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 监控配置
    const monitorConfig = {
        targetPaths: [
            '/h5/mtop.cbu.distribute.selection.scenesearch/1.0',
            '/h5/mtop.cbu.distribute.selection.list/1.0'
        ],
        allowedDomains: ['air.1688.com', 'h5api.m.1688.com'],
        maxStoredRequests: 200,
        storageKey: '1688_api_monitor_requests',
        enableUI: true,
        enableLog: true,
        autoStart: true
    };

    // 日志工具
    function log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[API Monitor ${timestamp}]`;
        switch (type) {
            case 'success':
                console.log(`✅ ${prefix} ${message}`);
                break;
            case 'error':
                console.error(`❌ ${prefix} ${message}`);
                break;
            case 'warning':
                console.warn(`⚠️ ${prefix} ${message}`);
                break;
            default:
                console.log(`ℹ️ ${prefix} ${message}`);
        }
        GM_log(`${prefix} ${message}`);
    }

    function startMonitoring() {
        log('1688 API监控器启动中...');
        
        // 检查是否在aplus脚本之前执行
        if (window.aplus) {
            log('警告：检测到aplus脚本已存在，可能影响监控效果', 'warning');
        }
        
        if (typeof window.startAPIMonitor === 'function') {
            try {
                const monitor = startAPIMonitor(monitorConfig);
                if (monitor) {
                    log('API监控器启动成功', 'success');
                    monitor.on('requestCaptured', (data) => {
                        log(`捕获到新请求: ${data.method} ${data.url}`);
                    });
                    monitor.on('dataCleared', () => {
                        log('监控数据已清空');
                    });
                } else {
                    log('API监控器启动失败', 'error');
                }
            } catch (error) {
                log(`启动监控器时出错: ${error.message}`, 'error');
            }
        } else {
            log('外部资源加载失败: startAPIMonitor 函数不可用', 'error');
        }
    }

    // 立即尝试启动
    startMonitoring();

    // 如果立即启动失败，等待DOM准备就绪后重试
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(startMonitoring, 50);
        });
    } else {
        setTimeout(startMonitoring, 50);
    }

    // 监听页面变化，确保在页面完全加载后再次检查
    if (document.readyState === 'complete') {
        setTimeout(startMonitoring, 100);
    } else {
        window.addEventListener('load', () => {
            setTimeout(startMonitoring, 100);
        });
    }

})(); 