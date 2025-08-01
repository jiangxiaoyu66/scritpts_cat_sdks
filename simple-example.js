// ==UserScript==
// @name         1688接口监控器 - 超简单版本
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  监控1688接口请求
// @author       Your name
// @match        *://air.1688.com/*
// @match        *://*.air.1688.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        unsafeWindow
// @connect      localhost
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // 1. 引入监控包（从CDN）
    const script = document.createElement('script');
    script.src = 'https://your-cdn.com/api-monitor-standalone.js';
    script.onload = function() {
        // 2. 配置监控参数
        const config = {
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
        
        // 3. 启动监控器
        startAPIMonitor(config);
    };
    document.head.appendChild(script);
    
})(); 