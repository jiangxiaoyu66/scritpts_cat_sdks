# 油猴脚本引入外部资源最佳实践

## 概述

本文档介绍在Tampermonkey油猴脚本中引入第三方JavaScript资源包的最佳实践，包括多种加载方式、错误处理、备用方案等。

## 支持的加载方式

### 1. @require 指令（推荐）

**优点：**
- 最安全的方式
- 支持子资源完整性验证（SRI）
- 在脚本执行前加载
- 自动处理依赖关系

**用法：**
```javascript
// ==UserScript==
// @require      https://your-cdn.com/api-monitor-standalone.js
// @require      https://your-cdn.com/api-monitor-standalone.js#sha256=your-hash-here
// ==/UserScript==
```

**SRI哈希验证：**
```javascript
// 支持多种哈希算法
// @require      https://your-cdn.com/script.js#md5=123456...
// @require      https://your-cdn.com/script.js#sha256=abcdef...
// @require      https://your-cdn.com/script.js#md5=123456...,sha256=abcdef...
```

### 2. @resource 指令

**优点：**
- 预加载资源
- 可通过GM_getResourceText获取内容
- 支持SRI验证

**用法：**
```javascript
// ==UserScript==
// @resource     MONITOR_SCRIPT https://your-cdn.com/api-monitor-standalone.js
// ==/UserScript==

// 在脚本中使用
const scriptContent = GM_getResourceText('MONITOR_SCRIPT');
```

### 3. GM_addElement（推荐用于动态加载）

**优点：**
- 绕过CSP限制
- 支持动态加载
- 更好的错误处理

**用法：**
```javascript
// 需要 @grant GM_addElement
const script = GM_addElement('script', {
    src: 'https://your-cdn.com/api-monitor-standalone.js',
    type: 'text/javascript'
});
```

### 4. 传统动态加载

**优点：**
- 兼容性好
- 可以控制加载时机
- 支持多个备用源

**用法：**
```javascript
const script = document.createElement('script');
script.src = 'https://your-cdn.com/api-monitor-standalone.js';
script.onload = () => console.log('加载成功');
script.onerror = () => console.log('加载失败');
document.head.appendChild(script);
```

## 错误处理和备用方案

### 1. 多重加载策略

```javascript
class ResourceLoader {
    async load() {
        const loadMethods = [
            () => this.loadViaRequire(),
            () => this.loadViaResource(),
            () => this.loadViaGMAddElement(),
            () => this.loadDynamically(primaryCDN)
        ];
        
        for (const method of loadMethods) {
            try {
                await method();
                return true;
            } catch (error) {
                console.warn(`加载方法失败: ${error.message}`);
            }
        }
        
        return await this.loadBackupCDNs();
    }
}
```

### 2. 备用CDN源

```javascript
const backupCDNs = [
    'https://cdn.jsdelivr.net/gh/your-username/your-repo@main/script.js',
    'https://unpkg.com/your-package@latest/script.js',
    'https://raw.githubusercontent.com/your-username/your-repo/main/script.js'
];
```

### 3. 超时和重试机制

```javascript
const retryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000
};
```

## 最佳实践

### 1. 权限配置

```javascript
// ==UserScript==
// @grant        GM_xmlhttpRequest
// @grant        GM_addElement
// @grant        GM_getResourceText
// @grant        GM_log
// @connect      your-cdn.com
// @connect      cdn.jsdelivr.net
// @connect      unpkg.com
// ==/UserScript==
```

### 2. 资源完整性验证

```javascript
// 使用SRI哈希确保资源完整性
// @require      https://your-cdn.com/script.js#sha256=your-hash-here
```

### 3. 错误检测和报告

```javascript
function checkResourceLoaded() {
    if (typeof window.startAPIMonitor === 'function') {
        console.log('✅ 外部资源加载成功');
        return true;
    } else {
        console.error('❌ 外部资源加载失败');
        return false;
    }
}
```

### 4. 用户友好的错误提示

```javascript
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #f44336;
        color: white;
        padding: 10px;
        border-radius: 4px;
        z-index: 10000;
    `;
    errorDiv.innerHTML = `
        <strong>脚本加载错误</strong><br>
        ${message}<br>
        <small>请刷新页面重试</small>
    `;
    document.body.appendChild(errorDiv);
}
```

## 示例文件说明

### simple-example.js
基础版本的油猴脚本，使用简单的动态加载方式。

### simple-example-advanced.js
高级版本的油猴脚本，包含：
- 多种加载方式
- 完整的错误处理
- 备用CDN支持
- 用户友好的错误提示
- 详细的日志记录

## 常见问题

### Q: 为什么@require指令加载失败？
A: 可能的原因：
- 网络连接问题
- CDN服务不可用
- 资源URL错误
- CSP限制

### Q: 如何处理CSP限制？
A: 使用GM_addElement或@resource指令，这些方式可以绕过CSP限制。

### Q: 如何确保资源完整性？
A: 使用SRI哈希验证：
```javascript
// @require      https://your-cdn.com/script.js#sha256=your-hash-here
```

### Q: 如何调试加载问题？
A: 使用浏览器开发者工具：
- 检查Network标签页
- 查看Console错误信息
- 使用GM_log记录详细日志

## 安全注意事项

1. **使用HTTPS**: 确保所有外部资源都通过HTTPS加载
2. **SRI验证**: 使用子资源完整性验证防止资源被篡改
3. **权限最小化**: 只请求必要的权限
4. **错误处理**: 妥善处理加载失败的情况
5. **备用方案**: 提供多个备用CDN源

## 性能优化

1. **缓存策略**: 利用浏览器缓存减少重复下载
2. **异步加载**: 使用异步加载避免阻塞页面
3. **按需加载**: 只在需要时加载资源
4. **压缩资源**: 使用压缩版本的JavaScript文件

## 总结

推荐的使用顺序：
1. 优先使用@require指令（最安全）
2. 备用@resource指令
3. 动态加载使用GM_addElement
4. 最后使用传统动态加载

确保提供完整的错误处理和用户友好的提示信息。 