// ==UserScript==
// @name         1688接口监控器 - 超简单版本
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  监控1688接口请求
// @author       Your name
// @match        *://air.1688.com/*
// @match        *://*.air.1688.com/*
// @require      https://cdn.jsdelivr.net/gh/jiangxiaoyu66/scritpts_cat_sdks@latest/api-monitor-standalone.js
// @grant        GM_log
// @run-at       document-start
// @priority     1
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

    let monitorStarted = false;

    function startMonitoring() {
        if (monitorStarted) return;
        
        log('1688 API监控器启动中...');
        
        // 检查是否在aplus脚本之前执行
        if (window.aplus) {
            log('警告：检测到aplus脚本已存在，可能影响监控效果', 'warning');
        }
        
        if (typeof window.startAPIMonitor === 'function') {
            try {
                const monitor = startAPIMonitor(monitorConfig);
                if (monitor) {
                    monitorStarted = true;
                    log('API监控器启动成功', 'success');
                    monitor.on('requestCaptured', (data) => {
                        log(`捕获到新请求: ${data.method} ${data.url}`);
                        log(`请求详情: ${JSON.stringify(data, null, 2)}`);
                    });
                    monitor.on('dataCleared', () => {
                        log('监控数据已清空');
                    });
                    
                    // 添加调试信息
                    log(`监控器配置: ${JSON.stringify(monitorConfig, null, 2)}`);
                    log(`当前已捕获请求数: ${monitor.getRequests().length}`);
                    
                    // 测试监控器是否正常工作
                    setTimeout(() => {
                        log(`5秒后检查 - 已捕获请求数: ${monitor.getRequests().length}`);
                        if (monitor.getRequests().length === 0) {
                            log('⚠️ 警告：5秒内未捕获到任何请求，可能存在问题', 'warning');
                        }
                    }, 5000);
                } else {
                    log('API监控器启动失败，将在稍后重试', 'warning');
                    // 如果启动失败，延迟重试
                    setTimeout(() => {
                        if (!monitorStarted) {
                            startMonitoring();
                        }
                    }, 1000);
                }
            } catch (error) {
                log(`启动监控器时出错: ${error.message}，将在稍后重试`, 'error');
                // 如果出错，延迟重试
                setTimeout(() => {
                    if (!monitorStarted) {
                        startMonitoring();
                    }
                }, 1000);
            }
        } else {
            log('外部资源加载失败: startAPIMonitor 函数不可用，将在稍后重试', 'error');
            // 如果函数不可用，延迟重试
            setTimeout(() => {
                if (!monitorStarted) {
                    startMonitoring();
                }
            }, 1000);
        }
    }

    // 等待DOM准备就绪后启动
    function waitForDOM() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(startMonitoring, 100);
            });
        } else if (document.readyState === 'interactive') {
            setTimeout(startMonitoring, 100);
        } else if (document.readyState === 'complete') {
            startMonitoring();
        } else {
            // 如果状态未知，等待一段时间后重试
            setTimeout(waitForDOM, 100);
        }
    }

    // 开始等待DOM
    waitForDOM();

    // 额外的安全措施：监听页面加载完成事件
    window.addEventListener('load', () => {
        if (!monitorStarted) {
            setTimeout(startMonitoring, 200);
        }
    });

})(); 
