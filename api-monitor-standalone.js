/**
 * 独立API监控包
 * 包含完整的监控功能和启动函数
 * 版本: 1.0.0
 */

(function(window) {
    'use strict';
    
    // 默认配置
    const DEFAULT_CONFIG = {
        targetPaths: [],
        allowedDomains: [],
        maxStoredRequests: 100,
        captureFields: {
            request: {
                url: true,
                method: true,
                headers: true,
                payload: true,
                queryParams: true
            },
            response: {
                status: true,
                headers: true,
                body: true,
                timing: true
            },
            metadata: {
                timestamp: true,
                domain: true,
                path: true,
                duration: true,
                initiator: true
            }
        },
        storageKey: 'api_monitor_requests',
        enableUI: true,
        enableLog: true,
        autoStart: true
    };
    
    class APIMonitor {
        constructor(config = {}) {
            this.config = this.mergeConfig(DEFAULT_CONFIG, config);
            this.capturedRequests = [];
            this.isMonitoring = false;
            this.observers = [];
            
            this.loadFromStorage();
            this.init();
        }
        
        mergeConfig(defaultConfig, userConfig) {
            return {
                ...defaultConfig,
                ...userConfig,
                captureFields: {
                    ...defaultConfig.captureFields,
                    ...userConfig.captureFields,
                    request: {
                        ...defaultConfig.captureFields.request,
                        ...userConfig.captureFields?.request
                    },
                    response: {
                        ...defaultConfig.captureFields.response,
                        ...userConfig.captureFields?.response
                    },
                    metadata: {
                        ...defaultConfig.captureFields.metadata,
                        ...userConfig.captureFields?.metadata
                    }
                }
            };
        }
        
        init() {
            this.log('🚀 API监控器初始化');
            this.log('监控路径:', this.config.targetPaths);
            this.log('允许域名:', this.config.allowedDomains);
            
            if (this.config.autoStart) {
                this.start();
            }
            
            if (this.config.enableUI) {
                this.createUI();
            }
        }
        
        start() {
            if (this.isMonitoring) {
                this.log('⚠️ 监控器已在运行中');
                return;
            }
            
            this.interceptXHR();
            this.interceptFetch();
            this.setupPerformanceObserver();
            this.interceptJSONP();
            this.interceptScriptTags();
            
            // 添加全局网络请求监听
            this.interceptAllNetworkRequests();
            
            this.isMonitoring = true;
            this.log('✅ 监控器已启动');
        }
        
        stop() {
            if (!this.isMonitoring) {
                this.log('⚠️ 监控器未在运行');
                return;
            }
            
            this.observers.forEach(observer => {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            });
            this.observers = [];
            
            this.isMonitoring = false;
            this.log('⏹️ 监控器已停止');
        }
        
        interceptXHR() {
            const origXHR = window.XMLHttpRequest;
            const self = this; // 保存this引用
            
            self.log('🔧 开始拦截XHR请求');
            
            window.XMLHttpRequest = function() {
                const xhr = new origXHR();
                const origOpen = xhr.open;
                const origSend = xhr.send;
                
                xhr.open = function(method, url) {
                    self.log(`🔍 XHR open: ${method} ${url}`);
                    xhr._url = url;
                    xhr._method = method;
                    xhr._startTime = Date.now();
                    return origOpen.apply(this, arguments);
                };
                
                xhr.send = function(body) {
                    self.log(`🔍 XHR send: ${xhr._method} ${xhr._url}`);
                    
                    const hasTargetPath = self.config.targetPaths.some(path => xhr._url.includes(path));
                    const urlInfo = self.parseURL(xhr._url);
                    const hasAllowedDomain = self.config.allowedDomains.length === 0 || 
                                          self.config.allowedDomains.some(domain => urlInfo.domain.includes(domain));
                    
                    self.log(`🔍 XHR检查 - URL: ${xhr._url}, 路径匹配: ${hasTargetPath}, 域名匹配: ${hasAllowedDomain}`);
                    
                    if (xhr._url && typeof xhr._url === 'string' && hasTargetPath && hasAllowedDomain) {
                        self.log(`📡 监控XHR请求: ${xhr._method} ${xhr._url}`);
                        self.log(`🔍 路径匹配: ${hasTargetPath}, 域名匹配: ${hasAllowedDomain}`);
                        xhr._body = body;
                        
                        xhr.addEventListener('load', () => {
                            try {
                                const duration = Date.now() - xhr._startTime;
                                const requestData = self.buildRequestData('xhr', {
                                    method: xhr._method,
                                    url: xhr._url,
                                    body: xhr._body,
                                    status: xhr.status,
                                    responseText: xhr.responseText,
                                    responseHeaders: xhr.getAllResponseHeaders(),
                                    duration: duration
                                });
                                
                                self.saveRequest(requestData);
                            } catch (e) {
                                self.log('❌ 处理XHR响应出错:', e);
                            }
                        });
                    }
                    
                    return origSend.apply(this, arguments);
                };
                
                return xhr;
            };
        }
        
        interceptFetch() {
            const origFetch = window.fetch;
            const self = this; // 保存this引用
            
            self.log('🔧 开始拦截Fetch请求');
            
            window.fetch = function(input, init) {
                const url = typeof input === 'string' ? input : input?.url;
                const method = init?.method || 'GET';
                const body = init?.body;
                
                self.log(`🔍 Fetch请求: ${method} ${url}`);
                
                const hasTargetPath = self.config.targetPaths.some(path => url.includes(path));
                const urlInfo = self.parseURL(url);
                const hasAllowedDomain = self.config.allowedDomains.length === 0 || 
                                      self.config.allowedDomains.some(domain => urlInfo.domain.includes(domain));
                
                self.log(`🔍 Fetch检查 - URL: ${url}, 路径匹配: ${hasTargetPath}, 域名匹配: ${hasAllowedDomain}`);
                
                if (url && typeof url === 'string' && hasTargetPath && hasAllowedDomain) {
                    self.log(`📡 监控Fetch请求: ${method} ${url}`);
                    self.log(`🔍 路径匹配: ${hasTargetPath}, 域名匹配: ${hasAllowedDomain}`);
                    const startTime = Date.now();
                    
                    return origFetch.apply(this, arguments)
                        .then(response => {
                            const duration = Date.now() - startTime;
                            const clonedResponse = response.clone();
                            
                            clonedResponse.text().then(responseText => {
                                try {
                                    const requestData = self.buildRequestData('fetch', {
                                        method: method,
                                        url: url,
                                        body: body,
                                        headers: init?.headers,
                                        status: response.status,
                                        responseText: responseText,
                                        responseHeaders: self.parseHeaders(response.headers),
                                        duration: duration
                                    });
                                    
                                    self.saveRequest(requestData);
                                } catch (e) {
                                    self.log('❌ 处理Fetch响应出错:', e);
                                }
                            });
                            
                            return response;
                        });
                }
                
                return origFetch.apply(this, arguments);
            };
        }
        
        setupPerformanceObserver() {
            try {
                if (typeof PerformanceObserver !== 'undefined') {
                    const self = this; // 保存this引用
                    const observer = new PerformanceObserver((list) => {
                        list.getEntries().forEach(entry => {
                            if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch') {
                                const url = entry.name;
                                const hasTargetPath = self.config.targetPaths.some(path => url.includes(path));
                                
                                if (url && typeof url === 'string' && hasTargetPath) {
                                    self.log(`📊 Performance API检测到目标请求: ${url}`);
                                }
                            }
                        });
                    });
                    
                    observer.observe({entryTypes: ['resource']});
                    this.observers.push(observer);
                    this.log('✅ Performance Observer已设置');
                }
            } catch (e) {
                this.log('❌ 设置Performance Observer失败:', e);
            }
        }
        
        interceptJSONP() {
            const self = this;
            self.log('🔧 开始拦截JSONP请求');
            
            // 拦截动态创建的script标签
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const element = originalCreateElement.call(this, tagName);
                
                if (tagName.toLowerCase() === 'script') {
                    const originalSetAttribute = element.setAttribute;
                    const originalSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
                    
                    element.setAttribute = function(name, value) {
                        if (name === 'src') {
                            self.log(`🔍 JSONP Script src: ${value}`);
                            const hasTargetPath = self.config.targetPaths.some(path => value.includes(path));
                            const urlInfo = self.parseURL(value);
                            const hasAllowedDomain = self.config.allowedDomains.length === 0 || 
                                                  self.config.allowedDomains.some(domain => urlInfo.domain.includes(domain));
                            
                            if (hasTargetPath && hasAllowedDomain) {
                                self.log(`📡 监控JSONP请求: ${value}`);
                                const startTime = Date.now();
                                
                                element.addEventListener('load', () => {
                                    const duration = Date.now() - startTime;
                                    const requestData = self.buildRequestData('jsonp', {
                                        method: 'GET',
                                        url: value,
                                        status: 200,
                                        duration: duration
                                    });
                                    self.saveRequest(requestData);
                                });
                            }
                        }
                        return originalSetAttribute.call(this, name, value);
                    };
                    
                    if (originalSrc) {
                        Object.defineProperty(element, 'src', {
                            set: function(value) {
                                self.log(`🔍 JSONP Script src: ${value}`);
                                const hasTargetPath = self.config.targetPaths.some(path => value.includes(path));
                                const urlInfo = self.parseURL(value);
                                const hasAllowedDomain = self.config.allowedDomains.length === 0 || 
                                                      self.config.allowedDomains.some(domain => urlInfo.domain.includes(domain));
                                
                                if (hasTargetPath && hasAllowedDomain) {
                                    self.log(`📡 监控JSONP请求: ${value}`);
                                    const startTime = Date.now();
                                    
                                    element.addEventListener('load', () => {
                                        const duration = Date.now() - startTime;
                                        const requestData = self.buildRequestData('jsonp', {
                                            method: 'GET',
                                            url: value,
                                            status: 200,
                                            duration: duration
                                        });
                                        self.saveRequest(requestData);
                                    });
                                }
                                originalSrc.set.call(this, value);
                            },
                            get: originalSrc.get
                        });
                    }
                }
                
                return element;
            };
        }
        
        interceptScriptTags() {
            const self = this;
            self.log('🔧 开始拦截Script标签');
            
            // 监听DOM变化，检测动态添加的script标签
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
                            const src = node.src;
                            if (src) {
                                self.log(`🔍 检测到Script标签: ${src}`);
                                const hasTargetPath = self.config.targetPaths.some(path => src.includes(path));
                                const urlInfo = self.parseURL(src);
                                const hasAllowedDomain = self.config.allowedDomains.length === 0 || 
                                                      self.config.allowedDomains.some(domain => urlInfo.domain.includes(domain));
                                
                                if (hasTargetPath && hasAllowedDomain) {
                                    self.log(`📡 监控Script标签请求: ${src}`);
                                    const startTime = Date.now();
                                    
                                    node.addEventListener('load', () => {
                                        const duration = Date.now() - startTime;
                                        const requestData = self.buildRequestData('script', {
                                            method: 'GET',
                                            url: src,
                                            status: 200,
                                            duration: duration
                                        });
                                        self.saveRequest(requestData);
                                    });
                                }
                            }
                        }
                    });
                });
            });
            
            observer.observe(document, {
                childList: true,
                subtree: true
            });
            
            this.observers.push(observer);
        }
        
        interceptAllNetworkRequests() {
            const self = this;
            self.log('🔧 开始全局网络请求监听');
            
            // 监听所有网络请求
            const originalFetch = window.fetch;
            const originalXHR = window.XMLHttpRequest;
            
            // 重写 fetch
            window.fetch = function(input, init) {
                const url = typeof input === 'string' ? input : input?.url;
                const method = init?.method || 'GET';
                
                self.log(`🌐 全局Fetch请求: ${method} ${url}`);
                
                return originalFetch.apply(this, arguments);
            };
            
            // 重写 XMLHttpRequest
            const originalXHRConstructor = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new originalXHRConstructor();
                const originalOpen = xhr.open;
                const originalSend = xhr.send;
                
                xhr.open = function(method, url) {
                    self.log(`🌐 全局XHR请求: ${method} ${url}`);
                    return originalOpen.apply(this, arguments);
                };
                
                xhr.send = function(body) {
                    return originalSend.apply(this, arguments);
                };
                
                return xhr;
            };
            
            // 监听 Performance API
            if (typeof PerformanceObserver !== 'undefined') {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch' || entry.initiatorType === 'script') {
                            self.log(`🌐 Performance API: ${entry.initiatorType} ${entry.name}`);
                        }
                    });
                });
                
                observer.observe({entryTypes: ['resource']});
                this.observers.push(observer);
            }
        }
        
        buildRequestData(type, data) {
            this.log(`🔨 构建请求数据: ${type} - ${data.url}`);
            
            const requestData = {
                id: this.generateId(),
                type: type
            };
            
            const urlInfo = this.parseURL(data.url);
            
            if (this.config.captureFields.request.method) {
                requestData.method = data.method;
            }
            
            if (this.config.captureFields.request.url) {
                requestData.url = data.url;
            }
            
            if (this.config.captureFields.request.payload) {
                requestData.request = this.parseData(data.body);
            }
            
            if (this.config.captureFields.request.headers && data.headers) {
                requestData.requestHeaders = data.headers;
            }
            
            if (this.config.captureFields.response.status) {
                requestData.status = data.status;
            }
            
            if (this.config.captureFields.response.body) {
                requestData.response = this.parseData(data.responseText);
            }
            
            if (this.config.captureFields.response.headers && data.responseHeaders) {
                requestData.responseHeaders = data.responseHeaders;
            }
            
            if (this.config.captureFields.metadata.timestamp) {
                requestData.timestamp = new Date().toISOString();
            }
            
            if (this.config.captureFields.metadata.domain) {
                requestData.domain = urlInfo.domain;
            }
            
            if (this.config.captureFields.metadata.path) {
                requestData.path = urlInfo.path;
            }
            
            if (this.config.captureFields.metadata.duration) {
                requestData.duration = data.duration;
            }
            
            if (this.config.captureFields.metadata.initiator) {
                requestData.initiator = type;
            }
            
            return requestData;
        }
        
        parseURL(url) {
            let domain = '';
            let path = '';
            
            try {
                if (url.startsWith('http')) {
                    const urlObj = new URL(url);
                    domain = urlObj.hostname;
                    path = urlObj.pathname;
                } else {
                    domain = window.location.hostname;
                    
                    if (url.startsWith('/')) {
                        path = url;
                    } else {
                        const currentPath = window.location.pathname;
                        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                        path = basePath + url;
                    }
                }
            } catch (e) {
                domain = window.location.hostname || 'unknown';
                path = url;
            }
            
            return { domain, path };
        }
        
        parseData(data) {
            if (!data) return null;
            
            try {
                if (typeof data === 'string') {
                    return JSON.parse(data);
                }
                return data;
            } catch (e) {
                return data;
            }
        }
        
        parseHeaders(headers) {
            if (!headers) return {};
            
            const result = {};
            if (headers.forEach) {
                headers.forEach((value, key) => {
                    result[key] = value;
                });
            }
            return result;
        }
        
        generateId() {
            return Date.now().toString() + Math.random().toString(36).substring(2, 9);
        }
        
        saveRequest(data) {
            this.log('💾 保存请求:', data);
            this.log(`📊 当前已捕获 ${this.capturedRequests.length} 个请求`);
            
            this.capturedRequests.push(data);
            
            if (this.capturedRequests.length > this.config.maxStoredRequests) {
                this.capturedRequests = this.capturedRequests.slice(-this.config.maxStoredRequests);
            }
            
            this.saveToStorage();
            
            if (this.config.enableUI) {
                this.updateBadgeCount();
            }
            
            this.triggerEvent('requestCaptured', data);
            this.log(`✅ 请求已保存，总数: ${this.capturedRequests.length}`);
        }
        
        saveToStorage() {
            try {
                localStorage.setItem(this.config.storageKey, JSON.stringify(this.capturedRequests));
            } catch (e) {
                this.log('❌ 保存到本地存储失败:', e);
            }
        }
        
        loadFromStorage() {
            try {
                const stored = localStorage.getItem(this.config.storageKey);
                if (stored) {
                    this.capturedRequests = JSON.parse(stored);
                }
            } catch (e) {
                this.log('❌ 从本地存储加载失败:', e);
                this.capturedRequests = [];
            }
        }
        
        clear() {
            this.capturedRequests = [];
            this.saveToStorage();
            
            if (this.config.enableUI) {
                this.updateBadgeCount();
                this.renderRequestList();
            }
            
            this.triggerEvent('dataCleared');
        }
        
        getRequests() {
            return [...this.capturedRequests];
        }
        
        download(filename = null) {
            if (this.capturedRequests.length === 0) {
                this.log('⚠️ 暂无数据可下载');
                return;
            }
            
            try {
                const dataStr = JSON.stringify(this.capturedRequests, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || `api_monitor_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.log('✅ 数据下载成功');
            } catch (e) {
                this.log('❌ 下载数据失败:', e);
            }
        }
        
        createUI() {
            // 确保 document.body 存在
            if (!document.body) {
                this.log('⚠️ document.body 不存在，延迟创建UI');
                setTimeout(() => this.createUI(), 100);
                return;
            }
            
            // 检查是否已经存在UI元素
            if (document.getElementById('api-monitor-button')) {
                this.log('⚠️ UI元素已存在，跳过创建');
                return;
            }
            
            const button = document.createElement('div');
            button.id = 'api-monitor-button';
            button.innerHTML = `
                <div id="api-monitor-icon">🔍</div>
                <span id="api-monitor-badge">${this.capturedRequests.length}</span>
            `;
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background-color: #2196F3;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                z-index: 9999;
            `;
            
            const badge = document.createElement('span');
            badge.id = 'api-monitor-badge';
            badge.textContent = this.capturedRequests.length;
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background-color: red;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            button.appendChild(badge);
            
            button.addEventListener('click', () => this.togglePanel());
            document.body.appendChild(button);
            
            this.createPanel();
            this.renderRequestList();
        }
        
        createPanel() {
            // 确保 document.body 存在
            if (!document.body) {
                this.log('⚠️ document.body 不存在，延迟创建面板');
                setTimeout(() => this.createPanel(), 100);
                return;
            }
            
            // 检查是否已经存在面板
            if (document.getElementById('api-monitor-panel')) {
                this.log('⚠️ 面板已存在，跳过创建');
                return;
            }
            
            const panel = document.createElement('div');
            panel.id = 'api-monitor-panel';
            panel.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 80%;
                max-width: 800px;
                height: 70%;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                z-index: 9998;
                display: none;
                flex-direction: column;
                overflow: hidden;
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 10px 15px;
                background-color: #2196F3;
                color: white;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            header.innerHTML = `
                <span>API监控器 (${this.capturedRequests.length})</span>
                <div>
                    <button id="api-monitor-download" style="margin-right: 10px; padding: 5px 10px; background: #4CAF50; border: none; color: white; border-radius: 4px; cursor: pointer;">下载</button>
                    <button id="api-monitor-clear" style="margin-right: 10px; padding: 5px 10px; background: #f44336; border: none; color: white; border-radius: 4px; cursor: pointer;">清空</button>
                    <button id="api-monitor-close" style="padding: 5px 10px; background: #555; border: none; color: white; border-radius: 4px; cursor: pointer;">关闭</button>
                </div>
            `;
            panel.appendChild(header);
            
            const content = document.createElement('div');
            content.id = 'api-monitor-content';
            content.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            `;
            panel.appendChild(content);
            
            document.body.appendChild(panel);
            
            document.getElementById('api-monitor-download').addEventListener('click', () => this.download());
            document.getElementById('api-monitor-clear').addEventListener('click', () => this.clear());
            document.getElementById('api-monitor-close').addEventListener('click', () => this.togglePanel());
        }
        
        togglePanel() {
            const panel = document.getElementById('api-monitor-panel');
            if (panel.style.display === 'none' || !panel.style.display) {
                panel.style.display = 'flex';
                this.renderRequestList();
            } else {
                panel.style.display = 'none';
            }
        }
        
        renderRequestList() {
            const content = document.getElementById('api-monitor-content');
            if (!content) return;
            
            content.innerHTML = '';
            
            if (this.capturedRequests.length === 0) {
                content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">暂无捕获的请求</div>';
                return;
            }
            
            const sortedRequests = [...this.capturedRequests].reverse();
            
            sortedRequests.forEach(req => {
                const item = document.createElement('div');
                item.className = 'request-item';
                item.style.cssText = `
                    margin-bottom: 10px;
                    padding: 10px;
                    border-radius: 4px;
                    background-color: #f5f5f5;
                    cursor: pointer;
                    border-left: 4px solid ${req.status >= 200 && req.status < 300 ? '#4CAF50' : '#f44336'};
                `;
                
                let pathname = req.path || req.url;
                if (!req.path && req.url) {
                    try {
                        pathname = new URL(req.url).pathname;
                    } catch (e) {
                        // 使用完整URL
                    }
                }
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${req.method} ${pathname}</strong>
                        <span style="color: ${req.status >= 200 && req.status < 300 ? 'green' : 'red'};">${req.status}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        ${new Date(req.timestamp).toLocaleTimeString()} · ${req.duration}ms
                    </div>
                `;
                
                item.addEventListener('click', () => this.showRequestDetail(req));
                content.appendChild(item);
            });
        }
        
        showRequestDetail(req) {
            // 确保 document.body 存在
            if (!document.body) {
                this.log('⚠️ document.body 不存在，无法显示详情');
                return;
            }
            
            const detailPanel = document.createElement('div');
            detailPanel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 800px;
                height: 80%;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            `;
            
            let pathname = req.path || req.url;
            if (!req.path && req.url) {
                try {
                    pathname = new URL(req.url).pathname;
                } catch (e) {
                    // 使用完整URL
                }
            }
            
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 10px 15px;
                background-color: #2196F3;
                color: white;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            header.innerHTML = `
                <span>${req.method} ${pathname}</span>
                <button id="detail-close" style="padding: 5px 10px; background: #555; border: none; color: white; border-radius: 4px; cursor: pointer;">关闭</button>
            `;
            detailPanel.appendChild(header);
            
            const content = document.createElement('div');
            content.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 15px;
            `;
            
            function formatJSON(obj) {
                try {
                    return JSON.stringify(obj, null, 2);
                } catch (e) {
                    return String(obj);
                }
            }
            
            let html = '<div style="margin-bottom: 15px;">';
            html += '<h3 style="margin: 0 0 5px 0;">基本信息</h3>';
            html += '<div style="background: #f5f5f5; padding: 10px; border-radius: 4px;">';
            
            if (req.url) html += `<div><strong>URL:</strong> ${req.url}</div>`;
            if (req.domain) html += `<div><strong>域名:</strong> ${req.domain}</div>`;
            if (req.path) html += `<div><strong>路径:</strong> ${req.path}</div>`;
            if (req.method) html += `<div><strong>方法:</strong> ${req.method}</div>`;
            if (req.status !== undefined) html += `<div><strong>状态码:</strong> <span style="color: ${req.status >= 200 && req.status < 300 ? 'green' : 'red'};">${req.status}</span></div>`;
            if (req.timestamp) html += `<div><strong>时间:</strong> ${new Date(req.timestamp).toLocaleString()}</div>`;
            if (req.duration !== undefined) html += `<div><strong>耗时:</strong> ${req.duration}ms</div>`;
            if (req.initiator) html += `<div><strong>发起者:</strong> ${req.initiator}</div>`;
            
            html += '</div></div>';
            
            if (req.request || req.requestHeaders) {
                html += '<div style="margin-bottom: 15px;">';
                html += '<h3 style="margin: 0 0 5px 0;">请求数据</h3>';
                
                if (req.requestHeaders) {
                    html += '<h4 style="margin: 5px 0;">请求头</h4>';
                    html += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0 0 10px 0;">${formatJSON(req.requestHeaders)}</pre>`;
                }
                
                if (req.request) {
                    html += '<h4 style="margin: 5px 0;">请求体</h4>';
                    html += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${formatJSON(req.request)}</pre>`;
                }
                
                html += '</div>';
            }
            
            if (req.response || req.responseHeaders) {
                html += '<div>';
                html += '<h3 style="margin: 0 0 5px 0;">响应数据</h3>';
                
                if (req.responseHeaders) {
                    html += '<h4 style="margin: 5px 0;">响应头</h4>';
                    html += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0 0 10px 0;">${formatJSON(req.responseHeaders)}</pre>`;
                }
                
                if (req.response) {
                    html += '<h4 style="margin: 5px 0;">响应体</h4>';
                    html += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${formatJSON(req.response)}</pre>`;
                }
                
                html += '</div>';
            }
            
            content.innerHTML = html;
            detailPanel.appendChild(content);
            document.body.appendChild(detailPanel);
            
            document.getElementById('detail-close').addEventListener('click', () => {
                document.body.removeChild(detailPanel);
            });
        }
        
        updateBadgeCount() {
            const badge = document.getElementById('api-monitor-badge');
            if (badge) {
                badge.textContent = this.capturedRequests.length;
            }
        }
        
        log(...args) {
            if (this.config.enableLog) {
                console.log('[API Monitor]', ...args);
            }
        }
        
        triggerEvent(eventName, data) {
            const event = new CustomEvent(`apiMonitor:${eventName}`, {
                detail: data
            });
            window.dispatchEvent(event);
        }
        
        on(eventName, callback) {
            window.addEventListener(`apiMonitor:${eventName}`, (event) => {
                callback(event.detail);
            });
        }
        
        off(eventName, callback) {
            window.removeEventListener(`apiMonitor:${eventName}`, callback);
        }
    }
    
    // 全局启动函数
    window.startAPIMonitor = function(config = {}) {
        try {
            // 创建监控器实例
            const monitor = new APIMonitor(config);
            
            // 保存到全局变量
            window.apiMonitor = monitor;
            
            // 添加全局API
            window.monitorAPI = {
                getRequests: () => monitor.getRequests(),
                clear: () => monitor.clear(),
                download: (filename) => monitor.download(filename),
                start: () => monitor.start(),
                stop: () => monitor.stop(),
                getConfig: () => monitor.config,
                updateConfig: (newConfig) => {
                    Object.assign(monitor.config, newConfig);
                }
            };
            
            console.log('✅ API监控器启动成功');
            return monitor;
            
        } catch (error) {
            console.error('❌ API监控器启动失败:', error);
            return null;
        }
    };
    
    // 暴露类到全局（可选）
    window.APIMonitor = APIMonitor;
    
})(window); 喂醒
